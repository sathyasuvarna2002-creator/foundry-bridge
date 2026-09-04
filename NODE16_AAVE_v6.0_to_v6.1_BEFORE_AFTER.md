# Node 16 (Aave) v6.0 -> v6.1 — provenance passthrough, before/after proof

**Change:** added five metadata-only passthrough fields to each finding in
Node 16 (Aave)'s output, sourced from Node 13's finding object (which
already carries them as of Node 13 v2.6): `finding_resolution`, `sources`,
`source_findings`, `claim_ids_by_source`, `claim_ids_agree`. Nothing else
touched.

## Why this was needed

Node 13 (Aave) v2.6 started unioning Node 07 (architecture) and Node 08
(audit/incident) findings before predicate building, and records how each
finding was resolved and which source(s) contributed it. Node 16 v6.0
predates that change — it reads `finding_id`, `finding_name`, and
`risk_pattern`/`risk_category` off the same Node 13 finding object, but was
never updated to also carry the five newer fields through. They were
silently dropped on the floor, exactly the same gap Node 16 (Venus) v1.0
had for `claim_id` before its v1.1 fix (see
`NODE16_CLAIM_ID_BEFORE_AFTER.md`). This is the same fix, for the same
underlying reason, applied to the Aave side.

## What changed in the source (full diff)

Four changes only, all additive:
1. Header comment — changelog note (v6.0 -> v6.1).
2. `extractNode13Findings()`: five added lines reading `finding.finding_resolution`,
   `finding.sources`, `finding.source_findings`, `finding.claim_ids_by_source`,
   and `finding.claim_ids_agree` into the internal `fixedFindings`
   representation, each defensively typed (`?? null`, `Array.isArray(...) ? ... : []`,
   `isObject(...) ? ... : null`) so an older, pre-v2.6 Node 13 payload that
   doesn't have these fields degrades to `null`/`[]` instead of throwing.
3. The final findings-output loop: five added lines copying those values
   onto each output finding object, unchanged.
4. `version: "6.0"` -> `"6.1"` in the output JSON.

None of the five fields are read, compared, matched, or branched on
anywhere else in the file — not in `assessProposition`, not in
`combineObservations`, not in `classifyFindingStatus`, not in the
self-verification block, not in `qa`. A `grep` for these field names in the
file shows exactly the two write sites above (plus the header comment) and
nothing else.

## Behavioral proof

Built a sandboxed test harness (Node.js `vm` module, mocking n8n's `$()`
and `$input.first()`) and ran both v6.0 and v6.1 against the same
synthetic Node 13 (Aave) payload — all 11 canonical findings, F01 sourced
from Node 07 only, F02 sourced from both Node 07 and Node 08 with
disagreeing claim_ids (to exercise the multi-source case), matching runtime
evidence for every RUNTIME_EXISTENCE predicate and a matched resolver
record for F05's RESOLVER_EXECUTION predicate — then deep-compared the
outputs after stripping only the five new fields and the version string.

Result: **byte-identical.** Every `status`, every `proposition`, every
`source_assessments` entry, every `supporting_observations` /
`contradicting_observations` / `unresolved_observations` array, the `qa`
block (`self_verification_passed: true`, `all_11_findings_present: true`),
and the `resolver_index` are identical between v6.0 and v6.1. The only
difference in the raw output is the five new keys appearing on each
finding in v6.1 (confirmed present, correctly populated — including the
F02 multi-source case showing `sources: ["NODE_07_ARCHITECTURE",
"NODE_08_AUDIT"]` and `claim_ids_by_source` with the differing claim IDs)
and the version string.

**Backward-compatibility check:** re-ran the same harness with the five new
fields stripped from the Node 13 payload (simulating a stale, pre-v2.6
Node 13 run). v6.1 did not throw — the five fields resolved to `null` /
`[]` / `null` as designed, and `self_verification_passed` /
`all_11_findings_present` both stayed `true`.

**Conclusion:** the change is proven metadata-only, exactly like the Venus
`claim_id` precedent. No evaluation, no status, no predicate result, no K3
aggregation, no DST-relevant output changed.
