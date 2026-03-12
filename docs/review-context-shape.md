# Review Context Shape Proposal

## Goal

Define one backend-owned review context format that:

- works for both software and service reviews
- uses the actual data available in MongoDB and MySQL
- keeps the LLM prompt focused
- gives HITL enough evidence to approve/reject confidently
- avoids mixing raw database lineage with agent-facing context

This document proposes the canonical internal shape. The backend should build one **canonical internal bundle** and derive only two projections from it:

- `agent`
- `hitl`

## Recommendation

Use a **shared base shape with type-specific sub-sections**, not two fully separate payloads.

Reason:

- most review-processing logic is shared across both review types
- both flows need the same concepts: subject, reviewer, review text, ratings, account evidence, risk signals, lifecycle metadata
- only the form-specific inputs differ
- a shared envelope keeps API, tests, and downstream consumers simpler

The split should be:

- shared: common semantics that exist for both review types
- type-specific: form fields that only make sense for software or service
- signals: derived judgments/evidence used for review verification
- metadata: traceability, status, lineage, raw source references

## What Data We Actually Have

- Images of form UI for both software and service reviews are available for reference in `/home/ubuntu/Desktop/goodfirms-agent/form-ui`.

### Software review sources

- Mongo `software-reviews`
- Mongo `software-review-request`
- Mongo `softwares`
- Mongo `software-category`
- MySQL `users`
- MySQL `reviewer_emails_unverified`

Current use-case rule for software reviews:

- process only reviews where `submitted_by == 1`
- treat `submitted_by` as internal provenance metadata, not agent-visible context

Working interpretation from live data patterns:

- `submitted_by = 1` -> likely normal reviewer/user flow
- `submitted_by = 3` -> likely admin-entered or admin-assisted flow that bypasses the normal multi-step UI
- `submitted_by = 2` -> likely an older or special source; current live data is too weak to define confidently

This mapping is a strong inference from live data behavior, not a confirmed product-code enum contract.

### Service review sources

- MySQL `reviews`
- MySQL `company_profiles`
- MySQL `categories`
- MySQL `industries`
- MySQL `company_review_categories`
- MySQL `users`
- MySQL `company_reviewer_emails`

### Data we should not treat as first-class context sources

These appear to be legacy, mixed-era, or secondary tables and should not drive the primary context model:

- MySQL `reviewers`
- MySQL `software_reviews`
- MySQL `guest_reviews`
- MySQL `review_details`
- MySQL `review_summaries`

They can be added later as optional forensic evidence if a concrete approval use case emerges.

## Design Principles

1. Keep raw facts separate from derived signals.
2. Keep derived signals separate from low-level metadata.
3. Do not send internal IDs, status codes, raw tokens, or large raw records to the agent.
4. Only send fields to the agent that help writing, consistency checking, or authenticity judgment.
5. Give HITL richer evidence than the agent, but still keep it structured and compact.
6. Preserve room for source-specific lineage without forcing artificial parity between software and service flows.

## Proposed Canonical Shape

```json
{
  "context_version": "v1",
  "generated_at": "2026-03-10T00:00:00Z",
  "review_type": "software | service",
  "review_ref": {
    "id": "mongo-object-id-or-mysql-int-as-string",
    "source_system": "mongo | mysql"
  },
  "subject": {
    "id": "software_id | company_profile_id",
    "name": "review target display name",
    "slug": "review target slug",
    "website": "review target website",
    "category_labels": ["..."]
  },
  "reviewer": {
    "name": "reviewer name",
    "email": "reviewer email",
    "email_domain": "example.com",
    "company_name": "reviewer company",
    "position": "reviewer role",
    "location": "country or location",
    "posting_preference_code": "1|2|3|4",
    "posting_preference_label": "Display both...",
    "company_website": "reviewer company website",
    "company_website_host": "example.com",
    "profile_link": "linkedin/profile url",
    "profile_link_host": "linkedin.com"
  },
  "review_content": {
    "headline": "title or one-line conclusion",
    "body": "main detailed review text",
    "strength": "most liked",
    "weakness": "least liked",
    "ratings": {
      "primary": {
        "label_1": 1,
        "label_2": 1,
        "label_3": 1,
        "overall": 1
      }
    }
  },
  "type_context": {
    "software": {},
    "service": {}
  },
  "signals": {
    "account": {},
    "identity_match": {},
    "history": {},
    "request_lineage": {},
    "risk_flags": [],
    "trust_flags": []
  },
  "metadata": {
    "lifecycle": {},
    "provenance": {},
    "source_refs": {},
    "lineage": {}
  }
}
```

## Why This Shape

- `review_type` is the discriminator for software vs service
- `subject` stays generic because the target is always the thing being reviewed
- `review_content` normalizes software and service wording into one common block
- `type_context` carries only the form-specific extras
- `signals` is where approval-relevant evidence belongs
- `metadata` is where operational/debug/admin-only data belongs

