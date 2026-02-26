# GoodFirms DB Knowledge

---

## Connections
- **MongoDB** → MCP: `prod-goodfirms-mongo` → DB: `goodfirms`
- **MySQL** → MCP: `Prod-goodfirms-mysql` → DB: `GoodFirms`

---

## Auth / Login
- Google and LinkedIn only (new signups)
- Old vendors: email login, no new email signups

---

## Review Types
- **Software** → MongoDB `software-reviews`
- **Service** → MySQL `reviews`

---

## 3-Step Form Logic

Same DB record updated incrementally across steps from UI.

- **Step 1 only** → incomplete, skip (do not pass to agent)
- **Step 1 + 2** → officially submitted, shown for verification in admin panel, pass to agent
- **Step 3** → optional. Google/LinkedIn signup pre-fills name, company, position, location, email, LinkedIn. Step 3 lets reviewer edit those.

**Step 2 completion check:**
- Software: `title` non-empty (or check `step` field value)
- Service: `feedback_summary` non-empty AND `overall` set

---

## Review Flow

```
Step 1 saved  →  record created (is_active / publish_status = 0)
Step 2 saved  →  officially submitted (still 0, pending admin)
Step 3 saved  →  optional identity update
      ↓
Admin verifies
      ↓
Approved → 1        Rejected → 2 + reason
```

`draft-review` — **DEPRECATED, do not use.**
`software-reviews` is both staging and published store, distinguished by `is_active` + step completion.

---

## Status Codes (both DBs)
MySQL: `publish_status` / MongoDB: `is_active`
- `0` → Pending
- `1` → Published
- `2` → Rejected

**Rejection reasons:**
- Unable to verify the reviewer
- Reviews are accepted only from clients of the company
- Reviews are not accepted from former employees
- Review has already been published before

---

## Software Review Form → `software-reviews` (MongoDB)

