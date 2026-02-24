# Project Structure

```
goodfirms-agent/
├── docs/
│   ├── info.txt                            // key DB fields and publish_status codes
│   ├── Goodfirms Review Agent.pdf          // pdf file with full project Scope
│   ├── Goodfirms Review Agent.txt          // txt file with full project Scope
│   ├── reviews-response.html               // raw HTML from GET /administrator/reviews (page 1, ~380KB)
│   ├── reviews-page1.json                  // 20 structured review records extracted from page 1
│   └── research/
│       ├── initial-plan-and-research.md    // LangGraph architecture plan + latency analysis
│       └── market-analysis.md
├── db_data/                                // database files , the same that you have access through mcp tools
│   ├── gf.sql
│   └── goodfirms.archive
└── .gitignore
```

- Concise scope:
  - Build an AI assistant to review and improve GoodFirms client review text while preserving factual meaning and authentic sentiment.
  - Ingest review input from forms/email/CRM notes, validate required fields, and normalize into a standard schema.
  - Run quality, sentiment, completeness, authenticity, and compliance checks (spam/duplicates/PII/toxicity/policy risk).
  - Produce an enhanced draft plus original-vs-enhanced comparison and a short rationale for edits.
  - Route each review through human approval (approve, edit, reject) with decision/audit logging.
  - Out of scope for current version: direct posting to GoodFirms and non-text assets (images/videos/large attachments).

- refer to latest langgraph documentation for best practices ( can use langchain skill )


# Business Context

- there are only 2 new login/signup methods:
  - Google
  - LinkedIn

Old vendors can sign in using thier email.

There are 2 types of reviews:
- Software reviews
- reviews ( service based )