 Recommended Architecture

  Framework: LangGraph

  Why LangGraph over alternatives:

  ┌───────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Framework │                                             Verdict                                              │
  ├───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ LangGraph │ Best fit — stateful graph with conditional routing, native human-in-the-loop support             │
  ├───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ LangChain │ Better for simple linear chains; no good branching/state management                              │
  ├───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ CrewAI    │ Designed for multi-agent collaboration; overkill here — no agents need to coordinate in parallel │
  └───────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┘

  The processing pipeline has sequential steps with conditional routing (e.g., skip enhancement if "High risk") and a human-in-the-loop pause — LangGraph was
  built exactly for this.

  ---
  Component Stack

  ┌─────────────────────┬───────────────────────────────────────────┬──────────────────────────────────────────────┐
  │        Layer        │               Tool/Service                │                     Role                     │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ API Gateway         │ FastAPI                                   │ Input ingestion from forms/CRM/email         │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Workflow Engine     │ LangGraph                                 │ Orchestrates all processing nodes            │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ LLM                 │ Claude (claude-sonnet-4-6)                │ Enhancement, sentiment, compliance, scoring  │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ PII Detection       │ Microsoft Presidio                        │ Emails, phones, addresses redaction          │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Content Moderation  │ OpenAI Moderation API or LlamaGuard       │ Hate/abuse/NSFW/threats layer                │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Duplicate Detection │ Sentence-Transformers + cosine similarity │ Near-duplicate review flagging               │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Vector Store        │ ChromaDB (local) or Pinecone (cloud)      │ Stores review embeddings for dup check       │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Database            │ PostgreSQL                                │ Review records, audit logs, decision history │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Task Queue          │ Celery + Redis                            │ Async processing for non-blocking API        │
  ├─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────────┤
  │ Internal UI         │ Streamlit or React                        │ Review card dashboard for human approval     │
  └─────────────────────┴───────────────────────────────────────────┴──────────────────────────────────────────────┘

  ---
  Data Flow

  INPUT
   │
   ▼
  [FastAPI Endpoint]
   │  Accepts: form POST / API call / CRM webhook
   │  Action: validates mandatory fields, sanitizes text, normalizes → JSON schema
   │
   ▼
  [Celery Queue] ─── enqueues job, returns job_id to caller
   │
   ▼
  [LangGraph Workflow] ───────────────────────────────────────────────────────────
   │
   ├── Node 1: DUPLICATE CHECK
   │    Embeds incoming review, compares against vector store
   │    → Flag if similarity > threshold
   │
   ├── Node 2: CONTENT ANALYSIS
   │    LLM extracts: sentiment, topics (communication/quality/ROI/timeliness)
   │    LLM scores: completeness & clarity (0–100)
   │
   ├── Node 3: COMPLIANCE & SAFETY MODERATION
   │    Presidio → PII scan
   │    Moderation API → hate/abuse/NSFW/threats
   │    LLM → platform rules (fake testimonials, competitor bashing, unverifiable claims)
   │
   ├── Node 4: AUTHENTICITY SCORING
   │    Heuristics: extreme rating + vague text, mismatched project details
   │    LLM: pattern analysis → authenticity_confidence (0–1) + reasons
   │
   ├── Conditional Router ──────────────────────────────────────────────────────
   │    "High risk"     → skip enhancement → flag for human review/reject
   │    "Borderline"    → proceed to enhancement → flag for mandatory human review
   │    "Safe"          → proceed to enhancement → flag for light human review
   │
   ├── Node 5: ENHANCEMENT (skipped if High risk)
   │    LLM rewrites: grammar, coherence, narrative flow
   │    Enforces structure: context → problem → solution → delivery → outcomes → recommendation
   │    Stores: original + enhanced + diff explanation
   │
   └── Node 6: HUMAN-IN-THE-LOOP PAUSE
        Writes review card to PostgreSQL (status: "pending_review")
        Notifies internal reviewer via UI
  ───────────────────────────────────────────────────────────────────────────────
   │
   ▼
  [Internal Dashboard — Streamlit/React]
   │  Displays: key fields, sentiment, risk flags, authenticity score, side-by-side diff
   │  Actions: Approve / Edit then Approve / Reject with reason
   │
   ▼
  [PostgreSQL Audit Log]
   │  Stores: decision, edits made, reviewer ID, timestamp, model version, labels + justifications
   │
   ▼
  OUTPUT
   Final review text → copied manually to GoodFirms

  ---
  Key Design Decisions

  1. Async processing via Celery — decouples the API response from LLM processing time, keeps the 3s SLA internal
  2. LangGraph state object carries the full review context across all nodes — each node reads/writes to shared state, enabling clean conditional routing
  3. Graceful degradation — if enhancement model is unavailable, LangGraph catches the error and routes directly to human review with analysis-only results
  4. Vector store is the only stateful external dependency at runtime — all other nodes are stateless LLM calls, making scaling straightforward





 The 3-Second Problem

  Sequential Latency Reality

  ┌───────────────────────────────────────┬────────────────────────────────┬───────────────────┐
  │                 Step                  │              Tool              │ Realistic Latency │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Validation + normalization            │ Code only                      │ ~50ms             │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Embedding generation                  │ Sentence-transformers / OpenAI │ ~200–500ms        │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Vector store lookup (duplicate check) │ ChromaDB / Pinecone            │ ~20–50ms          │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Content analysis LLM call             │ Claude/GPT-4                   │ ~800ms–2s         │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ PII scan                              │ Presidio (local)               │ ~100–200ms        │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Moderation API                        │ OpenAI Moderation API          │ ~200–400ms        │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Compliance LLM call                   │ Claude/GPT-4                   │ ~700ms–1.5s       │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Authenticity scoring LLM call         │ Claude/GPT-4                   │ ~700ms–1.5s       │
  ├───────────────────────────────────────┼────────────────────────────────┼───────────────────┤
  │ Enhancement LLM call                  │ Claude/GPT-4                   │ ~1.5s–3s          │
  └───────────────────────────────────────┴────────────────────────────────┴───────────────────┘

  Sequential total: 5–10 seconds. Nowhere near 3s.

  ---
  Even With Aggressive Parallelism

  The best you can do is parallelize everything that doesn't depend on each other:

  [Validation ~50ms]
          ↓
    ┌─────────────────────────────────────────┐
    │  Run in parallel:                       │
    │  - Embedding + vector lookup (~400ms)   │
    │  - PII scan (Presidio local) (~150ms)   │
    │  - Moderation API (~300ms)              │
    │  - Combined analysis+compliance+        │
    │    authenticity in ONE LLM prompt       │
    │    (fastest model, Haiku) (~700ms–1.2s) │
    └─────────────────────────────────────────┘
          ↓ wait for slowest (~1.2s)
    [Classify: Safe / Borderline / High Risk]
          ↓
    [Enhancement LLM call (~1.5s–3s)]

  Best case total: ~2.7–4.5s

  And that's p50. At p95 (network jitter, cold starts, API variance), you're looking at 6–8 seconds.

  ---
  The Real Bottleneck

  Enhancement alone kills the SLA. Generating a fully rewritten 150–300 word review at ~50 tokens/second output speed takes 2–4 seconds by itself, regardless of
  everything else. You can't parallelize it because it needs the classification result first.

  ---
  What the 3-Second Requirement Should Actually Mean

  The requirement needs to be split into two SLAs:

  ┌───────────────────────────────────────────────────────┬─────────────────────────┬────────────────────────────────────────────────┐
  │                         Phase                         │      Realistic SLA      │               What the user gets               │
  ├───────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────┤
  │ Analysis phase (validate + detect + score + classify) │ ≤ 2s                    │ Risk classification, flags, authenticity score │
  ├───────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────┤
  │ Enhancement phase (rewrite + structure)               │ ≤ 6–8s total end-to-end │ Enhanced text + diff                           │
  └───────────────────────────────────────────────────────┴─────────────────────────┴────────────────────────────────────────────────┘

  Recommended Fix: Two-Stage Async Response

  API call received
        ↓
  Return 202 Accepted + job_id immediately (~50ms)
        ↓
  Background worker runs full pipeline
        ↓
  Stage 1 result pushed to UI in ~1.5–2s
  (classification card visible, reviewer can already reject)
        ↓
  Stage 2 result pushed to UI in ~5–8s total
  (enhanced text appears, reviewer can approve/edit)

  This is how Widewail, Yotpo, and Bazaarvoice actually work in practice — they return a job ID immediately and push results via webhook/websocket as they
  complete. The "≤ 3 seconds" in the requirements doc is simply not achievable for a full synchronous pipeline with LLM enhancement included.

  The 3s requirement should be revised to: analysis + classification in ≤ 2s, full enhancement ready in ≤ 8s, with async delivery so the UI never feels blocked.
