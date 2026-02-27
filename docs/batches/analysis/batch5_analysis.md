### New patterns not covered
- `docs/batches/software_rejected_batch5_from_2023-07-01_humanized.json` contains submissions (e.g., the Medicai Cloud PACS entry) with blank title/body/strength/weakness and zero scores but still routed for verification; the current “readability” guidance never explicitly rejects an empty payload, so we keep chasing these ghosts.
- The WebCEO entry in the same batch carries the human reason “Reviews are accepted only from clients of the company,” yet no rule currently enforces additional proof when a vendor explicitly limits reviews to verified customers; we need a policy hook that triggers manual-review/reject when the claimed policy cannot be satisfied with real evidence.

### Redundant rules to remove
- Section 5 (“Web Fact-Check Rules,” lines 92‑105) restates the same identity-verification checks already spelled out in sections 4.1‑4.2 and adds no new operational detail; keeping it simply duplicates guidance and makes the policy harder to navigate, so drop the whole section.

### Exact proposed text edits
1. `docs/review-verification-steps.md`: after line 25 (the placeholder content bullet under 1.1) add `- Reject/flag submissions where title/body/strength/weakness fields are empty or only whitespace/placeholder text, since they provide no actionable review content.`  
2. `docs/review-verification-steps.md`: after line 86 (end of the “personal email” note in 4.2) add `- When the vendor metadata or review text explicitly states that only verified clients may post reviews, require independent proof of that engagement (matching company email/domain, contract ref, case-study link, etc.); absence of proof becomes a manual-review/reject signal and should be logged as such.`  
3. `docs/review-verification-steps.md`: delete lines 92‑105 (the entire Section 5 “Web Fact-Check Rules”) to avoid duplicating the identity-verification guidance already captured in Section 4.