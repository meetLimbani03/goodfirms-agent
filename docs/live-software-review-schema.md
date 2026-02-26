# Live Software Review Schema (Agent Input)

## Scope
- Source: MongoDB `goodfirms.software-reviews`
- Analysis window: newest 500 records by `created` (plus manual spot-check of newest records)
- Purpose: define the **current** schema to use for agent pre-check + review workflow
- This contract is for live automation only; do not infer behavior from legacy/historical formats.

## Eligibility Gate (for automation)
A software review is eligible for agent processing when all are true:
- `is_active == 0` (pending/unpublish state)
- `step >= 2`
- step-2 review content is present (see required fields below)

Recommended hard-fail checks:
- reject if `step < 2`
- reject if any required step-2 field is empty/zero

## Locked Status Predicate (match backend)
Use this exact interpretation for software records:

- `is_active == 1` -> `Published`
- `is_active == 2` -> `Rejected`
- `is_active == 0`:
  - `Draft saved` if all are true:
    - `title == ""`
    - `summary == ""`
    - `strength == ""` (and key exists)
    - `weakness == ""` (and key exists)
    - `ease_of_use == 0` (and key exists)
    - `features_functionality == 0` (and key exists)
    - `customer_support == 0` (and key exists)
    - `overall == 0` (and key exists)
  - otherwise -> `Pending`

Current prod behavior check:
- For recent `step=1` records (from Jan 1, 2025 onward), these fields are consistently backend-populated as empty strings and numeric `0`.
- One old historical outlier exists (2023) with inconsistent values; ignore for live automation.

## Required Fields

### Core identity
- `_id` (ObjectId)
- `step` (number; expected `1|2|3`)
- `is_active` (number; expected `0|1|2`)
- `software_id` (ObjectId)
- `software_name` (string)
- `software_slug` (string)

### Step 1 (usage context)
- `features.category` (array, length >= 1)
- `use_in_time` (string number, parse to integer > 0)
- `use_time_format` (enum: `days|week|months|years`)
- `frequent_use` (enum: `daily|weekly|monthly|yearly`)
- `software_pricing` (enum: `inexpensive|mid-tier|expensive`)
- `is_integrated` (enum: `yes|no|other`)
- `switched_from` (enum: `yes|no|other`)
- `integrate_software` (array; Step 1 conditional field, expected when `is_integrated == "yes"`)
- `used_software` (array; Step 1 conditional field, expected when `switched_from == "yes"`)

### Step 2 (review content)
- `title` (non-empty string)
- `summary` (non-empty string)
- `strength` (non-empty string)
- `weakness` (non-empty string)
- `ease_of_use` (rating 1-5)
- `features_functionality` (rating 1-5)
- `customer_support` (rating 1-5)
- `overall` (rating 1-5)

### Step 3 / reviewer verification
- `client_name` (non-empty string)
- `client_email` (non-empty string; email-format check)
- `client_company_name` (non-empty string)
- `position` (non-empty string)
- `location` (non-empty string / country code)

## Optional Fields
- `hidden_identity` (enum mapped from number/string: `1|2|3|4`; normalize before compare)
- `client_company_website`
- `client_profile_link`
- `requesttoken`
- `created`, `updated`, `publish_date`

## Implementation Notes
- Treat `step` as a hint; final eligibility must still enforce non-empty step-2 content and ratings `> 0`.
- Normalize mixed types before validation:
  - `hidden_identity`: number or string
  - ratings: often strings in persisted records (`"5"`), cast to numeric

## `hidden_identity` Display Mapping
- `1` -> Display both my name and the company's name with the review
- `2` -> Only display my name with the review
- `3` -> Only display the company's name with the review
- `4` -> Don't display my name and the company's name with the review

## Proposed Agent Payload Shape
```json
{
  "review_type": "software",
  "software": {
    "name": "software_name",
    "categories": ["Inventory Management"]
  },
  "usage": {
    "duration_value": 6,
    "duration_unit": "months",
    "frequency": "daily",
    "pricing": "mid-tier",
    "integrated_other_software": "yes",
    "integrated_software": ["Shopify"],
    "switched_from_other_software": "no",
    "used_software_before_switch": []
  },
  "review": {
    "title": "Review title",
    "summary": "Detailed experience",
    "strength": "Most liked",
    "weakness": "Least liked",
    "ratings": {
      "ease_of_use": 5,
      "features_functionality": 5,
      "customer_support": 5,
      "overall": 5
    }
  },
  "reviewer": {
    "name": "Client name",
    "email": "client@example.com",
    "posting_preference": "Only display my name with the review",
    "company_name": "Optional",
    "position": "Optional",
    "location": "Optional",
    "company_website": "Optional",
    "profile_link": "Optional"
  },
  "meta": {
    "created": 1772094822,
    "updated": 1772094822,
    "submitted_at": "2026-02-26T08:33:42Z"
  }
}
```

Notes for payload builder:
- Do not send internal IDs/codes to the agent (`_id`, `software_id`, category IDs, software IDs in arrays).
- Convert coded fields to readable labels before sending (for example `hidden_identity` -> posting preference text).
- Keep internal IDs only in system-side metadata outside the LLM prompt for traceability/routing.
- Do not send `step` to the agent. Use `step` only in backend gating.
- Do not send publication status to the agent. Filter eligibility in backend before invoking the agent.

## Agent Dynamic Scoring Guidance
- Agent should compute score dynamically from field quality/completeness conditions, not from backend precomputed scores.
- Backend should provide the agent:
  - normalized readable payload
  - validation conditions/rules
  - optional list of missing/invalid fields detected in pre-check
- Agent scoring should consider at minimum:
  - missing required content fields
  - invalid rating values (outside 1-5)
  - reviewer verification gaps (name/email/posting preference issues)
  - language quality issues (grammar, clarity) without changing factual meaning
