## New patterns not covered
- **Vendor self-review signal** – Batch entries `654a79109bb61c739a0f8d83`, `654a867232223aac8a034b24`, `654a98b4f7d3c9c0360a2bf2` all list `client_company_name: Success.ai` while reviewing Success.ai and were rejected with the note “Reviews are accepted only from clients of the company.” The policy currently only says “client-relationship plausibility” without explicitly catching cases where the reviewer’s stated employer is the same company (a classic self-review). We need a concrete rule that downgrades authenticity when `client_company_name` or email/domain matches the reviewed vendor.
- **Empty/zero placeholder submissions** – Entries `6538d55a339db2f305011154` and `653ffb283fe4dfd19b0ce6e8` show blank titles/summary/strength/weakness and zero scores for every rating, yet they reached the verification layer. The existing “upstream completeness” assumption was violated, so add a hard check for records that contain no narrative and all ratings at 0/empty; those should be rejected as incomplete placeholders before any new analysis.

## Redundant rules to remove
- Drop the Section 7 toggle “Should LinkedIn mismatch be hard reject or manual review? Recommended: manual review.” Section 4.1 already instructs that strong mismatches should become an authenticity flag/manual review, so the toggle merely rephrases that guidance without adding clarity.
- Remove the Section 7 toggle “Should personal email with no company-domain match be penalized strongly? Recommended: no hard penalty; treat as weak evidence only.” Section 4.2 already says personal email domains are allowed and should not trigger hard failure, making the toggle redundant.

## Exact proposed text edits
1. **Insert under “## 1) Common Checks (Both Review Types)” (after 1.5)**:
   ```
   ### 1.6 Placeholder/incomplete submissions
   - If `title`, `summary`, `strength`, and `weakness` are all empty/whitespace and every rating field (`ease_of_use`, `features_functionality`, `customer_support`, `overall`) is 0 or absent, treat the review as an incomplete placeholder.
   - Reject (`reject_recommended`) and log it immediately; these submissions bring no usable content even if other completeness checks erroneously forwarded them.
   ```
2. **Insert under “## 4) Reviewer Verification Logic” (after 4.3)**:
   ```
   ### 4.4 Vendor self-review detection
   - If the reviewer’s claimed company/email domain matches the software/service being reviewed (e.g., the Success.ai batch entries that listed Success.ai as the client company), downgrade the evidence tier and flag authenticity risk.
   - Reviews that read like promotional marketing while the reviewer identifies as the vendor should land in `needs_manual_review` or `reject_recommended`, because the claim set can’t be trusted without independent client confirmation.
   ```
3. **Remove from “## 7) Decision Toggles To Confirm”**:
   - The bullet “Should LinkedIn mismatch be hard reject or manual review? Recommended: manual review.”
   - The bullet “Should personal email with no company-domain match be penalized strongly? Recommended: no hard penalty; treat as weak evidence only.”