# Docker (optional)

**You do not need Docker Desktop** for local Peggy development. Use [LOCAL.md](LOCAL.md): native Qdrant + `./scripts/start-api.sh`.

Use Compose only if you already run Docker and want containers instead of host processes.

## When it helps

- Same environment as a future deployed API image
- You don’t want to install the Qdrant binary on macOS

## Commands

```bash
# From repo root — requires docker CLI + running daemon
docker compose up --build -d
cd apps/web && npm run dev
```

| Service | Port |
|---------|------|
| Qdrant | 6333 |
| peggy-api | 8000 |

After `requirements.txt` changes:

```bash
docker compose build peggy-api && docker compose up -d
```

## Check daemon (optional)

```bash
./scripts/check-docker.sh
```

## Stop / reset

```bash
docker compose down
docker compose down -v   # deletes qdrant + sqlite volumes
```
