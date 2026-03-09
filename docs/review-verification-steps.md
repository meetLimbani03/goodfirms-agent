# Review Verification Steps (Structured Policy)

0. Initial Context and Additional Data

0.1 Scope and execution boundaries
- This policy covers both:
  - Software reviews
  - Service reviews
- Active implementation focus is software-review CLI v1.
- Use this file as the source of truth for review-verification checks.
- This project has legacy/backfill history. Do not assume old fields are valid for current flow.
- If any field/collection is identified as deprecated or legacy, update `docs/db-knowledge.md` (`Deprecated / Legacy Fields Register`) first.

0.2 Infra and data access note
- Historical snapshot basis: production MySQL data was exported to `data/gf.sql` on `2026-02-17`.
- Local DB `GoodFirms` is connected through `Prod-goodfirms-mysql`.
- MongoDB prod is accessible through MCP.

0.3 Scoring framework
- If a deterministic precheck fails, stop and do not call agent.
- Scoring starts only when prechecks pass.
- Start score at `0`.
- Score bands (Example):
  - `>= 70` => `approved`
  - `45-69` => `flagged_manual_review`
  - `< 45` => `rejected`
- Deterministic manual-review rules override score and force `flagged_manual_review`.

0.4 Hard reject overrides
- Gibberish/spam/placeholder-only review content.
- Confirmed duplicate/already-published copied content.  ( consider when i give the ability to check for duplicates to agent )
- Strong evidence of fabricated identity or vendor self-review.
- Google OAuth identity with strong company-mismatch signals (only when OAuth-provider signal is available).

0.5 Core business rules
- `users.is_goodfirms_registered = 1` is a trust signal, these are users registered on GoodFirms platform bu admin so we add a set amount of score to these reviews on the score agent gives.  ( score number not decided yet )
- Step 3 is optional. Step 2 completion is mandatory.


1. Combined Checks

1.1 Prechecks (checks done in code before forwarding to agent)

1.1.1
Check: Unified hard-gate precheck.
Purpose: enforce one strict deterministic gate for record-state, form-required fields, and user-account verification before agent cost.
Condition:
- Run normalization first (mandatory):
  - Trim all string fields.
  - Collapse whitespace-only strings to empty.
  - Cast numeric-like rating/status fields to integers.
  - Normalize enum-like fields to lowercase before compare where applicable.
  - Treat these as invalid placeholders: `null`, `""`, whitespace-only text, numeric `0` for required ratings, missing key.
- Shared record-state gate:
  - Software: `is_active = 0` (pending only), `step >= 2`.
  - Service: `publish_status = 0` (pending only), and must not match draft-like predicate (`conclusion/feedback_summary/strength/weakness` empty and ratings all `0`).
- Mandatory software linkage + account gate:
  - `software_id` present and valid ObjectId.
  - `software_name` non-empty.
  - `software_slug` non-empty.
  - `user_id` present and non-empty.
  - `users.id = software-reviews.user_id` must resolve.
  - `users.email_verified_at` is mandatory:
    - must be non-null,
    - must parse as valid datetime,
    - must not be zero-date placeholder like `0000-00-00 00:00:00`.
- Mandatory software form fields and checks:
  - Step 1:
    - `features.category`: array length `>= 1`.
    - `use_in_time`: integer `> 0`.
    - `use_time_format`: one of `days|week|months|years`.
    - `frequent_use`: one of `daily|weekly|monthly|yearly`.
    - `software_pricing`: one of `inexpensive|mid-tier|expensive`.
    - `is_integrated`: one of `yes|no|other`.
    - `switched_from`: one of `yes|no|other`.
    - If `is_integrated = yes`: `integrate_software` array length `>= 1`.
    - If `switched_from = yes`: `used_software` array length `>= 1`.
  - Step 2:
    - `title`, `summary`, `strength`, `weakness`: each non-empty after trim.
    - `ease_of_use`, `features_functionality`, `customer_support`, `overall`: integer in `1..5`.
  - Step 3 (reviewer details for current-form submissions):
    - `client_name`, `client_company_name`, `position`, `location`: non-empty after trim.
    - `hidden_identity`: value in `{1,2,3,4}` after normalization.
    - `client_email`: non-empty, lowercased, valid email format.
