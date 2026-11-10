package com.rnave.studily.rag;

import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.filebank.BankFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.stream.Collectors;

@Component
public class ChunkStore {

    private static final Logger log = LoggerFactory.getLogger(ChunkStore.class);

    private static final String HIT_COLUMNS = """
            c.id AS chunk_id, c.file_id, f.name AS file_name, f.kind AS file_kind, f.format AS file_format,
            c.chunk_index, c.page_from, c.page_to, c.heading, c.content""";

    private static final String FROM_CHUNKS = """
            FROM bank_chunks c JOIN bank_files f ON f.id = c.file_id""";

    private static final String INSERT_CHUNK = """
            INSERT INTO bank_chunks
                (file_id, user_id, course_id, chat_id, chunk_index, page_from, page_to, heading, content,
                 token_estimate, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""";

    private static final RowMapper<Hit> HIT = (rs, row) -> new Hit(
            rs.getLong("chunk_id"), rs.getLong("file_id"), rs.getString("file_name"),
            BankFileKind.valueOf(rs.getString("file_kind")),
            BankFormat.valueOf(rs.getString("file_format")).previewable(),
            rs.getInt("chunk_index"), (Integer) rs.getObject("page_from"), (Integer) rs.getObject("page_to"),
            rs.getString("heading"), rs.getString("content"), rs.getDouble("score"));

    private final JdbcTemplate jdbc;

    public ChunkStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Hit(long chunkId, long fileId, String fileName, BankFileKind fileKind, boolean previewable,
                      int chunkIndex, Integer pageFrom, Integer pageTo, String heading, String content,
                      double score) {

        Hit withScore(double score) {
            return new Hit(chunkId, fileId, fileName, fileKind, previewable, chunkIndex, pageFrom, pageTo, heading,
                    content, score);
        }
    }

