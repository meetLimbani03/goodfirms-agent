# Live Service Review Schema (Agent Input)

## Scope
- Source: `data/service_reviews.json` + `data/service_reviews_page2.json`
- Sample analyzed: 40 fresh records (20 + 20)
- Purpose: define the **current** schema to use for agent pre-check + review workflow

## Access / Freshness Note (as of 2026-02-27)
- Production MySQL MCP (`Prod-goodfirms-mysql`) is currently not reachable.
- For MySQL-backed validation, use local DB `GoodFirms` imported from `data/gf.sql`.
- Snapshot timestamp from dump footer: `2026-02-17 02:26:06` (10 days old as of 2026-02-27).

## Eligibility Gate (for automation)
A service review is eligible for agent processing when all are true:
- `is_draft == false`
- status is pending/unpublish:
  - `status.current.code == "0"` (from extracted JSON), or
  - equivalent DB state `publish_status = 0` (check via local `GoodFirms` snapshot until prod MySQL MCP is restored)
- required content fields are present (see below)

## Required Fields

### Core identity
- `review_id` (numeric/string id)
- `entity_name` (company name being reviewed)
- `entity_url`

### Project context (from `labeled_fields`)
- `labeled_fields["Project title"]` (non-empty string)
- `labeled_fields["Brief description of your project"]` (non-empty string)
- `labeled_fields["Project Budget"]` (non-empty string)
- `labeled_fields["Project Status"]` (non-empty string; observed `Completed|In progress`)
- `labeled_fields["Industry"]` (non-empty string)
- `labeled_fields["Services"]` (non-empty string)

### Review content
- `title` (non-empty string)
- `review_text` (non-empty string)
- `question_answers` (array length >= 2)
- `question_answers[0].answer` (non-empty string)
- `question_answers[1].answer` (non-empty string)

### Ratings
- `rating_breakdown["Quality Work"]` (1-5)
- `rating_breakdown["Scheduling and Timing"]` (1-5)
- `rating_breakdown["Communication"]` (1-5)
- `rating_breakdown["Overall Experience"]` (1-5)
- `overall_rating` (1-5)

### Reviewer verification
- `reviewer_name` (non-empty string)
- `posting_preference` (non-empty string; one of the UI posting choices)

## Optional Fields
- `reviewer_role` (missing in some non-draft rows)
- `profile_url`
- `profile_image_url`
- `profile_title`
- `features_used`
- `show_on_front`
- `verified`
- `status` (full object with available/current labels)
- `submitted_on`
- `edit_url`

## Posting Preference Values (text)
- Display both my name and the company's name with the review
- Only display my name with the review
- Only display the company's name with the review
- Don't display my name and the company's name with the review

If backend `hidden_identity` is needed, use:
- `1` -> both name + company
- `2` -> only my name
- `3` -> only company name
- `4` -> hide both

## Proposed Agent Payload Shape
```json
{
  "review_type": "service",
  "source_id": "review_id",
  "status": {
    "is_draft": false,
    "publish_code": "0",
    "publish_label": "Unpublish"
  },
  "company_reviewed": {
    "name": "entity_name",
    "url": "entity_url"
  },
  "project": {
    "title": "Project title",
    "description": "Brief description of your project",
    "budget_range": "$10001 to $50000",
    "status": "Completed",
    "industry": "Information Technology",
    "service_category": "Artificial Intelligence"
  },
  "review": {
    "title": "Review title",
    "detailed_experience": "review_text",
    "most_liked": "question_answers[0].answer",
    "least_liked": "question_answers[1].answer",
    "ratings": {
      "quality_work": 5,
      "scheduling_timing": 5,
      "communication": 5,
      "overall_experience": 5,
      "overall_rating": 5
    }
  },
  "reviewer": {
    "name": "reviewer_name",
    "role": "optional reviewer_role",
    "posting_preference_text": "Only display my name with the review"
  },
  "meta": {
    "submitted_on": "2026-02-24 05:48:48",
    "verified": false,
    "edit_url": "/administrator/review/edit/84907"
  }
}
```