## Field-by-Field Reasoning

### Top-level fields

| Field | Include In | Reason |
|---|---|---|
| `context_version` | internal, hitl | lets us evolve shape safely without hidden drift |
| `generated_at` | internal, hitl | useful for traceability and debugging stale context |
| `review_type` | agent, hitl | required discriminator for choosing interpretation and prompt logic |
| `review_ref.id` | hitl | needed for traceability and actions; not useful to the agent |
| `review_ref.source_system` | hitl | useful for debugging and admin tooling, not for model reasoning |

### `subject`

| Field | Include In | Reason |
|---|---|---|
| `subject.id` | hitl | needed for internal routing and traceability only |
| `subject.name` | agent, hitl | the review must be interpreted against the correct software/company |
| `subject.slug` | hitl | useful for admin links and routing; low value for the agent |
| `subject.website` | hitl, selected-signal input | useful as evidence for domain checks and human verification; raw URL is usually not needed in the prompt |
| `subject.category_labels` | agent, hitl | helps the agent interpret whether the review content matches the reviewed subject/domain |

Notes:

- For software reviews, `subject` comes from Mongo `softwares` plus `software-category`.
- For service reviews, `subject` comes from MySQL `company_profiles` plus service categories.

### `reviewer`

| Field | Include In | Reason |
|---|---|---|
| `reviewer.name` | agent, hitl | useful for authenticity checks and HITL verification |
| `reviewer.email` | hitl | full email is sensitive and rarely needed by the model; HITL may need it |
| `reviewer.email_domain` | agent, hitl | high-signal and low-noise authenticity feature |
| `reviewer.company_name` | agent, hitl | helps check if review content and reviewer identity are coherent |
| `reviewer.position` | agent, hitl | helps determine plausibility of the review perspective |
| `reviewer.location` | agent, hitl | useful but low-weight authenticity signal |
| `reviewer.posting_preference_code` | hitl | internal representation only |
| `reviewer.posting_preference_label` | agent, hitl | readable form used in prompts and admin UI |
| `reviewer.company_website` | hitl | useful for human verification and domain comparison; raw URL usually not needed by the model |
| `reviewer.company_website_host` | agent, hitl | compact authenticity signal, better than a full URL for the agent |
| `reviewer.profile_link` | hitl | useful for HITL inspection; raw full URL is often unnecessary for the model |
| `reviewer.profile_link_host` | agent, hitl | tells the agent whether a profile link exists and what type it is |

Notes:

- We should prefer sending normalized hosts/domains to the agent instead of full URLs/emails where possible.
- Full personally identifying values should remain available for HITL.

Reviewer field resolution rule for this use case:

- always read reviewer identity/profile fields from both places when available:
  - the review record
  - the user profile
- resolve values field-by-field, not by choosing one source globally
- treat the review record as the primary submitted artifact
- use profile data as enrichment/backfill when the review field is missing
- preserve mismatches instead of silently overwriting them

Exact overlap set between review Step 3 fields and user-profile fields:

| Review field | User profile field | Notes |
|---|---|---|
| `client_name` | `users.name` | direct overlap |
| `client_email` | `users.email` | direct overlap |
| `client_company_name` | `users.company_name` | direct overlap |
| `position` | `users.position` | direct overlap |
| `location` | `users.location` | direct overlap |
| `client_company_website` | `users.company_website` | compare by normalized host/domain |
| `client_profile_link` | `users.public_url` | typically LinkedIn/public profile URL |

Fields from Step 3 that are **not** overlapped from user profile in the current design:

- `hidden_identity`
  - review-specific posting preference chosen for that review
  - not present in `users`
  - should never be backfilled from user profile

Fields we are **not** treating as part of this overlap set:

- `client_img`
  - not part of the visible Step 3 form contract
  - `users.profile_pic` exists, but we are not using image fields for current context resolution

Resolution behavior:

1. If the review value exists and the profile value is empty:
- use the review value

2. If the review value is empty and the profile value exists:
- use the profile value as backfill
- mark the field as profile-derived

3. If both exist and normalize to the same value:
- use a single resolved value
- mark the field as matched

4. If both exist and normalize differently:
- keep both values in internal/HITL context
- use the review value as the primary resolved value for agent-facing context
- emit an identity-mismatch signal for HITL and, where useful, the agent

Recommended internal structure:

```json
{
  "reviewer": {
    "resolved": {},
    "review_submitted": {},
    "profile_fetched": {},
    "resolution": {
      "name": "review_only | profile_backfill | matched | mismatch"
    }
  }
}
```

Field-specific normalization guidance:

