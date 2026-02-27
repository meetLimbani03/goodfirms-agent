# Project Structure

```
goodfirms-agent/
├── docs/
│   ├── Goodfirms Review Agent.pdf          // pdf file with full project scope
│   ├── Goodfirms Review Agent.txt          // txt file with full project scope
│   ├── db-knowledge.md
│   ├── live-service-review-schema.md
│   ├── live-software-review-schema.md
│   ├── review-verification-steps.md
│   ├── batches/                            // batches for analysis
│   └── research/
│       ├── initial-plan-and-research.md    // LangGraph architecture plan + latency analysis
│       └── market-analysis.md
├── data/                                   // exports + local MySQL dump/snapshot files
│   ├── gf.sql
│   ├── gf_fixed.sql
│   ├── html/
│   │   ├── service_reviews.html
│   │   ├── service_reviews_page2.html
│   │   ├── software_reviews.html
│   │   └── software_reviews_page2.html
│   └── jsons/
│       ├── service_reviews.json
│       ├── service_reviews_page2.json
│       ├── software_reviews.json
│       └── software_reviews_page2.json
├── form-ui/
│   ├── product/
│   │   ├── 1.png
│   │   ├── 2.png
│   │   └── 3.png
│   └── service-project/
│       ├── 1.png
│       ├── 2.png
│       └── 3.png
├── AGENTS.md -> CLAUDE.md                  // symlink
├── .mcp.json                               // MCP server config (MongoDB)
└── .gitignore
```

# Concise Scope

- Build an AI assistant to review and improve GoodFirms client review text while preserving factual meaning and authentic sentiment.
- Ingest review input from forms/email/CRM notes, validate required fields, and normalize into a standard schema.
- Run quality, sentiment, completeness, authenticity, and compliance checks (spam/duplicates/PII/toxicity/policy risk).
- Produce an enhanced draft plus original-vs-enhanced comparison and a short rationale for edits.
- Route each review through human approval (approve, edit, reject) with decision/audit logging.
- Out of scope for current version: direct posting to GoodFirms and non-text assets (images/videos/large attachments).

- Refer to latest LangGraph documentation for best practices (use `langchain-chat-docs-research` skill).

# Business Context

- As of **2026-02-27**:
  - MongoDB MCP is reachable (`prod-goodfirms-mongo`).
  - Production MySQL MCP (`Prod-goodfirms-mysql`) is currently not reachable (`Transport closed`).
  - MySQL workaround: use local DB `GoodFirms` imported from `data/gf.sql` snapshot.
  - Snapshot timestamp from dump footer: `2026-02-17 02:26:06` (`-- Dump completed on 2026-02-17  2:26:06`).
  - Snapshot age: **10 days old** as of `2026-02-27`.

- There are only 2 new login/signup methods:
  - Google
  - LinkedIn
- Old vendors can sign in using their email.

## Review Types

There are 2 types of reviews:
- **Software reviews** — for software products
- **Service reviews** — for service-based companies
