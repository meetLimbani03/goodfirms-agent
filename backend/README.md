# GoodFirms Backend

Minimal FastAPI backend scaffold managed with `uv` and Python `3.11`.

## Run

```bash
uv sync
uv run uvicorn app.main:app --reload
```

## Migrations

```bash
uv run alembic upgrade head
```

The backend expects PostgreSQL migrations to run against `POSTGRES_DSN`.

## Config

MongoDB:

- `MONGODB_URI` is used in both local and production.

MySQL:

- local/dev prefers `MYSQL_LOCAL_HOST`, `MYSQL_LOCAL_PORT`, `MYSQL_LOCAL_USER`, `MYSQL_LOCAL_PASS`, `MYSQL_LOCAL_DB`
- production prefers `MYSQL_PROD_HOST`, `MYSQL_PROD_PORT`, `MYSQL_PROD_USER`, `MYSQL_PROD_PASS`, `MYSQL_PROD_DB`
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB` work as a shared fallback in either environment
- local/dev also falls back to repo/tooling config when present: [../.mcp.json](/home/ubuntu/Desktop/goodfirms-agent/.mcp.json) or `~/.codex/config.toml`
- environment selection uses `APP_ENV` first, then `ENVIRONMENT`, then `ENV`; default is `local`

PostgreSQL:

- `POSTGRES_DSN` enables persistent run-record storage for agent invocations
- `DATABASE_URL` is supported as a fallback alias
- Alembic migrations read the same setting

CORS:

- `CORS_ALLOWED_ORIGINS` should be a JSON array of strings, for example `["http://localhost:5173"]`

SerpApi:

- `SERP_API_KEY` or `SERP_API` enables the agent's public web search tool
- `SERP_API_BASE_URL` is optional and defaults to `https://serpapi.com/search.json`
- local/dev also loads [../experiments/.env](/home/ubuntu/Desktop/goodfirms-agent/experiments/.env) as a fallback so the shared experimentation key can be reused for backend search-tool development

## Endpoint

- `GET /` -> `pong`
- `GET /health` -> MongoDB, MySQL, and PostgreSQL status
- `POST /api/software-reviews/{review_id}/agent-run` -> build software review agent context, invoke agent, return structured output
  - query param `test=true` bypasses the normal pending-status gate so approved/rejected reviews can be evaluated
  - when PostgreSQL is configured, each invocation is also persisted in `agent_runs`
- software and service agents can use:
  - `reviewer_review_history_lookup`
  - `public_web_search` when SerpApi is configured

## LLM Config

Required env vars:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

Optional env vars:

- `OPENROUTER_BASE_URL` default: `https://openrouter.ai/api/v1`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`

LangSmith tracing is expected to be configured through standard LangSmith environment variables in `backend/.env`.
