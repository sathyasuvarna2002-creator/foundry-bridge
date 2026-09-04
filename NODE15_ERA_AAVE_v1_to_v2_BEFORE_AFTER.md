# Node 15 (Evidence Review Agent, Aave) — before/after

Source of truth: extracted directly from `Aave - Final (1).json`, the real n8n workflow export
(`15_Evidence_Review_Agent` node's `options.systemMessage` + `Structured Output Parser3`'s
`inputSchema`). Not reconstructed from documentation fragments — pulled from the live, current
canvas and cross-checked against the Node 13/16/17 code embedded in the same export (byte-identical
to the on-disk files already fixed this session, confirming the export is current).

## What was actually wrong

1. **Dead field name.** Both the system prompt (input description + Step 6 guidance, two places)
   and the schema's `fusion_comparison_note` description referenced `divergence.interval_contains_baseline`.
   Node 17 (Aave) v1.1's real output has never had this field — it emits `divergence.interval_position`
   (`below_belief` / `within_interval` / `above_plausibility`). A `15_ERA_fusion_update_v3.md` patch
   written specifically to fix this exists in the project's files but was never actually applied to
   the live prompt or schema.
2. **`fusion_comparison_note` missing from the OUTPUT FORMAT template and 3 of 4 worked examples**
   (F02, F07, F09), despite being schema-`required`. Only the F11 illustration inside Step 6 showed it.
3. **Step 6 was spliced into the middle of "YOUR INPUTS,"** structurally disconnected from Steps
   1–5 (~150 lines later), with a duplicated JSON example and a broken markdown code fence around
   it (an unclosed/misplaced ` ``` `).
4. **Node 13's union output had no input description at all**, despite being fetched in the user
   message (`{{ JSON.stringify($node["13_Deterministic_Evidence_Fusion"].json, null, 2) }}` —
   confirmed present and correctly wired in the real user message). Its `sources` /
   `source_findings` fields (added in Node 13 v2.6, this session) were therefore invisible to the
   agent — real Node 08 audit evidence matched per finding was going completely unused.
5. **No "unmapped audit" handling.** `UNMAPPED-AUDIT-*` findings from Node 13 (real audit findings
   that couldn't be matched to a canonical F01–F11) had no defined place to go — nothing stopped
   the agent from either dropping them silently or forcing them into a `review_assessments` slot,
   which would break the schema's `minItems: 11, maxItems: 11` constraint.

## What did NOT need fixing

The node-reference/user-message block itself (the `{{ $node[...] }}` expressions in
`15_Evidence_Review_Agent.parameters.text`) was already correctly wired — it already fetches Node
06, 07, 09, 10, 12, 13, 14, and 17 by their real live names, plus the raw audit text. This was
re-verified directly against the workflow export rather than assumed. No changes were needed there.

## The two-audit-source question (disclosed, not resolved)

Aave's live workflow still runs two parallel audit paths: the older raw-text chain
(`11_Audit_Repository_Resolver` → ... → `14_Extract_Audit_Text`, feeding ERA via `{{$json.text}}`)
and the newer structured `08_AI_AUDIT` agent whose findings get matched into Node 13's union. I
don't have visibility into whether they draw on the same underlying document. v2 treats them as
two distinct, separately-labeled evidence channels rather than assuming either relationship.

## Changes made (v1 → v2)

- Renumbered "YOUR INPUTS" from 5 items to 7: inserted Node 13 (item 2) and moved DST Fusion to
  item 7, expanded with the correct field names.
- Added a new "UNMAPPED AUDIT CONTEXT" section (mirrors Venus's ERA), placed right after YOUR INPUTS.
- Relocated Step 6 to immediately follow Step 5, removed the duplicate JSON block and broken fence,
  and replaced the `interval_contains_baseline` bullet with correct three-way `interval_position`
  guidance (`below_belief` = structural default, not meaningful on its own; `above_plausibility` =
  genuinely worth naming; `within_interval` = unremarkable).
- Extended Step 2's audit bullet and the `audit_relationship` explanation to cover both audit
  channels (Node 13-matched Node 08 findings, and the raw-text audit) instead of only Sigma Prime.
- Extended the Decision Tree's audit-scope branch the same way.
- Added `fusion_comparison_note` to the OUTPUT FORMAT template and to all 4 worked examples
  (F02, F07, F09, F10) so every example matches what the schema actually requires.
- Added `unmapped_audit_context` as an optional top-level schema property with its own required
  `source_finding_id` / `note` fields, and updated `review_summary.total_findings`'s description
  to clarify it excludes unmapped entries.
- Added CONSTRAINTS bullets: never put `UNMAPPED-*` into `review_assessments`, never treat unmapped
  context as confirming a specific finding, never recompute/contradict Node 17's numbers, never
  reference `interval_contains_baseline`.
- Updated "YOU ARE DONE WHEN" to include the `fusion_comparison_note` and `unmapped_audit_context`
  checks (previously absent from the checklist entirely, even though the field was schema-required).

## Verification performed

- Diffed the corrected prompt's Node references (06, 07, 09, 10, 12, 13, 14, 17) against the real
  `parameters.text` block extracted fresh from `Aave - Final (1).json` — confirmed the corrected
  input numbering matches what's actually fetched, rather than guessing.
- `python3 -c "import json; json.load(...)"` — schema v2 is valid JSON.
- Grepped the corrected prompt for `interval_contains_baseline` — the only two remaining
  occurrences are inside sentences explicitly saying the field does not exist and to use
  `interval_position` instead.
- Grepped for `Step 6:` — appears exactly once, in its correct position after Step 5.
- Counted `fusion_comparison_note` occurrences (11: once in the input description, once in Step 6
  guidance, once in the Step 6 worked example, once each in the 4 example assessments, once in
  OUTPUT FORMAT, once each in the two CONSTRAINTS bullets, once in "YOU ARE DONE WHEN") — confirms
  it's now consistently present everywhere the schema requires it, unlike v1 where it appeared in
  only 2 of the ~9 places it should have.

## Files

- `15_ERA_aave_system_prompt_v2.md` — paste into `15_Evidence_Review_Agent`'s
  `options.systemMessage`, replacing the current text entirely.
- `15_ERA_aave_schema_v2.json` — paste into `Structured Output Parser3`'s `inputSchema`, replacing
  the current schema entirely.
- No change needed to the node's `parameters.text` (user message) — already correctly wired.
