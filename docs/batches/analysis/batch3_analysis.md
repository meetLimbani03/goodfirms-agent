New patterns not covered
- Several rejections in `docs/batches/software_rejected_batch3_from_2023-07-01_humanized.json` (entries 2, 3, 4, 6, 7) contain no title or summary and zero overall score, yet they reach the agent (reason field either “Review incomplete” or blank). Section 1.1 currently only talks about gibberish text; we also need to gate on the presence of any meaningful body before invoking the verification flow.  
- Entry 5 (Rucha Shinde reviewing Thingsup IoT) keeps appearing with the rejection reason “Reviews are accepted only from clients of the company,” showing we still lack codified checks for vendor self‑reviews triggered by identical email domains.  
- Entries 1, 8, 9, 10 (Viren Shah, Radhika Sangaj, Sahid Afridi, Nick Furlow) are high‑rating software reviews that stayed in `step` 2/3 but couldn’t be confirmed because no LinkedIn or verifiable profile was ever supplied; policy 4.2 only encourages softer checks but never mandates escalation when evidence stays weak, so “Unable to verify the reviewer” keeps happening.

Redundant rules to remove
- Section 1.5’s “Duplicate-submission check” (lines 43‑45 in `docs/review-verification-steps.md`) reads more like a TODO (“this is hard…”). Batch 3 has no duplicate submissions, and our current failure modes are about missing identity/content, so keep policy lean by removing this speculative rule until we actually observe duplicate fraud.

Exact proposed text edits
- At `docs/review-verification-steps.md:19‑25`, add under “Content readability and coherence”:  
  `- Reject/flag reviews that arrive with both title and summary empty or whose body remains under ~40 non-whitespace characters after follow-ups; Batch software_rejected_batch3_from_2023-07-01_humanized.json entries 2/3/4/6/7 demonstrate the incomplete-review failure mode.`  
- Within the “Software Review Specific Checks” block (around `docs/review-verification-steps.md:48‑59`), append to the “Client-relationship plausibility” bullet:  
  `  - cross-check reviewer email domain with the reviewed vendor (e.g., @thingsup.io for Thingsup IoT); identical domains/home-company emails should be treated as vendor self‑reviews and rejected unless independent proof of client status exists.`  
- After the bullets in “If no LinkedIn profile…” (`docs/review-verification-steps.md:79‑85`), add:  
  `- If all evidence remains “Low” even after stage 2/3 (see Viren/Shah/Afridi/Furlow in software_rejected_batch3_from_2023-07-01_humanized.json), escalate to needs_manual_review with reason “Unable to verify the reviewer” instead of auto-approving; that prevents unverifiable high-rating submissions from slipping through.`