## New patterns not covered
- Blank submissions keep reaching our squad even though every textual field is empty (title/summary/strength/weakness) and ratings stay at zero; see the records at `docs/batches/software_rejected_batch10_from_2023-07-01_humanized.json:4`, `...:9`, and `...:10`. We currently assume upstream completeness, but the agent still needs explicit guidance to reject or re-queue these non-submissions before attempting verification.
- A cluster of rejected entries (e.g., `...:1`–`...:3`, `...:5`–`...:8`) all supply only a personal Gmail/other free email, no LinkedIn, and no usable company-domain evidence despite claiming a client-company name. Section 4.2 only says “do not hard-fail personal emails,” so there is no guardrail telling the agent when the lack of any external traceable identity should escalate to manual review instead of being treated as borderline “low” evidence.

## Redundant rules to remove
- Section 4.3’s “Suggested evidence tiers” (lines 87‑90) simply restates the “evidence strength” capture that Section 5 (lines 94‑104) already mandates and the decision toggle in Section 7 that calls for medium evidence. Dropping 4.3 keeps the policy focused on action rather than duplicative definitions.
- The Section 7 toggle “If title mismatches summary … rewrite title, do not reject” (lines 121‑122) reiterates Section 1.2 (lines 27‑31). Once the common check already mandates rewriting when the body is valid, the toggle adds no extra value and can be removed.

## Exact proposed text edits
- At `docs/review-verification-steps.md:19`, extend “Content readability and coherence” with:
  ```
  - Reject or send back to completeness if title, summary, strength, and weakness are all empty/placeholder and ratings are zero, because those submissions (see docs/batches/software_rejected_batch10_from_2023-07-01_humanized.json:4,9,10) cannot be verified meaningfully.
  ```
- At `docs/review-verification-steps.md:79`, expand “If no LinkedIn profile” with:
  ```
  - If, after checking the optional company website/domain/IP lookup, the only supplied contact is a personal email and no other verifiable link exists, escalate to `needs_manual_review` (log “missing traceable identity”) rather than treating the submission as “low” evidence only.
  ```
- Remove the entire “## 4.3 Suggested evidence tiers” block at `docs/review-verification-steps.md:87-90`.
- Remove the last decision toggle bullet (the one starting “If title mismatches summary …”) at `docs/review-verification-steps.md:121-122`.