- `name`: trim, collapse spaces, lowercase for compare
- `email`: trim, lowercase
- `company_name`: trim, lowercase, light punctuation/space normalization
- `position`: trim, lowercase
- `location`: trim, lowercase
- `company_website`: compare normalized host/domain rather than raw URL
- `profile_link`: compare normalized profile URL form rather than raw string

### `review_content`

| Field | Include In | Reason |
|---|---|---|
| `review_content.headline` | agent, hitl | needed for rewrite and consistency checks |
| `review_content.body` | agent, hitl | this is the main text the agent improves and verifies |
| `review_content.strength` | agent, hitl | important for rewrite and internal consistency checks |
| `review_content.weakness` | agent, hitl | important for rewrite and internal consistency checks |
| `review_content.ratings` | agent, hitl | the agent must compare narrative tone to ratings |

Normalization rule:

- software `title` and service `conclusion` both map to `headline`
- software `summary` and service `feedback_summary` both map to `body`

This keeps prompt logic shared without losing meaning.

### `type_context.software`

Use this block only when `review_type = software`.

```json
{
  "software": {
    "usage_duration_value": 6,
    "usage_duration_unit": "months",
    "usage_frequency": "daily",
    "pricing_opinion": "mid-tier",
    "integrates_other_software": "yes",
    "integrated_software_names": ["Shopify"],
    "switched_from_other_software": "no",
    "used_software_before_switch": []
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| `usage_duration_value` | agent, hitl | gives the model context about review maturity and plausibility |
| `usage_duration_unit` | agent, hitl | needed to interpret duration correctly |
| `usage_frequency` | agent, hitl | helps judge whether depth of feedback matches claimed usage |
| `pricing_opinion` | agent, hitl | useful context when review mentions cost/value |
| `integrates_other_software` | agent, hitl | helps interpret product environment and specificity |
| `integrated_software_names` | agent, hitl | useful when review mentions workflow/integrations |
| `switched_from_other_software` | agent, hitl | useful for comparison-style reviews |
| `used_software_before_switch` | agent, hitl | gives important context for migration/comparison claims |

### `type_context.service`

Use this block only when `review_type = service`.

```json
{
  "service": {
    "project_name": "Project title",
    "project_budget_range": "$10001 to $50000",
    "project_status_code": 1,
    "project_status_label": "Completed",
    "project_summary": "Optional project description",
    "industry_label": "Information Technology",
    "primary_service_label": "Web Development",
    "selected_service_labels": ["Web Development", "E-commerce Development"]
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| `project_name` | agent, hitl | anchors the review to a concrete engagement |
| `project_budget_range` | agent, hitl | useful for plausibility and expectations context |
| `project_status_code` | hitl | code is internal; label is what humans and prompts need |
| `project_status_label` | agent, hitl | helps interpret whether the narrative fits ongoing vs completed work |
| `project_summary` | agent, hitl | supports specificity and consistency evaluation |
| `industry_label` | agent, hitl | useful context for understanding service scope |
| `primary_service_label` | agent, hitl | core service category is directly relevant to review interpretation |
| `selected_service_labels` | hitl, optionally agent | useful when multiple services were selected; can be omitted from prompt if token pressure matters |

### `signals.account`

This section contains derived facts from MySQL `users` and related account evidence.

```json
{
  "account": {
    "account_found": true,
    "user_id": "438865",
    "inferred_login_method": "google",
    "is_goodfirms_registered": false,
    "is_spam": false,
    "total_reviews_on_account": 0
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| `account_found` | agent, hitl | meaningful authenticity signal |
| `user_id` | hitl | internal identifier only |
| `inferred_login_method` | agent, hitl | useful context because Google/LinkedIn/email-legacy imply different evidence quality |
| `is_goodfirms_registered` | hitl | useful for admin interpretation, low value for prompt |
| `is_spam` | hitl | important for HITL triage, should not bias the agent’s writing task |
| `total_reviews_on_account` | hitl, derived-risk input | useful for trust/risk heuristics and reviewer history |

### `signals.identity_match`

This section is more useful than sending raw account fields into the agent prompt.

```json
{
  "identity_match": {
    "review_email_matches_account_email": true,
    "review_name_matches_account_name": true,
    "review_company_matches_account_company": false,
    "review_email_domain_matches_subject_website": false,
    "review_company_website_matches_subject_website": false
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| `review_email_matches_account_email` | agent, hitl | compact and useful trust signal |
| `review_name_matches_account_name` | agent, hitl | helps authenticity assessment |
| `review_company_matches_account_company` | agent, hitl | useful for identity consistency checks |
| `review_email_domain_matches_subject_website` | hitl, optional agent | valuable but should be treated carefully because many real reviewers use generic email |
| `review_company_website_matches_subject_website` | hitl | mostly useful for human review and conflict analysis |

### `signals.history`

```json
{
  "history": {
    "same_user_review_count": 1,
    "same_email_review_count": 1,
    "same_subject_review_count": 24
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| `same_user_review_count` | hitl, derived-risk input | useful duplicate/burst signal, not needed directly by the prompt |
| `same_email_review_count` | hitl, derived-risk input | useful for fraud/duplication analysis |
| `same_subject_review_count` | hitl | useful context for subject review volume, but not needed by the agent |

### `signals.request_lineage`

This block should remain source-specific.

```json
{
  "request_lineage": {
    "kind": "software_request | service_email_request | direct | unknown",
    "request_found": true,
    "request_email_matches_review_email": true,
    "request_name_matches_reviewer_name": true
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| `kind` | hitl, optional agent | tells us whether the review came from an invite/request flow or direct submission |
| `request_found` | agent, hitl | compact provenance signal |
| `request_email_matches_review_email` | agent, hitl | strong authenticity signal |
| `request_name_matches_reviewer_name` | agent, hitl | useful but weaker than email match |

Source notes:

- software: derive from Mongo `software-review-request`
- service: derive from MySQL `company_reviewer_emails` when linked evidence exists

### `signals.risk_flags` and `signals.trust_flags`

These should be short, derived summaries. They are better than dumping all source fields into the prompt.

Example:

```json
{
  "risk_flags": [
    "reviewer_email_uses_generic_domain",
    "review_name_differs_from_account_name"
  ],
  "trust_flags": [
    "review_email_matches_account_email",
    "submitted_via_google_login"
  ]
}
```

| Field | Include In | Reason |
|---|---|---|
| `risk_flags` | agent, hitl | lets the agent and HITL focus on a few meaningful concerns |
| `trust_flags` | agent, hitl | gives the same compact view for positive evidence |

Rule:

- Keep flags concise, deterministic, and backend-derived.
- Do not put raw explanations or long free text here.

### `metadata.lifecycle`

```json
{
  "lifecycle": {
    "status_code": 0,
    "status_label": "Pending",
    "step": 3,
    "rejection_reason": null,
    "response": null,
    "submitted_by": 0,
    "created_at": "2026-02-16T20:48:00Z",
    "updated_at": "2026-02-16T20:48:00Z",
    "published_at": null
  }
}
```

| Field | Include In | Reason |
|---|---|---|
| all lifecycle fields | hitl | important for admin workflow and evaluation, not for the agent rewrite/verification task |

### `metadata.provenance`

| Field | Include In | Reason |
|---|---|---|
| `tables` / `collections` used | internal, hitl | useful for debugging and trust in the bundle |
| `notes` | internal, hitl | room for backend comments like fallback behavior or missing joins |

### `metadata.source_refs`

| Field | Include In | Reason |
|---|---|---|
| raw source ids and linked record ids | internal, hitl | makes investigation easy without copying whole raw documents into the context |

### `metadata.lineage`

| Field | Include In | Reason |
|---|---|---|
| source-specific request/invite record details | hitl | useful to inspect request provenance without putting low-level fields into the main prompt |

## What Should Go To Agent vs HITL

### Agent projection

Include only:

- `review_type`
- `subject.name`
- `subject.category_labels`
- selected `reviewer` fields:
  - `name`
  - `email_domain`
  - `company_name`
  - `position`
  - `location`
  - `posting_preference_label`
  - `company_website_host`
  - `profile_link_host`
- `review_content`
- relevant `type_context`
- selected `signals`:
  - `account_found`
  - `inferred_login_method`
  - compact identity-match booleans
  - `request_found`
  - `risk_flags`
  - `trust_flags`

Reason:

- this is enough for rewrite + consistency + authenticity judgment
- it avoids leaking internal/admin-only data
- it keeps the prompt tight

### HITL projection

Include:

- everything in the agent projection
- full reviewer contact fields
- lifecycle metadata
- request/invite lineage details
- reviewer history counts
- internal identifiers needed for admin actions

Reason:

- HITL is making the final decision, so richer evidence is justified

## Explicit Exclusions From Agent Context

Do not send these directly to the model:

- raw database IDs
- status codes
- raw request tokens
- rejection reasons from prior moderation outcome
- full raw source documents
- raw `is_spam` flags
- low-level operational fields like `submitted_by`, `fix_status`, `new`, `is_featured`
- legacy/secondary table payloads unless converted into compact signals

Reason:

- they do not help the writing task
- they can bias the model incorrectly
- they increase tokens without increasing judgment quality

## Final Recommendation

The backend should build **one canonical internal bundle** with:

- shared core fields
- `type_context.software` or `type_context.service`
- compact derived `signals`
- separate `metadata`

This is the best fit for the GoodFirms use case because it:

- matches the real data available in Mongo and MySQL
- supports both review types cleanly
- gives the agent only what it needs
- gives HITL the richer evidence it actually needs
- avoids coupling the system to a prototype prompt format
- keeps one source of truth while exposing only two consumer-specific projections
