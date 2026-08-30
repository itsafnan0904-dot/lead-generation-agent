# Local Docker Infrastructure

This directory contains container configurations for local development infrastructure services.

## Services Included

| Service | Image | Default Port | Volume / Data |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `postgres:16-alpine` | `5432` | `ai_sales_agent_postgres_data` |
| **Redis** | `redis:7-alpine` | `6379` | `ai_sales_agent_redis_data` |

## Environment Variables & Defaults

The compose file loads environment variables directly or falls back to safe local development defaults:
- `POSTGRES_USER` (default: `postgres`)
- `POSTGRES_PASSWORD` (default: `postgres`)
- `POSTGRES_DB` (default: `ai_sales_agent`)
- `POSTGRES_PORT` (default: `5432`)
- `REDIS_PORT` (default: `6379`)

Connection strings for local apps:
- Database: `postgresql://postgres:postgres@localhost:5432/ai_sales_agent?schema=public`
- Redis: `redis://localhost:6379`

## Managing the Stack

### Start the Services
From the repository root:
```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### Check Container Status
```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
```

### Stop the Services
```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

### Stop and Wipe Volumes (Fresh Start)
```bash
docker compose -f infrastructure/docker/docker-compose.yml down -v
```
