# Software Review Context

## Agent Prompt And Instructions

```md
You are reviewing a review provided on a software product.

Your task is to:
- verify authenticity and internal consistency of the review
- improve writing quality while preserving factual meaning and sentiment
- avoid inventing any facts
- keep edits very minimal and focused eg: correcting grammatical mistakes, spelling mistakes, punctuation, spacing

Important rules:
- preserve factual meaning
- preserve sentiment direction
- title must align with the review body
- ratings must align with the narrative tone
- strength and weakness must be meaningfully different
- treat trust/risk signals as supporting context, not as proof by themselves
- if identity or consistency signals are weak or conflicting, prefer a manual-review outcome over overconfident acceptance

What you are given:
- software details
- review text and ratings
- reviewer details
- compact trust/risk/identity-match signals
- software usage context
```

## Agent Fields

```md
- `subject.name`: from `software_name`
- `subject.category_labels`: resolved from `features.category` via `software-category` // include readable category names, not raw ids

- `reviewer.name`: resolved from `client_name` and `users.name` // use review value first; backfill from profile if review is empty
- `reviewer.email_domain`: derived from resolved `client_email` / `users.email` // send domain only, not full email
- `reviewer.company_name`: resolved from `client_company_name` and `users.company_name` // review-first, profile-backfill second
- `reviewer.position`: resolved from `position` and `users.position` // review-first, profile-backfill second
- `reviewer.location`: resolved from `location` and `users.location` // review-first, profile-backfill second
- `reviewer.posting_preference_label`: from `hidden_identity` // review-only field; not present in `users`
- `reviewer.company_website_host`: derived from resolved `client_company_website` / `users.company_website` // compare and send normalized host only
- `reviewer.profile_link_host`: derived from resolved `client_profile_link` / `users.public_url` // compare and send normalized host only

- `review_content.headline`: from `title` // main review title
- `review_content.body`: from `summary` // main review text
- `review_content.strength`: from `strength` // most liked
- `review_content.weakness`: from `weakness` // least liked
- `review_content.ratings.ease_of_use`: from `ease_of_use` // normalized numeric rating
- `review_content.ratings.features_functionality`: from `features_functionality` // normalized numeric rating
- `review_content.ratings.customer_support`: from `customer_support` // normalized numeric rating
- `review_content.ratings.overall`: from `overall` // normalized numeric rating

- `usage.duration_value`: from `use_in_time` // normalized numeric-like duration
- `usage.duration_unit`: from `use_time_format` // normalized duration unit
- `usage.frequency`: from `frequent_use` // normalized usage frequency
- `usage.pricing`: from `software_pricing` // normalized pricing opinion
- `usage.integrates_other_software`: from `is_integrated` // yes | no | other
- `usage.integrated_software`: resolved from `integrate_software` via `softwares` // send names, not ids
- `usage.switched_from_other_software`: from `switched_from` // yes | no | other
- `usage.used_software_before_switch`: resolved from `used_software` via `softwares` // send names, not ids

- `signals.account_found`: derived from `users.id` join on `user_id` // compact trust signal
- `signals.inferred_login_method`: derived from `users.google_id` / `users.social_id` // compact auth provenance signal
- `signals.review_email_matches_account_email`: derived compare // include boolean only
- `signals.review_name_matches_account_name`: derived compare // include boolean only
- `signals.review_company_matches_account_company`: derived compare // include boolean only
- `signals.risk_flags`: backend-derived compact flags // include concise review/authenticity concerns only
- `signals.trust_flags`: backend-derived compact flags // include concise positive evidence only
```
