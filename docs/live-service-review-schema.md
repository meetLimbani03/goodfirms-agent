# Live Service Review Schema (Agent Input)

## Scope
- Source of truth: MySQL `GoodFirms.reviews` (live MCP), plus lookup tables `categories`, `industries`, `company_profiles`, and relation table `company_review_categories`.
- UI reference only (non-authoritative): `form-ui/service-project/{1,2,3}.png` and `data/jsons/service_reviews*.json`.
- Purpose: define the **current** live schema/validation contract for service-review automation.

## Freshness / Data Boundary (as of 2026-03-01)
- MySQL MCP `Prod-goodfirms-mysql` is reachable in this session.
- `MAX(reviews.created)` currently visible via MCP: `2026-02-16 20:55:30` UTC.
- Admin exports in `data/jsons/service_reviews*.json` were extracted on `2026-02-24` and contain newer IDs than the DB snapshot (`849xx` vs DB max `84552`).
- Therefore:
  - DB is the truth for schema/storage behavior.
  - JSON/HTML exports are used only to confirm current UI labels and wording.

## Current Form (Observed UI)
From `form-ui/service-project` screenshots:

### Step 1: Project Details
- `Project title` (required)
- `What was the cost of your project?` (required)
- `Select project industry` (required)
- `Current project status` (required; UI values include `In Progress`)
- `Describe your project` (optional)

### Step 2: Review & Rating
- `What service was provided as part of the project?` (UI says up to 3 categories)
- `Describe your overall experience in one sentence` (required)
- `Describe your overall experience in details` (required)
- `What did you like the most...` (required)
- `What did you like the least...` (required)
- Ratings (all required):
  - Quality Work
  - Scheduling and Timing
  - Communication
  - Overall Experience

### Step 3: Reviewer Details
- `Your full name` (required)
- Posting preference (required)
- `Company name` (required)
- `Position` (required)
- `Location` (required)
- `Website` (optional)
- `Business email` (required)
- `LinkedIn profile` (optional)

## DB Mapping (Current Form)

### Step 1 fields
- `Project title` -> `reviews.project_name`
- `Project Budget` -> `reviews.cost`
- `Industry` -> `reviews.industry_id` (resolve with `industries.id -> industries.name`)
- `Project Status` -> `reviews.project_status` (stored code)
- `Describe your project` -> `reviews.project_summary`

### Step 2 fields
- Primary service -> `reviews.category_id` (resolve with `categories.id -> categories.name`)
- Multi-service selections (when persisted) -> `company_review_categories.review_id/category_id`
- One-sentence summary -> `reviews.conclusion`
- Detailed experience -> `reviews.feedback_summary`
- Most liked -> `reviews.strength`
- Least liked -> `reviews.weakness`
- Ratings -> `reviews.quality`, `reviews.ability`, `reviews.reliability`, `reviews.overall`

### Step 3 fields
- Name -> `reviews.client_name`
- Posting preference -> `reviews.hidden_identity`
- Company -> `reviews.client_company_name`
- Position -> `reviews.position`
- Location -> `reviews.location`
- Website -> `reviews.client_company_website`
- Email -> `reviews.client_email`
- LinkedIn -> `reviews.client_profile_link`

## Eligibility Gate (for automation)
A service review is eligible for agent processing when all are true:
- `publish_status = 0`
- It is not draft-like according to the locked predicate below.
- Required current-form fields are present and valid.

Hard-fail checks:
- Any required Step 2 content/rating field missing.
- Any rating outside `1..5`.
- Required reviewer identity/posting fields missing (for current-form records).

## Locked Status Predicate (match backend behavior)
Use this exact interpretation for service records:

- `publish_status = 1` -> `Published`
- `publish_status = 2` -> `Rejected`
- `publish_status = 0`:
  - `Draft saved` if all are true:
    - `conclusion == "" or null`
    - `feedback_summary == "" or null`
    - `strength == "" or null`
    - `weakness == "" or null`
    - `quality == 0`
    - `ability == 0`
    - `reliability == 0`
    - `overall == 0`
  - otherwise -> `Pending`

## Active Field Usage (Verified)

### Latest 500 pending records (`publish_status=0`)
- Total pending: `120`
- Draft-like by predicate: `43`
- Pending/submitted-like: `77`
- For all 77 submitted-like records:
  - Step 1 + Step 2 fields are populated.
  - All four ratings are in `1..5`.
  - `project_name` max length observed: `60`
  - `conclusion` max length observed: `100`
  - `feedback_summary` max length observed: `974` (<=1000)
  - `strength`/`weakness` max length observed: `500`
  - `hidden_identity` in `{1,2,3,4}`
  - `client_name` + `client_email` present in all 77.

### Latest 500 approved records (`publish_status=1`)
- `step>=2`: `298/500`
- In those 298 records, all current Step 2 required fields are populated and ratings are valid.
- Step 3 identity is highly present but optional fields vary (`website`, `profile_link`).
- `step` is not reliable as a strict completion gate on historical/approved data.

### Multi-service persistence behavior
- UI allows selecting up to 3 services.
- DB relation table: `company_review_categories` exists and is populated mainly for published/rejected records.
- In latest 500 approved: selected services count distribution = `0:191, 1:256, 2:36, 3:17`.
- In recent pending snapshot, relation rows are mostly absent; fallback to `category_id` is required.
- Historical/backfill outliers (`>3` categories) exist and should be treated as legacy anomalies.

