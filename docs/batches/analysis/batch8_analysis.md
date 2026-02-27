### New patterns not covered
- `docs/batches/software_rejected_batch8_from_2023-07-01_humanized.json` entries 1‑8 and 10 all set `hidden_identity=1`, supply only personal Gmail addresses, and lack LinkedIn/company profile URLs, yet are flagged “Unable to verify the reviewer” despite coherent reviews; the policy never mentions how to treat hidden-identity submissions, so agents default to rejection without guidance on what alternative evidence would suffice.  
- Entry 9 shows a credible company email/website pair (`kristen@kellyclosets.com`, `https://zeststudio.co/`) but still fails verification purely because no LinkedIn link was provided; the policy only says to “use softer checks” without naming the concrete checkpoints (website, domain match, company directory) that would upgrade confidence from low/unknown to medium.

### Redundant rules to remove
- Section 1.5 (“Duplicate-submission check (this is hard, need it right now or skip for now?)”) is a placeholder with no implementation guidance and is never invoked in the batch analysis; drop it to avoid misleading downstream reviewers.

### Exact proposed text edits
- Delete the entire 1.5 subsection so the reader isn’t asked to act on a “skip for now” note that never produces reproducible behavior.  
- In section 4.2 (no LinkedIn profile), append:  
  > “If `hidden_identity` is truthy or the reviewer explicitly requested anonymity, treat the submission as privacy-sensitive—require at least one independent evidence point (e.g., company email/domain match, vendor directory entry, or validated support ticket) before advancing. Document the evidence and, if you cannot find anything beyond a personal email, mark the review as `needs_manual_review` rather than auto-rejecting or auto-approving.”  
- In section 5 (Web fact-check rules), add after the first bullet:  
  > “When a LinkedIn profile is missing but the reviewer provides a company website or corporate email, capture the domain match (email host vs. `client_company_website` host) and a supporting page (team/about/contact listing the reviewer or role). Treat a consistent domain + visible company page as ‘medium’ evidence and log it alongside the identity checks.”