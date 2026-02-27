Delta1: Common checks mention readability but not language, so no rule captures non-English rejects; record 65a7e8824e66b7f2de03b826 was flagged for Spanish wording. Evidence=65a7e8824e66b7f2de03b826
Patch:
docs/review-verification-steps.md
+ - Reject reviews submitted in languages other than English unless a verified translation exists.

Delta2: Reviewer logic warns about vendor self-reviews but never bans former employees, yet 65a6eb8c626bab7d2100ee8e was dropped for exactly that; we need an explicit prohibition. Evidence=65a6eb8c626bab7d2100ee8e
Patch:
docs/review-verification-steps.md
+ - Reject submissions from current or former employees of the reviewed vendor to avoid insider bias.