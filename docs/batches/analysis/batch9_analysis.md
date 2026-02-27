1. New patterns not covered by existing rules
- `docs/batches/software_rejected_batch9_from_2023-07-01_humanized.json:1` contains a submission with empty title/summary/strength/weakness fields and every rating set to `0`; the current policy only calls out gibberish, so add a guard that rejects placeholder-like reviews lacking both descriptive text and non-zero scores before wasting manual verification time.
- `docs/batches/...:4` has a “weakness” entry that literally copies a `[Friday 6:08 PM] Usama Nisar` chat testimonial instead of the reviewer’s own critique, while `docs/batches/...:10` duplicates the same paragraph across summary, strength, and weakness; we need an explicit expectation that strength/weakness describe the reviewer’s personal experience and are not pasted transcripts or verbatim repeats of other fields.

2. Redundant/overlapping rules to remove
- `docs/review-verification-steps.md:92-105` (“## 5) Web Fact-Check Rules”) largely reiterates the same verification/evidence-capturing steps already spelled out in sections 4.1–4.3 (`docs/review-verification-steps.md:71-91`); drop section 5 to avoid duplication and keep the policy lean.

3. Exact proposed text edits (if any)
- Under `### 1.1 Content readability and coherence` (lines 19‑26) insert: `- Reject submissions whose title, summary, strength, and weakness are all blank while every rating metric is zero; these look like placeholder/spam reviews and should not advance to human verification.`
- Within `## 2) Software Review Specific Checks` (lines 48‑58) add: `- Strength and weakness entries must reflect the reviewer’s own usage (no pasted chat logs, testimonials, or verbatim copies of the summary) so that each subfield provides distinct, reviewer-specific insight.` 
- Delete `## 5) Web Fact-Check Rules (Agent must browse)` and its bullets (lines 92‑105).