- Mandatory service linkage + form fields and checks:
  - Core linkage:
    - `reviews.id` exists.
    - `company_profile_id` present and valid.
  - Step 1:
    - `project_name`: non-empty.
    - `cost`: non-empty.
    - `industry_id`: integer `> 0`.
    - `project_status`: code present and valid.
  - Step 2:
    - `category_id`: integer `> 0`.
    - `conclusion`, `feedback_summary`, `strength`, `weakness`: each non-empty after trim.
    - `quality`, `ability`, `reliability`, `overall`: integer in `1..5`.
  - Step 3 (reviewer details for current-form submissions):
    - `client_name`, `client_company_name`, `position`, `location`: non-empty after trim.
    - `hidden_identity`: value in `{1,2,3,4}` after normalization.
    - `client_email`: non-empty, lowercased, valid email format.
- Field-level validation method (applies to every required field above):
  - Required string: `trim(value).length > 0`.
  - Required integer: parse success + exact integer + in allowed range.
  - Required enum: normalized value must exactly match allowed set.
  - Required array: array type + minimum length.
  - Required relation/key: foreign-key lookup returns exactly one valid record.
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: this is a single deterministic gate; if any one required field check fails, stop processing.

1.1.2
Check: Text is processable for verification.
Purpose: prevent low-value agent calls.
Condition:
- Review text is readable enough for analysis.
- Not random token junk or repeated placeholder text.
Fail action: reject (deterministic if clearly junk; otherwise allow agent check).
Score: scored in agent phase when not deterministically clear.
Notes: English is preferred. Non-English can be routed to manual flow if translation is unavailable.

1.1.3
Check: Input identity/value fields are normalized before logic.
Purpose: avoid false decisions due to type drift.
Condition:
- Normalize mixed field types (string/number) for ratings and identity-related values.
Fail action: reject if normalization fails for required fields.
Score: not scored if rejection is deterministic.
Notes: normalization is mandatory before checks and scoring.

1.1.4
Check: Reviewer identity text fields are readable and plausible.
Purpose: detect identity-quality issues early.
Condition:
- `client_name`, company name, and role/position are not obvious gibberish/random tokens.
Fail action: allow agent check when borderline; reject only on clearly junk identity text.
Pass score: `+6`
Fail score: `-12`
Notes: use this as authenticity signal, not as a strict hard gate unless clearly invalid.


1.2 Agent Checks

1.2.1
Check: Readability and coherence.
Purpose: identify spam/gibberish and content quality risk.
Pass score: `+10`
Fail score: `-25`
Notes: gibberish or junk patterns can directly push to reject.

1.2.2
Check: Title and body alignment.
Purpose: maintain review integrity.
Pass score: `+5`
Fail score: `-5`
Notes: if body is valid and title is weak, title rewrite is allowed.

1.2.3
Check: Internal consistency (narrative vs ratings).
Purpose: detect manipulation or contradictions.
Pass score: `+8`
Fail score: `-12`
Notes: strong mismatch (very negative body + all 5 ratings) increases risk.

1.2.4
Check: Specificity and usefulness.
Purpose: keep reviews actionable and authentic.
Pass score: `+8`
Fail score: `-10`
Notes: generic boilerplate lowers trust.

1.2.5
Check: Strength and weakness are meaningfully different.
Purpose: detect low-effort or copied responses.
Pass score: `+4`
Fail score: `-8`
Notes: near-duplicate strength/weakness is a risk signal.

