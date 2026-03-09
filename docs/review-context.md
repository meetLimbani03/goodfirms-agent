# Review Context

## Purpose

The review context step builds one canonical software-review context object from:

- MongoDB `goodfirms.software-reviews`
- MongoDB `software-review-request` when linked
- MySQL `GoodFirms.users`
- MySQL `GoodFirms.reviewer_emails_unverified`

This context is the shared source for:

- agent input
- audit/export files
- evaluation runs

The goal is to avoid maintaining separate data-assembly logic for runtime prompts and testing.

## Command

From the repo root:

```bash
pnpm context <software_review_mongo_id> -- --projection audit
```

Example:

```bash
pnpm context 64a818d320a48ecc5004f402 -- --projection audit
```

You can also run the built CLI directly:

```bash
pnpm build
node dist/context-cli.js 64a818d320a48ecc5004f402 --projection audit
```

## Projections

Supported projections:

- `agent`
- `audit`
- `evaluation`

Default projection:

- `audit`

Meaning:

- `agent`
  - only data that is safe to send to the review-analysis model
  - must not include historical outcome or admin-only metadata
- `audit`
  - agent-visible content plus internal metadata for human inspection
- `evaluation`
  - agent-visible content plus separated ground-truth fields for scoring and comparison

## Output

Default output directory:

```text
docs/batches/review-context
```

You can override it:

```bash
pnpm context <review_id> -- --projection audit --out docs/batches/review-context
```

Generated file naming:

```text
<review_id>.<projection>.md
```

Example:

```text
docs/batches/review-context/64a818d320a48ecc5004f402.audit.md
```

## Markdown Structure

The markdown export is intentionally split into sections:

- `Internal Only Metadata`
  - fields not meant for the agent
  - example: status, rejection reason, timestamps, request token
- `Agent-Visible Summary`
  - the human-readable summary of what the model may use
- `Agent Payload Projection`
  - the exact structured projection
- `Ground Truth`
  - included only in non-agent exports

Rule:

- anything not meant for the model must stay in internal-only sections and must not appear in the `agent` projection

## Data Included

Current software-review context includes:

- review lifecycle fields
- software name/slug/categories
- usage fields
- review title/summary/strength/weakness/ratings
- reviewer profile fields
- reviewer account enrichment from MySQL
- inferred login method
- trust signals and risk hints
- request/invite linkage when available

## Config

The command uses the normal app config loader.

Mongo:

- `MONGODB_URI` from `.env`

MySQL:

- first from env vars if present:
  - `MYSQL_HOST`
  - `MYSQL_PORT`
  - `MYSQL_USER`
  - `MYSQL_PASS`
  - `MYSQL_DB`
- otherwise from:
  - `.codex/config.toml`
  - section: `[mcp_servers.dumped-goodfirms-mysql.env]`

## Implementation

Main files:

- [src/context-cli.ts](/home/ubuntu/Desktop/goodfirms-agent/src/context-cli.ts)
- [src/review-context.ts](/home/ubuntu/Desktop/goodfirms-agent/src/review-context.ts)
- [src/mysql.ts](/home/ubuntu/Desktop/goodfirms-agent/src/mysql.ts)
- [src/mongo.ts](/home/ubuntu/Desktop/goodfirms-agent/src/mongo.ts)
- [src/config.ts](/home/ubuntu/Desktop/goodfirms-agent/src/config.ts)

## Notes

- Current implementation is software-review only.
- This context step should be reused by the main review agent pipeline rather than rebuilding prompt input separately.
