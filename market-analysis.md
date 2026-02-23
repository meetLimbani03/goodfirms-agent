Research Findings: Similar Agents & Tools in the Wild
  TL;DR                                                                                                                                                                                                                                                                                                                             No one has built this exact thing for B2B agency review preparation (GoodFirms/Clutch). The space is split into two camps — enterprise platforms doing their
  own internal moderation and tools doing review response generation. The full pipeline you want (intake → enhance → comply → score → human approve →
  publish-ready) as an internal agent does not exist as a product or open source project.

  ---
  1. Enterprise Platforms Doing Parts of This Internally

  These companies built similar pipelines for themselves to protect their own platforms — not sold as tools:

  Trustpilot

  Most architecturally similar to your requirements.
  - In 2024 they added generative AI for guideline violation detection at scale
  - ML models detect: unnatural language, review spikes, purchase signals, network anomalies
  - Pipeline: automated detection → community flagging → human "Content Integrity Team" → removal
  - Removed 4.5M fake reviews in 2024 — 90% caught automatically
  - What they built is essentially your Compliance + Authenticity nodes, but at platform scale

  Bazaarvoice

  - Multi-layer approach: automated filters + pattern analysis across their entire network + human moderators
  - Uses behavior signals (IP patterns, timing, relationship analysis between reviewer and business)
  - Introduced "Intelligent Trust Mark" — a real-time per-page authenticity score (very similar to your authenticity_confidence score)
  - Human moderators handle 750K+ pieces of UGC per week
  - Architecture: automated pre-filter → scored risk queue → human review for borderline cases

  PowerReviews

  - Automated filtering + human verification pipeline
  - Detects sentiment/rating contradiction (e.g., glowing text with 1-star rating)
  - JavaScript device reputation fingerprinting to catch bots
  - Duplicate review detection before publishing
  - Explicit Approve/Reject workflow with policy labels

  Yotpo

  - AI moderation with profanity filters, spam detection, suspicious activity flagging
  - Supports both automatic approval and manual review queues
  - Verified-purchaser badge system (your "authenticity confidence" analog)
  - FTC-compliance checks built in

  Gap vs. your requirements: All of these are platform-side (protecting review platforms FROM bad reviews). Your requirement is supplier-side (helping an agency
  prepare better reviews FOR submission). None of them do text enhancement or narrative restructuring.

  ---
  2. Tools Doing Review Response (Enhancement Side Only)

  Widewail

  - Integrates with CRM/POS to pull customer data
  - Uses prompt engineering + ChatGPT to generate review responses personalized per customer
  - Human revision step before publishing
  - Sentiment analysis to tone-match responses
  - Gap: Generates responses to reviews, not enhancement of the review itself

  Birdeye

  - Aggregates reviews from 150+ platforms into one dashboard
  - Sentiment analysis, topic extraction
  - AI-powered review request campaigns
  - Gap: Collection + response — no enhancement or compliance pipeline for submitted text

  GatherUp / NiceJob / Cloutly

  - Review collection automation (SMS/email drip campaigns)
  - NPS + satisfaction scoring
  - Gap: Collection tools only — zero AI processing of the review content itself

  ---
  3. Open Source — Closest Matches

  Project: conversationai/conversationai-moderator (Google)
  What it does: Human-assisted content moderation toolkit, ML scoring + human queue
  Gap: No text enhancement, no B2B review context
  ────────────────────────────────────────
  Project: companiai/modcandy
  What it does: Toxicity/profanity scoring for UGC
  Gap: Only safety layer, no pipeline
  ────────────────────────────────────────
  Project: utilityfueled/content-checker
  What it does: Open source AI content moderation
  Gap: Detection only
  ────────────────────────────────────────
  Project: Medium: LangGraph PR Review Agent
  What it does: Multi-node LangGraph agent for code review with human loop
  Gap: Code review domain, but same architectural pattern

  Nothing on GitHub matches the full pipeline: intake → sentiment → compliance → PII → fake detection → enhance → human approval → audit log.

  ---
  4. No-Code Approaches Seen in the Wild

  n8n comes closest for DIY builders:
  - Supports LLM node → condition branch → human approval pause → output
  - Community has templates for "AI + human-in-loop" content workflows
  - But it's a general automation tool, not purpose-built for this

  ---
  What This Means for You

  ┌─────────────────────────────────┬───────────────┬───────────────┬─────────┬──────────┬─────────────┬────────────┐
  │             Feature             │  Trustpilot   │  Bazaarvoice  │  Yotpo  │ Widewail │ Open Source │ Your Agent │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Raw text intake + validation    │ -             │ -             │ -       │ -        │ -           │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Sentiment + topic analysis      │ ✅            │ ✅            │ partial │ ✅       │ partial     │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Fake/spam/duplicate detection   │ ✅            │ ✅            │ ✅      │ -        │ partial     │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ PII detection                   │ partial       │ partial       │ -       │ -        │ -           │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Compliance/safety moderation    │ ✅            │ ✅            │ ✅      │ -        │ partial     │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Authenticity confidence score   │ ✅            │ ✅            │ partial │ -        │ -           │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Text enhancement / rewriting    │ ❌            │ ❌            │ ❌      │ ❌       │ ❌          │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ GoodFirms structure enforcement │ ❌            │ ❌            │ ❌      │ ❌       │ ❌          │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Human approve/edit/reject UI    │ internal only │ internal only │ partial │ partial  │ partial     │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ Audit log                       │ ✅            │ ✅            │ -       │ -        │ -           │ ✅         │
  ├─────────────────────────────────┼───────────────┼───────────────┼─────────┼──────────┼─────────────┼────────────┤
  │ B2B agency context              │ ❌            │ ❌            │ ❌      │ ❌       │ ❌          │ ✅         │
  └─────────────────────────────────┴───────────────┴───────────────┴─────────┴──────────┴─────────────┴────────────┘

  The text enhancement + GoodFirms-structure enforcement + supplier-side workflow combination is genuinely novel. The closest real-world analog architecturally
  is Trustpilot's internal pipeline (moderation + human queue), but the enhancement/rewriting half doesn't exist anywhere as a product.
