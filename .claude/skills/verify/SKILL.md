---
name: verify
description: Build, launch, and drive Studily locally to verify backend/API changes end-to-end.
---

# Verify Studily

## Launch

Local Postgres must be up (`pg_isready -h localhost -p 5432`; db `studily`, user/pass `postgres`).

```bash
./mvnw -q spring-boot:run -Dspring-boot.run.jvmArguments="-Dserver.port=8081"
```

Run in background; wait for `curl -s http://localhost:8081/actuator/health` → `"status":"UP"` (~20s). Port 8081 avoids clashing with a dev instance on 8080. Frontend build is not needed to drive the API.

## Drive

- Get a JWT: `POST /api/auth/signup` with `{email, username, password, name}` → `.token`. Use `vtest*@example.com` emails so cleanup is easy.
- New accounts are unverified; friends/conversations/WS reject them. Flip with:
  `PGPASSWORD=postgres psql -h localhost -U postgres -d studily -c "UPDATE users SET email_verified=true WHERE email='...';"`
- REST: `curl -H "Authorization: Bearer $TOK"`.
- WebSocket handshake check via curl (expect `HTTP/1.1 101` and `Sec-WebSocket-Protocol: studily` echoed):
  `curl -s -i -m 3 -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" -H "Origin: http://localhost:5173" -H "Sec-WebSocket-Protocol: studily, $TOK" http://localhost:8081/ws`
  Origin must be `http://localhost:5173` or the handshake 403s. Auth is subprotocol-header first, `?token=` query fallback.
- Full WS frames: no websocket client libs installed; a raw-socket Python script (handshake + masked text frames) works — send `{"type":"ping"}` expect `{"type":"pong"}`.

## Cleanup

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d studily -c "DELETE FROM users WHERE email LIKE 'vtest%@example.com';"
pkill -f "com.rnave.studily.StudilyApplication"
```

User rows cascade to their data. Rate limiters are in-memory; restart the app to reset a tripped limiter.
