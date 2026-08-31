package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.ColumnInfo;
import com.rnave.studily.admin.AdminDtos.QueryResult;
import com.rnave.studily.admin.AdminDtos.TableInfo;
import com.rnave.studily.admin.AdminDtos.TableRows;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.NotFoundException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class AdminDbService {

    private static final int MAX_ROWS = 500;
    private static final int MAX_PAGE_SIZE = 200;
    private static final int STATEMENT_TIMEOUT_MS = 15_000;

    private static final Set<String> READ_STARTERS =
            Set.of("select", "with", "explain", "show", "table", "values");

    private static final Pattern CATASTROPHIC =
            Pattern.compile("\\bdrop\\s+(database|schema)\\b", Pattern.CASE_INSENSITIVE);

    private static final Set<String> BINARY_TYPES = Set.of("bytea");

    private final JdbcTemplate jdbc;

    public AdminDbService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<TableInfo> tables() {
        List<String> names = tableNames();
        List<TableInfo> out = new ArrayList<>(names.size());
        for (String name : names) {
            Long count = jdbc.queryForObject("SELECT count(*) FROM \"" + name + "\"", Long.class);
            Map<String, Object> size = jdbc.queryForMap(
                    "SELECT pg_total_relation_size(?::regclass) AS bytes, "
                            + "pg_size_pretty(pg_total_relation_size(?::regclass)) AS pretty",
                    name, name);
            out.add(new TableInfo(
                    name,
                    count == null ? 0 : count,
                    ((Number) size.get("bytes")).longValue(),
                    String.valueOf(size.get("pretty"))));
        }
        return out;
    }

    private List<String> tableNames() {
        return jdbc.queryForList("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """, String.class);
    }

    private String requireTable(String table) {
        String match = tableNames().stream()
                .filter(t -> t.equalsIgnoreCase(table))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("No such table: " + table));
        return match;
    }

    public List<ColumnInfo> columns(String table) {
        String safe = requireTable(table);
        String pk = primaryKey(safe);
        return jdbc.query("""
                SELECT column_name, udt_name, is_nullable
                FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = ?
                ORDER BY ordinal_position
                """, (rs, i) -> {
            String name = rs.getString("column_name");
            String type = rs.getString("udt_name");
            return new ColumnInfo(
                    name,
                    type,
                    "YES".equals(rs.getString("is_nullable")),
                    name.equals(pk),
                    BINARY_TYPES.contains(type));
        }, safe);
    }

    private String primaryKey(String table) {
        List<String> keys = jdbc.queryForList("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = ?::regclass AND i.indisprimary
                """, String.class, table);
        return keys.size() == 1 ? keys.getFirst() : null;
    }

    public TableRows browse(String table, int page, int size, String orderBy, String dir, String search) {
        String safe = requireTable(table);
        List<ColumnInfo> columns = columns(safe);
        String pk = primaryKey(safe);

        List<ColumnInfo> selectable = columns.stream().filter(c -> !c.binary()).toList();
        if (selectable.isEmpty()) {
            throw new BadRequestException("This table has no readable columns");
        }
        String columnList = selectable.stream()
                .map(c -> "\"" + c.name() + "\"")
                .reduce((a, b) -> a + ", " + b)
                .orElseThrow();

        String order = columns.stream().map(ColumnInfo::name)
                .filter(c -> c.equalsIgnoreCase(orderBy))
                .findFirst()
                .orElse(pk != null ? pk : selectable.getFirst().name());
        String direction = "asc".equalsIgnoreCase(dir) ? "ASC" : "DESC";

        String where = "";
        Object[] args;
        if (search != null && !search.isBlank()) {
            String clause = selectable.stream()
                    .map(c -> "CAST(\"" + c.name() + "\" AS TEXT) ILIKE ?")
                    .reduce((a, b) -> a + " OR " + b)
                    .orElseThrow();
            where = " WHERE (" + clause + ")";
            String pattern = "%" + search.trim() + "%";
            args = new Object[selectable.size()];
            java.util.Arrays.fill(args, pattern);
        } else {
            args = new Object[0];
        }

        Long total = jdbc.queryForObject(
                "SELECT count(*) FROM \"" + safe + "\"" + where, Long.class, args);

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Object[] pagedArgs = new Object[args.length + 2];
        System.arraycopy(args, 0, pagedArgs, 0, args.length);
        pagedArgs[args.length] = safeSize;
        pagedArgs[args.length + 1] = safePage * safeSize;

        String sql = "SELECT " + columnList + " FROM \"" + safe + "\"" + where
                + " ORDER BY \"" + order + "\" " + direction + " NULLS LAST LIMIT ? OFFSET ?";

        List<Map<String, Object>> rows = jdbc.query(sql, (rs, i) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            for (ColumnInfo column : selectable) {
                row.put(column.name(), normalize(rs.getObject(column.name())));
            }
            return row;
        }, pagedArgs);

        return new TableRows(safe, pk, columns, rows, total == null ? 0 : total, safePage, safeSize);
    }

    @Transactional
    public int updateRow(String table, String primaryKeyValue, Map<String, Object> changes) {
        String safe = requireTable(table);
        String pk = primaryKey(safe);
        if (pk == null) {
            throw new BadRequestException("This table has no single-column primary key, so rows can't be edited here");
        }
        if (changes == null || changes.isEmpty()) {
            throw new BadRequestException("Nothing to update");
        }
        Map<String, ColumnInfo> byName = new LinkedHashMap<>();
        for (ColumnInfo column : columns(safe)) {
            byName.put(column.name(), column);
        }

        StringBuilder sql = new StringBuilder("UPDATE \"").append(safe).append("\" SET ");
        List<Object> args = new ArrayList<>();
        boolean first = true;
        for (Map.Entry<String, Object> entry : changes.entrySet()) {
            ColumnInfo column = byName.get(entry.getKey());
            if (column == null) {
                throw new BadRequestException("No such column: " + entry.getKey());
            }
            if (column.binary()) {
                throw new BadRequestException("Binary column " + column.name() + " can't be edited here");
            }
            if (column.primaryKey()) {
                throw new BadRequestException("The primary key can't be changed here");
            }
            if (!first) {
                sql.append(", ");
            }
            first = false;
            sql.append('"').append(column.name()).append("\" = CAST(? AS ").append(column.type()).append(')');
            args.add(entry.getValue() == null ? null : String.valueOf(entry.getValue()));
        }
        ColumnInfo pkColumn = byName.get(pk);
        sql.append(" WHERE \"").append(pk).append("\" = CAST(? AS ").append(pkColumn.type()).append(')');
        args.add(primaryKeyValue);

        int affected;
        try {
            affected = jdbc.update(sql.toString(), args.toArray());
        } catch (DataAccessException e) {
            throw new BadRequestException(describe(e));
        }
        if (affected == 0) {
            throw new NotFoundException("No row matched " + pk + " = " + primaryKeyValue);
        }
        return affected;
    }

    @Transactional
    public int deleteRow(String table, String primaryKeyValue) {
        String safe = requireTable(table);
        String pk = primaryKey(safe);
        if (pk == null) {
            throw new BadRequestException("This table has no single-column primary key, so rows can't be deleted here");
        }
        String type = columns(safe).stream()
                .filter(c -> c.name().equals(pk))
                .findFirst()
                .map(ColumnInfo::type)
                .orElse("text");
        int affected;
        try {
            affected = jdbc.update(
                    "DELETE FROM \"" + safe + "\" WHERE \"" + pk + "\" = CAST(? AS " + type + ")",
                    primaryKeyValue);
        } catch (DataAccessException e) {
            throw new BadRequestException(describe(e));
        }
        if (affected == 0) {
            throw new NotFoundException("No row matched " + pk + " = " + primaryKeyValue);
        }
        return affected;
    }

    public String csv(String table) {
        String safe = requireTable(table);
        List<ColumnInfo> columns = columns(safe).stream().filter(c -> !c.binary()).toList();
        String columnList = columns.stream()
                .map(c -> "\"" + c.name() + "\"")
                .reduce((a, b) -> a + ", " + b)
                .orElseThrow();
        StringBuilder out = new StringBuilder();
        out.append(columns.stream().map(c -> escapeCsv(c.name())).reduce((a, b) -> a + "," + b).orElse(""));
        out.append('\n');
        jdbc.query("SELECT " + columnList + " FROM \"" + safe + "\"", rs -> {
            for (int i = 0; i < columns.size(); i++) {
                if (i > 0) {
                    out.append(',');
                }
                Object value = normalize(rs.getObject(columns.get(i).name()));
                out.append(escapeCsv(value == null ? "" : String.valueOf(value)));
            }
            out.append('\n');
        });
        return out.toString();
    }

    public String statementType(String sql) {
        String cleaned = stripLeadingNoise(sql);
        int end = cleaned.indexOf(' ');
        String word = (end < 0 ? cleaned : cleaned.substring(0, end)).toLowerCase(Locale.ROOT);
        return word.isEmpty() ? "unknown" : word;
    }

    public boolean isRead(String sql) {
        return READ_STARTERS.contains(statementType(sql));
    }

    @Transactional
    public QueryResult query(String sql, boolean allowWrite) {
        if (sql == null || sql.isBlank()) {
            throw new BadRequestException("Enter a query first");
        }
        String type = statementType(sql);
        boolean read = READ_STARTERS.contains(type);
        if (!read && !allowWrite) {
            throw new BadRequestException(
                    "\"" + type.toUpperCase(Locale.ROOT) + "\" modifies data. Turn on write mode to run it.");
        }
        if (CATASTROPHIC.matcher(sql).find()) {
            throw new BadRequestException(
                    "DROP DATABASE and DROP SCHEMA are blocked here. Use psql if you really mean it.");
        }

        long started = System.nanoTime();
        QueryResult result;
        try {
            result = jdbc.execute((org.springframework.jdbc.core.StatementCallback<QueryResult>) statement -> {
                statement.execute("SET LOCAL statement_timeout = " + STATEMENT_TIMEOUT_MS);
                statement.setMaxRows(MAX_ROWS + 1);
                boolean hasResultSet = statement.execute(sql);
                if (!hasResultSet) {
                    return new QueryResult(List.of(), List.of(), statement.getUpdateCount(), 0, false, type);
                }
                return readResultSet(statement, type);
            });
        } catch (DataAccessException e) {
            throw new BadRequestException(describe(e));
        }
        long millis = (System.nanoTime() - started) / 1_000_000;
        return new QueryResult(
                result.columns(), result.rows(), result.rowsAffected(), millis, result.truncated(), type);
    }

    private QueryResult readResultSet(Statement statement, String type) throws java.sql.SQLException {
        try (var rs = statement.getResultSet()) {
            ResultSetMetaData meta = rs.getMetaData();
            int columnCount = meta.getColumnCount();
            List<String> columns = new ArrayList<>(columnCount);
            for (int i = 1; i <= columnCount; i++) {
                columns.add(meta.getColumnLabel(i));
            }
            List<List<Object>> rows = new ArrayList<>();
            boolean truncated = false;
            while (rs.next()) {
                if (rows.size() >= MAX_ROWS) {
                    truncated = true;
                    break;
                }
                List<Object> row = new ArrayList<>(columnCount);
                for (int i = 1; i <= columnCount; i++) {
                    row.add(normalize(rs.getObject(i)));
                }
                rows.add(row);
            }
            return new QueryResult(columns, rows, null, 0, truncated, type);
        }
    }

    private static String describe(DataAccessException e) {
        Throwable cause = e;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        if (message == null || message.isBlank()) {
            return "The database rejected that statement";
        }
        int newline = message.indexOf('\n');
        return newline > 0 ? message.substring(0, newline).trim() : message.trim();
    }

    private static String stripLeadingNoise(String sql) {
        String working = sql.trim();
        boolean changed = true;
        while (changed) {
            changed = false;
            if (working.startsWith("--")) {
                int newline = working.indexOf('\n');
                working = newline < 0 ? "" : working.substring(newline + 1).trim();
                changed = true;
            } else if (working.startsWith("/*")) {
                int close = working.indexOf("*/");
                working = close < 0 ? "" : working.substring(close + 2).trim();
                changed = true;
            }
        }
        return working;
    }

    private static Object normalize(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof byte[] bytes) {
            return "<" + bytes.length + " bytes>";
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant().toString();
        }
        if (value instanceof java.sql.Date date) {
            return date.toLocalDate().toString();
        }
        if (value instanceof java.sql.Time time) {
            return time.toLocalTime().toString();
        }
        if (value instanceof Number || value instanceof Boolean) {
            return value;
        }
        return String.valueOf(value);
    }

    private static String escapeCsv(String value) {
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return '"' + value.replace("\"", "\"\"") + '"';
        }
        return value;
    }
}
