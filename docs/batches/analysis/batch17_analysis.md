- Add a “Review presence” check so submissions whose title/summary/strength/weakness are all blank are rejected as “incomplete review”; 1.1 currently only verifies readability if text exists, so empty batches like record `65b105dad45e4d758608a1a9` bypass the policy. Patch:
+### 1.1a Review presence
+- Reject reviews whose title/summary/strength/weakness are all empty (mark “incomplete review”).