### Step 1 — Software Usage
- Software category → `features.category` / `software_category` (multi-select)
- Usage duration → `use_in_time` + `use_time_format` (e.g. `10` + `Months`)
- Usage frequency → `frequent_use`
- Pricing opinion → `pricing_structure` / `software_pricing` (Inexpensive / Mid Tier / Expensive)
- Integrated other software? → `integrations` (Yes / No / I don't know)
- Which integrated → `integrate_software` (array, max 10)
- Switched from other software? → `is_integrated` / `switched_from` (Yes / No / I don't know)
- Which switched from → `used_software` / `switched_from` (array, max 5)

### Step 2 — Review & Rating
- Review title → `title` ← key field for step 2 check
- Experience (short) → `summary`
- Experience (detailed) → TBD, verify exact field
- Most liked → `strength` / `Review.strength` (inconsistent types — see Data Quality)
- Least liked → `weakness` / `Review.weakness` (inconsistent types — see Data Quality)
- Ratings (all /5): `ease_of_use`, `features_functionality`, `customer_support`, `overall`
- DB also has `value_money`, `on-boarding` ratings — not visible in form, likely derived or legacy

### Step 3 — Reviewer Details (optional, pre-filled from login)
`client_name`, `hidden_identity`, `client_company_name`, `position`, `location`, `client_company_website`, `client_email`, `client_profile_link`

---

## Service Review Form → MySQL `reviews`

### Step 1 — Project Details
- Project title → `project_name` (max 60 chars)
- Project cost → `cost` (dropdown range)
- Industry → `industry_id`
- Project status → `project_status` (In Progress / Completed / etc.)
- Project description → `project_summary` (optional, max 1000 chars)

### Step 2 — Review & Rating
- Service provided → `category_id` (max 1 category)
- One-sentence summary → `conclusion`
- Detailed experience → `feedback_summary` ← key field for step 2 check
- Most liked → `strength`
- Least liked → `weakness`
- Ratings (all /5): `quality` (work), `ability` (scheduling), `reliability` (communication — verify), `overall`

### Step 3 — Reviewer Details (optional, same as software)
`client_name`, `hidden_identity`, `client_company_name`, `position`, `location`, `client_company_website`, `client_email`, `client_profile_link`

---

## MongoDB `goodfirms` — All Collections (28)

`software-reviews`, `software-review-request`, `softwares`, `software-category`, `software-screenshots`, `software-sponsors`, `software-interview`, `software-url`, `software-menu`, `core-feature`, `services_ranks`, `compares`, `popular_comparisons`, `resources`, `resource_download_log`, `magazines`, `magazine-view-log`, `feed`, `companyLogs`, `adminlogs`, `session`, `sessions`, `linkedin-event`, `visit-website-event`, `future-software`, `help-center`

**Deprecated (do not use):** `draft-review`, `contacts`

---

## `software-reviews` Schema (59 fields)

| Field | Type | Step | Notes |
|---|---|---|---|
| `_id` | ObjectId | — | |
| `software_id` | ObjectId | — | |
| `str_software_id` | String | — | String version of `software_id` |
| `software_name` | String | — | |
| `software_slug` | String | — | |
| `reviewer_id` | String | — | |
| `user_id` | String | — | |
| `is_active` | Number | — | 0/1/2 |
| `reason` | String | — | Rejection reason |
| `step` | Number | — | Best indicator of form completion state |
| `requesttoken` | String | — | Present if came via admin invite |
| `is_featured` | Number | — | |
| `is_abandoned` | Boolean | — | |
| `submitted_by` | Number | — | |
| `publish_date` | Number | — | Unix ts |
| `created` | Number | — | Unix ts |
| `updated` | Number | — | Unix ts |
| `response` | String | — | Vendor response |
| `response_date` | String \| Number | — | |
| `client_joint` | Number | — | |
| `client_total_reviews` | Number | — | |
| `layout` | String | — | |
| `video` | String | — | |
| `use_in_time` | String | 1 | |
| `use_time_format` | String | 1 | Unit for `use_in_time` |
| `frequent_use` | String | 1 | |
| `pricing_structure` / `software_pricing` | String | 1 | |
| `integrations` | String | 1 | Yes/No/IDK — possibly also a rating (verify) |
| `integrate_software` | String[] \| null | 1 | |
| `integrations-overall` | String[] \| null | 1 | |
| `is_integrated` | String | 1 | |
| `used_software` | Array \| null | 1 | Switched from |
| `switched_from` | String | 1 | |
| `features` | Document `{category, overall, importance}` | 1 | |
| `consider_software` | String[] \| null | 1 | |
| `title` | String | 2 | Step 2 completion key |
| `summary` | String | 2 | Short description |
| `strength` | String \| Array \| Document \| null | 2 | Inconsistent types |
| `weakness` | String \| Array \| Document \| null | 2 | Inconsistent types |
| `Review` | Document `{strength: String[], weakness: String[]}` | 2 | Structured version |
| `overall` | String \| Number | 2 | /5 |
| `ease_of_use` | String \| Number | 2 | /5 |
| `features_functionality` | String \| Number | 2 | /5 |
| `customer_support` | String \| Number | 2 | /5 |
| `value_money` | String | 2 | /5 |
| `on-boarding` | String | 2 | /5 |
| `recommend` | String | 2 | |
| `promises` | String | 2 | |
| `client_name` | String | 3 | |
| `hidden_identity` | Number \| String | 3 | Display preference |
| `client_company_name` | String \| null | 3 | |
| `position` | String \| null | 3 | |
| `location` | String | 3 | |
| `client_company_website` | String | 3 | |
| `client_email` | String | 3 | |
| `client_profile_link` | String \| null | 3 | LinkedIn |
| `client_img` | String | 3 | |

### `hidden_identity` Mapping (review posting preference)

Used by UI prompt: **"How do you like this review to be posted?"**

| `hidden_identity` | UI text |
|---|---|
| `1` | Display both my name and the company's name with the review |
| `2` | Only display my name with the review |
| `3` | Only display the company's name with the review |
| `4` | Don't display my name and the company's name with the review |

Notes:
- Values are stored as both Number and String in Mongo (`1` and `"1"`, etc.); normalize before comparisons.
- `0` and `null` appear in older records and should be treated as legacy/unset (not current explicit UI options).

---

## `software-review-request` Schema
Admin-initiated email invites for software reviews.

- `_id`, `software_id`, `name`, `email`, `phone`
- `token` — unique invite token
- `software_review_id` — links to `software-reviews._id` once submitted
- `request_sent` — Unix ts of invite send
- `admin_request` — 1 if admin-initiated
- `event` — email event (sent/opened/clicked)
- `error` — delivery error
- `created`, `updated` — Unix ts

---

## MySQL `reviews` Schema (partial)

| Field | Step | Notes |
|---|---|---|
| `publish_status` | — | 0/1/2 |
| `reason` | — | Rejection reason |
| `project_name` | 1 | Max 60 chars |
| `cost` | 1 | Range string |
| `industry_id` | 1 | |
| `project_status` | 1 | |
| `project_summary` | 1 | Optional, max 1000 chars |
| `category_id` | 2 | |
| `conclusion` | 2 | One-sentence summary |
| `feedback_summary` | 2 | Main body — step 2 key field |
| `strength` | 2 | |
| `weakness` | 2 | |
| `quality` | 2 | /5 — work quality |
| `ability` | 2 | /5 — scheduling/timing |
| `reliability` | 2 | /5 — communication (verify) |
| `overall` | 2 | /5 |
| `client_name` | 3 | |
| `hidden_identity` | 3 | |
| `client_company_name` | 3 | |
| `position` | 3 | |
| `location` | 3 | |
| `client_company_website` | 3 | |
| `client_email` | 3 | |
| `client_profile_link` | 3 | LinkedIn |

---

## Data Quality Issues

- `strength` / `weakness` in `software-reviews` — inconsistent BSON types (String, Array, Document, null), normalize before use
- Rating fields in `software-reviews` — String in some docs, Number in others, cast before comparing
- `response_date` — String or Number
- `integrations` — doubles as Yes/No/IDK (step 1) and possibly a rating, verify actual usage
- `step` — exact values not confirmed (e.g. does step=2 mean step 2 complete?), verify
- MySQL `reviews` — full column list not yet explored