## Required Fields (Current Live Contract)

### Core identity
- `reviews.id`
- `reviews.company_profile_id`
- `company_profiles.company_name` (resolve when available)
- `company_profiles.slug` (optional for routing)

### Step 1
- `project_name` (non-empty)
- `cost` (non-empty)
- `industry_id > 0` (resolve to readable industry)
- `project_status` (code present; normalize to label)
- `project_summary` (recommended; may be optional)

### Step 2
- Primary service: `category_id > 0` (required)
- Optional selected services list from `company_review_categories`
- `conclusion` (non-empty)
- `feedback_summary` (non-empty)
- `strength` (non-empty)
- `weakness` (non-empty)
- `quality`, `ability`, `reliability`, `overall` each in `1..5`

### Step 3 reviewer verification
- `client_name` (non-empty)
- `hidden_identity` in `{1,2,3,4}` (normalize before compare)
- `client_email` (non-empty, email-format check)
- `client_company_name` / `position` / `location` should be present for current-form records; if missing, route to manual review instead of silent pass.

## Optional / Legacy Fields (Do Not Drive Current Validation)
- `duration` (legacy; non-default usage ended around 2023-03-30)
- `completion_date` (still populated in many rows but inconsistent with current status semantics; do not use as completion truth)
- `short_feedback_summary` (legacy; last meaningful usage in 2017)
- Legacy score fields: `references`, `portfolio`, `market_penetration`, `experience`, `app_development`, `app_design`
- Legacy alternate rating triplet: `recommend`, `scheduling_timeline`, `communication`
- `pricing_structure`, `video`, `youtube_video_id`, `amazon_email`, `work_email`, `verify_linkedin`, etc.

## Form-Change Estimate (Current vs Previous)

### Evidence-backed timeline
- Legacy weighted-score era existed; last non-default legacy score usage: `2019-04-25 01:07:36` UTC.
- Alternate rating triplet (`recommend/scheduling_timeline/communication`) remained active through `2023-04-02 09:27:51` UTC.
- First record after that with triplet fully zero and current 4-rating model active: `id=41645`, `created=2023-04-02 23:31:28` UTC.
- Last non-default `duration` usage: `2023-03-30 03:51:26` UTC.
- Multi-service relation table (`company_review_categories`) starts from `2024-04-23 00:53:09` UTC (with signs of backfill/migration behavior).

### Practical conclusion
- Last major service-form change estimate: **late Mar to early Apr 2023** (current 4-rating + Step2 content model stabilized).
- Later enhancement estimate: **around Apr 2024** for persisted multi-service category relations.

## Enum / Display Mapping

### Publish status
- `0` -> Pending
- `1` -> Published
- `2` -> Rejected

### Posting preference (`hidden_identity`)
- `1` -> Display both my name and the company's name with the review
- `2` -> Only display my name with the review
- `3` -> Only display the company's name with the review
- `4` -> Don't display my name and the company's name with the review

### Project status (`project_status`) - inferred mapping
- `1` -> `Completed` (inference from current UI/export distributions)
- `0` -> `In progress` (inference from current UI/export distributions)

Note: the `project_status` label mapping is inferred because exported UI IDs are newer than this DB snapshot.

## Proposed Agent Payload Shape
```json
{
  "review_type": "service",
  "source_id": 84527,
  "company_reviewed": {
    "company_profile_id": 18419,
    "name": "Atolye15",
    "slug": "atolye15"
  },
  "project": {
    "title": "Mobile App Development for Location-Based Hiring Platform",
    "description": "Step-1 project summary",
    "budget_range": "$10001 to $50000",
    "status_code": 1,
    "status_label": "Completed",
    "industry_id": 13,
    "industry": "Information Technology",
    "primary_service_id": 13,
    "primary_service": "Digital Marketing",
    "selected_services": []
  },
  "review": {
    "one_line_summary": "They put our company's interests first and acted like it was their own product.",
    "detailed_experience": "Detailed feedback_summary",
    "most_liked": "Strength text",
    "least_liked": "Weakness text",
    "ratings": {
      "quality_work": 5,
      "scheduling_timing": 5,
      "communication": 5,
      "overall_experience": 5
    }
  },
  "reviewer": {
    "name": "Client Name",
    "email": "client@example.com",
    "posting_preference": "Display both my name and the company's name with the review",
    "company_name": "Optional if present",
    "position": "Optional if present",
    "location": "Optional if present",
    "company_website": "Optional",
    "profile_link": "Optional"
  },
  "meta": {
    "step": 2,
    "publish_status": 0,
    "created": "2026-02-16T12:44:52Z",
    "updated": "2026-02-16T18:39:26Z"
  }
}
```

Payload builder notes:
- Prefer readable labels in LLM input; keep IDs in system-side metadata.
- Do not use `step` as hard truth for completion in live gating.
- For services list:
  - use `company_review_categories` when available,
  - otherwise fallback to `category_id` only.
- Route obvious schema anomalies (legacy drafts, missing required current fields, hidden_identity outside `1..4`) to manual review.