1.2.6
Check: Minimal rewrite discipline.
Purpose: preserve reviewer intent and authenticity.
Pass score: `+4`
Fail score: `-10`
Notes: fix grammar/clarity only; never invent facts.

1.2.7
Check: Agent invocation contract.
Purpose: keep the model call simple, stateless, and auditable.
Format:
- One model call per eligible review.
- The call must include:
  - `system prompt`: stable role + hard constraints.
  - `instructions`: exact checks, decision rules, and JSON output contract.
  - `review data`: normalized readable payload only.
- Do not rely on conversation history between reviews.
- Do not let the model choose its own workflow/tools in v1.
Fail action: implementation issue; treat as pipeline error, not review failure.
Score: not scored.
Notes: this project is a review-analysis workflow, not an open-ended agent.

1.2.8
Check: Agent JSON output contract.
Purpose: enforce a deterministic response shape for downstream logic.
Required top-level fields:
- `overall_decision`: one of `safe | borderline | high_risk | reject`
- `can_enhance`: boolean
- `confidence`: number in `0..1`
- `risk_flags`: string array
- `reason_summary`: non-empty string
- `checks`: object
Required `checks` keys:
- `gibberish`
- `authenticity`
- `spam`
- `pii`
- `safety`
- `consistency`
- `specificity`
Required per-check shape:
- `status`: one of `pass | flag | fail`
- `reason`: non-empty string
Fail action: treat as model-output error and retry or route to manual review.
Score: not scored.
Notes: do not accept free-text responses outside this JSON contract.

1.2.9
Check: Agent evaluation rules.
Purpose: define the minimum LLM review policy for v1.
Rules:
- `gibberish`: fail only if the text is mostly meaningless, random, or not interpretable as a real review.
- `authenticity`: flag when claims feel suspicious/generic; fail only on strong internal evidence from supplied fields.
- `spam`: flag/fail when the text reads like solicitation, promotion, keyword stuffing, or template spam.
- `pii`: flag/fail when the review body exposes contact details or sensitive identifying text.
- `safety`: fail for hateful, abusive, harassing, threatening, or otherwise unsafe content.
- `consistency`: flag/fail when title/body/strength/weakness/ratings strongly conflict.
- `specificity`: flag/fail when the review is too vague or low-information to be useful.
- Do not claim confirmed duplication unless explicit comparison evidence is provided by the backend.
- Prefer `flag` over `fail` when evidence is partial.
Fail action: use returned status in `checks`.
Score: scored/used in model phase.
Notes: the model must be conservative and evidence-based, not accusatory.

1.2.10
Check: Prompt shape for v1.
Purpose: standardize prompt authoring.
Recommended structure:
- `System`:
  - role = GoodFirms review analysis model
  - constraints = no invention, no rewriting, use only supplied data, return only JSON
- `Instructions`:
  - list of checks
  - pass/flag/fail definitions
  - decision label definitions
  - duplicate-check limitation note
- `Review data`:
  - normalized review payload with readable labels
Notes: keep IDs/status codes/internal storage fields out of the agent prompt when they are not needed for judgment.


2. Software Review Checks

2.1 Prechecks (checks done in code before forwarding to agent)

2.1.1
Check: Software review exists by Mongo `_id` in `goodfirms.software-reviews`.
Purpose: ensure valid target record.
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: CLI input review ID maps to this record.

2.1.2
Check: Software linkage fields are valid.
Purpose: ensure context can be built correctly.
Condition:
- `software_id` present
- `software_name` present
- `software_slug` present
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: broken product linkage invalidates verification context.

2.1.3
Check: Reviewer account linkage key is present.
Purpose: enforce stable identity matching.
Condition:
- `user_id` is present and non-empty.
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: for this flow, account lookup key is `user_id` only.

2.1.4
Check: Reviewer account exists in MySQL.
Purpose: attach trust and verification context.
Condition:
- MySQL `users.id = software-reviews.user_id`
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: no email fallback for account lookup.