    @Transactional
    public void completeFile(long fileId, long userId, Long courseId, Long chatId, List<Chunk> chunks,
                             List<float[]> vectors, Integer pageCount, String embeddingModel, String statusDetail) {
        if (chunks.size() != vectors.size()) {
            throw new IllegalArgumentException("Every chunk needs exactly one vector");
        }
        jdbc.update("DELETE FROM bank_chunks WHERE file_id = ?", fileId);
        jdbc.batchUpdate(INSERT_CHUNK, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                Chunk chunk = chunks.get(i);
                ps.setLong(1, fileId);
                ps.setLong(2, userId);
                ps.setObject(3, courseId, Types.BIGINT);
                ps.setObject(4, chatId, Types.BIGINT);
                ps.setInt(5, chunk.index());
                ps.setObject(6, chunk.pageFrom(), Types.INTEGER);
                ps.setObject(7, chunk.pageTo(), Types.INTEGER);
                ps.setString(8, chunk.heading());
                ps.setString(9, chunk.text());
                ps.setInt(10, chunk.tokenEstimate());
                ps.setArray(11, ps.getConnection().createArrayOf("float4", boxed(vectors.get(i))));
            }

            @Override
            public int getBatchSize() {
                return chunks.size();
            }
        });
        jdbc.update("""
                        UPDATE bank_files
                        SET status = 'READY', status_detail = ?, chunk_count = ?, page_count = ?,
                            embedding_model = ?, indexed_at = now(), locked_at = NULL, next_attempt_at = NULL
                        WHERE id = ?""",
                statusDetail, chunks.size(), pageCount, embeddingModel, fileId);
    }

    public List<Hit> semanticSearch(Scope scope, float[] query, int limit) {
        long started = System.nanoTime();
        Nearest nearest = new Nearest(query, limit);
        RowCallbackHandler scan = rs -> nearest.offer(rs.getLong("id"),
                toPrimitive((Float[]) rs.getArray("embedding").getArray()));
        jdbc.query("SELECT id, embedding FROM bank_chunks c WHERE " + where("c", scope), scan,
                scope.userId(), scopeId(scope));
        List<Nearest.Scored> best = nearest.best();
        log.debug("Semantic search for scope {} finished in {} ms", scope,
                (System.nanoTime() - started) / 1_000_000);
        return hydrate(best);
    }

    public List<Hit> keywordSearch(Scope scope, String query, int limit) {
        return jdbc.query("SELECT " + HIT_COLUMNS + ", ts_rank_cd(c.content_tsv, q) AS score " + FROM_CHUNKS
                        + ", websearch_to_tsquery('english', ?) q WHERE " + where("c", scope)
                        + " AND c.content_tsv @@ q ORDER BY score DESC LIMIT ?",
                HIT, query, scope.userId(), scopeId(scope), limit);
    }

    public List<Hit> randomChunksPerFile(Scope scope, int perFile) {
        return jdbc.query("SELECT * FROM (SELECT " + HIT_COLUMNS + ", 0.0 AS score,"
                        + " ROW_NUMBER() OVER (PARTITION BY c.file_id ORDER BY random()) AS pick "
                        + FROM_CHUNKS + " WHERE f.status = 'READY' AND " + where("c", scope)
                        + ") picked WHERE picked.pick <= ?",
                HIT, scope.userId(), scopeId(scope), perFile);
    }

    public long readyFiles(Scope scope) {
        Long count = jdbc.queryForObject("SELECT count(*) FROM bank_files f WHERE " + where("f", scope)
                + " AND f.status = 'READY'", Long.class, scope.userId(), scopeId(scope));
        return count == null ? 0 : count;
    }

    public long chunkCount(Scope scope, long excludingFileId) {
        Long count = jdbc.queryForObject("SELECT count(*) FROM bank_chunks c WHERE " + where("c", scope)
                + " AND c.file_id <> ?", Long.class, scope.userId(), scopeId(scope), excludingFileId);
        return count == null ? 0 : count;
    }

    private List<Hit> hydrate(List<Nearest.Scored> best) {
        if (best.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(", ", Collections.nCopies(best.size(), "?"));
        Map<Long, Hit> byId = jdbc.query("SELECT " + HIT_COLUMNS + ", 0.0 AS score " + FROM_CHUNKS
                        + " WHERE c.id IN (" + placeholders + ")", HIT,
                        best.stream().map(Nearest.Scored::id).toArray())
                .stream()
                .collect(Collectors.toMap(Hit::chunkId, hit -> hit));
        return best.stream()
                .filter(scored -> byId.containsKey(scored.id()))
                .map(scored -> byId.get(scored.id()).withScore(scored.score()))
                .toList();
    }

    private static String where(String alias, Scope scope) {
        return alias + ".user_id = ? AND " + alias + (scope.isCourse() ? ".course_id" : ".chat_id") + " = ?";
    }

    private static long scopeId(Scope scope) {
        return scope.isCourse() ? scope.courseId() : scope.chatId();
    }

    private static float[] toPrimitive(Float[] values) {
        float[] out = new float[values.length];
        for (int i = 0; i < values.length; i++) {
            out[i] = values[i];
        }
        return out;
    }

    private static Float[] boxed(float[] values) {
        Float[] out = new Float[values.length];
        Arrays.setAll(out, i -> values[i]);
        return out;
    }

    static final class Nearest {

        record Scored(long id, double score) {
        }

        private static final Comparator<Scored> WORST_FIRST = Comparator.comparingDouble(Scored::score)
                .thenComparing(Comparator.comparingLong(Scored::id).reversed());
        private static final Comparator<Scored> BEST_FIRST = WORST_FIRST.reversed();

        private final float[] unitQuery;
        private final int limit;
        private final PriorityQueue<Scored> heap;

        Nearest(float[] query, int limit) {
            if (limit < 1) {
                throw new IllegalArgumentException("A nearest search needs a limit of at least 1");
            }
            this.unitQuery = unit(query);
            this.limit = limit;
            this.heap = new PriorityQueue<>(limit, WORST_FIRST);
        }

        void offer(long id, float[] vector) {
            if (vector.length != unitQuery.length) {
                throw new IllegalArgumentException("Embedding has " + vector.length + " dimensions, expected "
                        + unitQuery.length);
            }
            Scored candidate = new Scored(id, dot(unitQuery, vector));
            if (heap.size() < limit) {
                heap.add(candidate);
            } else if (WORST_FIRST.compare(heap.peek(), candidate) < 0) {
                heap.poll();
                heap.add(candidate);
            }
        }

        List<Scored> best() {
            List<Scored> sorted = new ArrayList<>(heap);
            sorted.sort(BEST_FIRST);
            return sorted;
        }

        private static float[] unit(float[] vector) {
            double squares = 0;
            for (float value : vector) {
                squares += (double) value * value;
            }
            float[] unit = new float[vector.length];
            if (squares == 0) {
                return unit;
            }
            double scale = 1 / Math.sqrt(squares);
            for (int i = 0; i < vector.length; i++) {
                unit[i] = (float) (vector[i] * scale);
            }
            return unit;
        }

        private static double dot(float[] a, float[] b) {
            double sum = 0;
            for (int i = 0; i < a.length; i++) {
                sum += (double) a[i] * b[i];
            }
            return sum;
        }
    }
}
