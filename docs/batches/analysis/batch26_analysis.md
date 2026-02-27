Delta: add a narrative-presence check because the current readability rule only targets gibberish/placeholder tokens, not reviews that submit summary+strength+weakness completely empty even though metadata exists. Evidence: 66820d17b7cf77a9480bba17.
Patch:
+### 1.6 Narrative presence
+- Reject reviews whose summary, strength, and weakness are all empty; nothing to verify even if ratings or metadata are present.