2.1.5
Check: Reviewer email is verified at account level.
Purpose: block unverified accounts before agent cost.
Condition:
- `users.email_verified_at IS NOT NULL`
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: mandatory for software v1 policy.

2.1.6
Check: Admin-registered trust signal.
Purpose: reward known higher-trust user cohort.
Condition:
- `users.is_goodfirms_registered = 1`
Pass score: `+20`
Fail score: `+0`
Notes: trust boost only; not a reject criterion by itself.

2.1.7
Check: OAuth company-consistency signal (when provider signal exists).
Purpose: detect identity/company mismatch risk.
Condition:
- if OAuth provider info is available, compare company-domain consistency signals.
Pass score: `+10`
Fail score: `-40`
Notes: if provider signal is unavailable, skip this check.

2.1.8
Check: One person should not have another published review for the same software (exact person match).
Purpose: catch duplicate-person submissions for same software.
Condition:
- Published review exists with same `software_id` + same `client_name` + same `client_email`.
Fail action: force `flagged_manual_review`.
Score: `-20` (override applies).
Notes: does not auto-reject in current policy; manual confirmation required.

2.1.9
Check: Same name on same software but different email.
Purpose: catch possible work-email-change or identity conflict.
Condition:
- Published review exists with same `software_id` + same `client_name` + different email.
Fail action: force `flagged_manual_review`.
Score: `-15` (override applies).
Notes: reason should include `possible_email_change`.

2.1.10
Check: Near-identical software review content in short submission window.
Purpose: detect rapid duplicate/recycled submissions.
Condition:
- same software target + same person context + high text similarity in short time window.
Fail action: force `flagged_manual_review`; reject if content is confirmed already-published copy.
Score: `-20` (override applies when forced manual).
Notes: confirmed already-published copied content falls under hard reject overrides.


2.2 Agent Checks

2.2.1
Check: Product relevance.
Purpose: verify that review is truly about the named software.
Pass score: `+10`
Fail score: `-15`
Notes: generic text applicable to any product is a risk.

2.2.2
Check: Usage plausibility.
Purpose: validate consistency between usage claims and narrative.
Pass score: `+6`
Fail score: `-8`
Notes: implausible combinations reduce authenticity confidence.

2.2.3
Check: Client-vs-vendor plausibility.
Purpose: detect self-promotional/vendor-written content.
Pass score: `+8`
Fail score: `-20`
Notes: vendor/staff/ambassador style narrative is high risk.

2.2.4
Check: Unrelated promotional/affiliate links.
Purpose: detect spam/SEO abuse in review body.
Pass score: `+4`
Fail score: `-12`
Notes: links not relevant to product experience are risk indicators.


3. Service Review Checks

3.1 Prechecks (checks done in code before forwarding to agent)

3.1.1
Check: Service review exists by ID in MySQL `reviews`.
Purpose: ensure valid target record.
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: applies to service flow.

3.1.2
Check: Company linkage is valid.
Purpose: ensure review target is resolvable.
Condition:
- `company_profile_id` valid/mapped.
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: invalid linkage means invalid verification context.

3.1.3
Check: Service Step 2 required fields are validly filled.
Purpose: avoid incomplete service review processing.
Condition:
- `feedback_summary` present
- `overall` in `1..5`
- key service text fields present
- default placeholders not counted as filled (`0`, empty, null, whitespace-only)
Fail action: reject immediately, do not call agent.
Score: not scored (gating).
Notes: strict validation same as software principle.

3.1.4
Check: Existing published service review by same person on same target.
Purpose: enforce one-person-per-target review control for service flow.
Condition:
- published review exists for same service target + same `client_name` + same `client_email`.
Fail action: force `flagged_manual_review`.
Score: `-20` (override applies).
Notes: manual confirmation first; do not auto-reject by default.

