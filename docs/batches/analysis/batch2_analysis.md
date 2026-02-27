### New patterns not covered
- Placeholder/anonymous identity signals are everywhere. The two Ireava School ERP records and several others only carry `client_company_website` = `https://nowebsite.com`, no profile link, and a private relay/personal email (e.g., `privaterelay.appleid.com`, `gmail.com`). The agent still marked them “Unable to verify the reviewer,” yet the current policy doesn’t treat these placeholders as missing evidence. We need a rule that treats non‑resolving/generic URLs and proxy email domains as “no verification possible” (manual review) unless we can anchor the reviewer to a real company page or LinkedIn profile.
- Incomplete reviews leak through. Entries for Allway Sync (two consecutive submissions with the same email, one entirely blank) and Innago (step 1, zero ratings, empty summary) prove the upstream completeness claim is false. We need a metadata guard that inspects `step`, the presence of summary/title/ratings, and outright zeros and short‑circuits the flow into a `Review incomplete` outcome before touching the rest of the policy.
- Template spam across reviewers: the two Fresa Gold entries reuse the same summary/strength/weakness wording under different names/emails but still get flagged for verification. The policy has no cross-review duplicate detector, so this batch shows we also need a near‑duplicate rule for identical prose to catch coordinated positive campaigns.

### Redundant rules to remove
- The intro sentence “Only reviews that already pass upstream completeness pre-checks are sent to this agent policy” is demonstrably false in this batch; multiple records (`Allway Sync`, `Innago`) have `step` < 3, zero ratings, and empty texts yet landed here with reason `Review incomplete`. Remove that sentence so the policy stops assuming completeness is handled elsewhere and instead owns the gatekeeping.

### Exact proposed text edits
- **docs/review-verification-steps.md → Goal paragraph (line 6)**  
  Remove: “Only reviews that already pass upstream completeness pre-checks are sent to this agent policy.”  
  (Batch `docs/batches/software_rejected_batch2_from_2023-07-01_humanized.json` entries for Allway Sync/Innago prove this assertion wrong.)

- **docs/review-verification-steps.md → Section 1 “Common Checks”**  
  Add a new bullet after 1.1 or before 1.2:  
  `- Validate review metadata before any textual checks: if `step` < 3, `overall` (and the other ratings) are still 0, and/or title/summary/strength/weakness are blank, immediately classify the record as "Review incomplete" and skip the rest of the flow so we don’t verify partially submitted drafts.`

- **docs/review-verification-steps.md → Section 1.5 “Duplicate-submission check”**  
  Extend the bullet list with:  
  `- Extend the duplicate check beyond single reviewers: if multiple submissions for the same software reuse the same summary/strength/weakness phrasing (e.g., the two Fresa Gold reviews in this batch), treat them as templated/auto-generated content and send them to manual review even if reviewer metadata differs.`

- **docs/review-verification-steps.md → Section 4.2 “If no LinkedIn profile”**  
  Add:  
  `- Treat placeholder/generic URLs (e.g., `https://nowebsite.com`, other resolvers that return a parking page) or proxy/personal domains (such as `privaterelay.appleid.com`) as insufficient evidence. If the reviewer provides only these values, escalate the review unless alternate company/role confirmation is obtained via a genuine homepage or secondary profile.`