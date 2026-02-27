## New patterns not covered
- Repeated blank/zero-score submissions (two entries from `MUFEEDA KP` at `docs/batches/software_rejected_batch7_from_2023-07-01_humanized.json:7` and `:8`) escape the “gibberish/placeholder” rule because no text exists at all—just a form with every narrative field and rating set to empty/0. We need a concrete guard against abandoned placeholder submissions that still clear the upstream completeness gate.
- The `Saviom` review (`docs/batches/software_rejected_batch7_from_2023-07-01_humanized.json:6`) is marked “Reviews are accepted only from clients”, yet the submitter lists the vendor itself (same company name, marketing title, vendor website/email). There is no explicit rule banning vendor-employee testimonials, so these sneaky self‑endorsements keep slipping through.

## Redundant rules to remove
- The toggle “If title mismatches summary … rewrite title, do not reject” at `docs/review-verification-steps.md:121` simply restates the guidance already established in section 1.2 (`docs/review-verification-steps.md:27-31`). Removing the duplicate keeps the toggle list focused on real decision points.

## Exact proposed text edits
- `docs/review-verification-steps.md:25` — add a bullet after “Reject/flag if text is mostly random tokens…”:  
  “- Reject submissions where title/body/strength/weakness are all empty and every rating is 0, because these blank/zero-score forms (e.g., the two identical Desklog records) are abandoned placeholders rather than reviews.”
- `docs/review-verification-steps.md:58` — append to the software-specific checks right after “Client-relationship plausibility…”:  
  “- Reject or escalate when the reviewer’s company name/email/domain matches the software vendor (or the stated role is marketing/operations inside the vendor), since these are vendor self-reviews and not third-party clients.”