# Node 16 (Venus) v1.0 -> v1.1 — claim_id passthrough, before/after proof

**Change:** added `claim_id` as a metadata-only passthrough field on each finding
in Node 16 (Venus)'s output, sourced from Node 13's finding object (which
already carries it). Nothing else touched.

## What changed in the source (full diff)

Four changes only, all additive:
1. Header comment — changelog note.
2. `extractNode13Findings`: one added line reading `finding.claim_id` into the
   internal `fixedFindings` representation.
3. The final findings-output loop: one added line copying that value onto
   each output finding object.
4. `version: "1.0"` -> `"1.1"` in the output JSON.

`claim_id` is not read, compared, matched, or branched on anywhere else in the
file — not in `assessProposition`, not in `combineObservations`, not in
`classifyFindingStatus`, not in the self-verification block, not in `qa`. A
`grep` for `claim_id` in the file shows exactly the two write sites above and
nothing else.

## Behavioral proof

Ran v1.0 and v1.1 against four scenarios in a sandboxed harness — the same
real Venus finding structure (6 findings / 16 propositions) plus edge cases
already used to validate v1.0 originally, each fed through both versions,
outputs deep-compared after stripping only `claim_id` and `version`:

| Scenario | Output identical (claim_id/version aside) |
|---|---|
| Full input, no separate Foundry node | PASS |
| Live Foundry experiment present | PASS |
| Gate test (`requires_execution: true` despite a named test) | PASS |
| Conflicting pass/fail signal test | PASS |

All four: every `status`, every `proposition`, every `source_assessments`
entry, every `supporting_observations` / `contradicting_observations` /
`unresolved_observations` array, the `qa` block, and `self_verification_passed`
are byte-identical between v1.0 and v1.1. The only difference in the raw
output is the new `claim_id` key appearing on each finding (confirmed present
on all findings in v1.1, absent in v1.0) and the version string.

**Conclusion:** the change is proven metadata-only. No evaluation, no status,
no predicate result, no K3 aggregation, no DST-relevant output changed.
