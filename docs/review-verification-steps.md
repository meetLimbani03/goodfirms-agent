# Review Verification Steps (Draft Policy)

## Goal
Define what the agent should verify for:
- Software reviews
- Service reviews
- Reviewer authenticity (LinkedIn vs Google login context)
- Web fact-check behavior

This is live-flow only (new reviews), not legacy backfill.
Only reviews that already pass upstream completeness pre-checks are sent to this agent policy.

Operational note (as of 2026-02-27):
- Production MySQL MCP (`Prod-goodfirms-mysql`) is currently not reachable.
- For service-review DB checks, use local `GoodFirms` imported from `data/gf.sql` (dump completed `2026-02-17 02:26:06`, 10 days old as of 2026-02-27).

## 1) Common Checks (Both Review Types)

### 1.1 Content readability and coherence
- Reviewer identity text should not be gibberish:
  - `reviewer_name` / `client_name`
  - company name
  - role/position
- Review text should be readable, coherent, and non-random.
- Reject/flag if text is mostly random tokens, repeated junk, nonsensical strings, or placeholder-only content.
- Reviews should be in English; non-English submissions require translation/manual handling before standard review checks.

### 1.2 Title-summary consistency
- Title must represent the review body.
- If title is vague/misaligned but body is valid:
  - do not reject
  - rewrite title to match review content.

### 1.3 Internal consistency of claims
- Review details should not contradict themselves.
- Ratings should align with narrative tone:
  - major mismatch (e.g., all 5-star + strongly negative body) => flag.

### 1.4 Minimal rewrite scope
- Fix grammar/clarity only.
- Preserve factual meaning and sentiment.
- Do not invent claims.

### 1.5 Duplicate-submission check
- Flag if same reviewer (email/profile) submits multiple reviews for the same software/service with empty or near-identical content in a short window.
- Reject if review text is already published previously for the same product, even outside the short-window duplicate scenario.

## 2) Software Review Specific Checks

- Software name relevance:
  - body should clearly discuss the named software use/experience.
- Usage context plausibility:
  - duration/frequency/pricing should make contextual sense with text.
- Strength/weakness quality:
  - should be specific enough to be useful; not pure filler.
- Strength/weakness separation:
  - “strength” and “weakness” should not be near-identical copy-paste text.
- Flag if software description feels generic and could apply to any random product with no concrete detail.
- Client-relationship plausibility:
  - content should read like a client/user experience, not vendor self-promotion or non-client commentary.
  - if reviewer company/email domain appears to match the reviewed vendor, treat as potential vendor self-review and require stronger independent proof before pass.
  - reject/flag reviews from current or former vendor staff/ambassadors unless independent evidence proves a real client relationship.
- Reject/flag reviews containing unrelated promotional/affiliate links that are not relevant to the reviewed product experience.

## 3) Service Review Specific Checks

- Project context alignment:
  - project title/description, service category, and review body should align.
- Experience specificity:
  - review should mention concrete delivery/process/outcome elements.
- Q&A consistency:
  - “most liked” and “least liked” should not be near-identical boilerplate.

## 4) Reviewer Verification Logic

## 4.1 If LinkedIn profile URL is available
- Perform web verification:
  - profile exists and is accessible.
  - name similarity with submitted reviewer name.
  - company and role consistency (exact or close match accepted).
- If mismatch is strong:
  - flag as authenticity risk (manual review).

## 4.2 If no LinkedIn profile (Google login or unavailable)
- Use softer checks:
  - email domain vs company website/domain consistency (if company website provided).
  - reviewer name/company/role plausibility from public web mentions.
- Personal email domains are allowed (`gmail`, `outlook`, etc.):
  - do not hard-fail solely for personal email.
  - only add small authenticity risk signal if other evidence is weak.
- If `hidden_identity` limits visible identity context, require stronger corroboration (company-domain/public-profile evidence); otherwise route to `needs_manual_review`.

## 4.3 Suggested evidence tiers
- `High`: direct LinkedIn/work profile match or strong company page evidence.
- `Medium`: partial match (name + company, role uncertain).
- `Low`: no reliable external confirmation.

## 6) Outcome Labels (recommended)

- `verified_pass`
- `verified_with_minor_fixes` (grammar/title rewrite only)
- `needs_manual_review` (authenticity uncertainty or major inconsistency)
- `reject_recommended` (clear spam/gibberish/fabrication signals)