3.1.5
Check: Same-name service review on same target but different email.
Purpose: detect possible work-email-change or identity conflict in service flow.
Condition:
- published review exists for same service target + same `client_name` + different email.
Fail action: force `flagged_manual_review`.
Score: `-15` (override applies).
Notes: reason should include `possible_email_change`.

3.1.6
Check: Near-identical service review content in short submission window.
Purpose: detect repeated template/copy submissions.
Condition:
- same service target + same person context + high text similarity in short time window.
Fail action: force `flagged_manual_review`; reject if content is confirmed already-published copy.
Score: `-20` (override applies when forced manual).
Notes: confirmed already-published copied content falls under hard reject overrides.


3.2 Agent Checks

3.2.1
Check: Project context alignment.
Purpose: verify consistency among project details, category, and review body.
Pass score: `+10`
Fail score: `-15`
Notes: mismatch indicates low reliability.

3.2.2
Check: Experience specificity.
Purpose: ensure review includes concrete delivery/process/outcome elements.
Pass score: `+8`
Fail score: `-10`
Notes: generic praise/complaint lowers trust.

3.2.3
Check: Q&A consistency.
Purpose: detect low-effort duplicated answers.
Pass score: `+4`
Fail score: `-8`
Notes: near-identical most-liked/least-liked answers are a risk.

3.2.4
Check: Identity plausibility.
Purpose: verify reviewer identity context coherence.
Pass score: `+8`
Fail score: `-15`
Notes: conflicting identity signals increase manual-review likelihood.


4. Identity and External Evidence Logic

4.1
Check: LinkedIn profile corroboration (when profile URL is available).
Purpose: strengthen reviewer authenticity evidence.
Condition:
- profile exists and is accessible
- name similarity with submitted reviewer name
- company/role broadly consistent
Pass score: `+20`
Fail score: `-15` (or force manual review on strong mismatch)
Notes: this can be executed as DB+web mode when enabled.

4.2
Check: No LinkedIn / weak external corroboration.
Purpose: adjust confidence when identity evidence is limited.
Condition:
- weak or conflicting corroboration signals
Score: `-15`
Notes: usually maps to manual review unless other signals are very strong.

4.3
Check: Hidden identity preference impact (`hidden_identity`).
Purpose: adjust required corroboration strength when visible identity is limited.
Condition:
- if identity is partially/fully hidden, require stronger supporting evidence from other signals.
Score: `0` direct score change; apply stricter evidence requirement.
Notes: route to manual review when corroboration remains weak.

4.4
Check: Evidence tier assignment.
Purpose: make authenticity confidence explicit.
Condition:
- High: direct profile/work corroboration and consistent context.
- Medium: partial corroboration (for example name + company, role uncertain).
- Low: weak/no reliable corroboration.
Score:
- High: `+20`
- Medium: `+10`
- Low: `-15`
Notes: use tier signal in final reason summary.


5. Final Labels and Decision Mapping

5.1
Check: Any deterministic precheck failed.
Purpose: enforce strict cost and quality gate.
Decision: `rejected`
Score use: not applicable (early exit).
Notes: agent is not called.

5.2
Check: Deterministic duplicate/email-change rule triggered.
Purpose: enforce person-level review uniqueness handling.
Decision: `flagged_manual_review`
Score use: score may be computed but decision override applies.
Notes: include clear reason (`duplicate_same_software_person` or `possible_email_change`).

5.3
Check: Prechecks passed and no deterministic override.
Purpose: map score to final decision.
Decision by score:
- `>= 70` => `approved`
- `45-69` => `flagged_manual_review`
- `< 45` => `rejected`
Notes: include top contributing signals in reason.


6. Output Contract

6.1
Check: Response schema from verification flow.
Purpose: keep output predictable for CLI and HITL.
Output fields:
- `label`: `approved | rejected | flagged_manual_review`
- `reason`: concise direct explanation of why this label was selected
Score: include numeric score in logs/audit; final user-facing output can stay concise.
