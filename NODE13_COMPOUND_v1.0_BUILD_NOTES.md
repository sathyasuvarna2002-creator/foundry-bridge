# Node 13 (Compound) v1.0 — build notes

## What this is

Compound's counterpart to `13_deterministic_evidence_specification.js`
(Aave) and `13_deterministic_evidence_specification_venus.js`. Built on the
Venus shape — open taxonomy, anchor-token matching — not Aave's fixed-ID
list, because two independent live Node07 runs against the corrected v6
prompt produced different finding_id/risk_category placements for the same
underlying claims. Fixed-ID matching would have broken the same way it
originally did for Venus.

## Two things this file does that Aave/Venus's don't

**A negative control that's always emitted.** UPGRADEABILITY-01 isn't a risk
to prove — it's a risk that's been confirmed *not to apply* to this specific
deployment, three independent ways this session (real ABI, live `cast call`,
and CompoundValidator.sol's own pre-existing source comment). The real
`forge test` (`test_ImplementationGetterDoesNotExist`, PASS) formalises that.
Rather than waiting for Node07 to mention it, this finding is built directly
from the real Foundry evidence and always appears in the output, tagged
`finding_polarity: "NEGATIVE_CONTROL"`. PASS here means the risk is ruled
out, not confirmed — flagged loudly in the header comment and in
`evidence_boundaries`, because every other finding in this file (and in
Aave/Venus's files) has PASS mean the opposite. Anchor tokens
(`_setImplementation`, `_becomeImplementation`, `delegator`, etc.) are kept
in the spec on purpose: if a future run ever does claim a delegator pattern
here (hallucination, or an actual future migration), it resolves to this
same spec key and gets checked against the same real evidence instead of
going unmatched. Tested this path directly — a synthetic finding with real
delegator-pattern tokens resolves correctly and gets contradicted by the
real test result, not silently ignored.

**A third behavioural outcome, not just pass/fail.**
`CompoundInterestAccrualTest` reverted for real against live mainnet — but
on a named precondition check (`InterestRateModel` returned a 0 borrow rate
at the current block), not a claim contradiction. Folding that into either
PASS or FAIL would misrepresent what actually happened, so
`buildBehaviouralPredicate()` now has a third state,
`EXECUTED_PRECONDITION_UNMET`: the experiment really ran against live state,
but the real-world condition needed to observe the claim wasn't met right
now. Disclosed as its own summary counter
(`behavioural_predicates_executed_precondition_unmet`), never silently
merged into either pass or fail counts.

## What's deliberately NOT included

Two real, passing tests — `CompoundGovernanceModelCheckTest` and
`CompoundSeizeAuthorizationTest` — don't map to any of the 5 audited
findings in `Compound_Node07_Risk_Findings.json`. Their closest match
(Centralisation, Composability) appeared only in the example payload that
was mistakenly pasted into Node07's structured-output-parser schema field
(found and fixed this session — see `Compound_workflow_FIXED.json`), never
independently audited as canonical. Rather than inventing two new canonical
findings on my own inference, or silently dropping two real passing tests,
both are disclosed in `evidence_boundaries.real_tests_with_no_canonical_
finding` and left as an open decision.

## How I know it works

Built a sandboxed test harness stubbing `$()` (n8n's node-reference syntax)
and ran it against real data, not synthetic guesses, in four scenarios:

1. **The real first live Node07 run** (5 findings: Centralisation,
   Dependency, Economic Dependency, Trust Boundary, Composability — none of
   which are a clean canonical match except Economic Dependency). First pass
   through this caught a real bug: Trust Boundary's claim
   (`COMPOUND-DOTRANSFERIN-GETCASHPRIOR-UNDERLYING`) was silently absorbing
   into `ASSET_CUSTODY_01` because both findings' evidence happens to
   mention `getCashPrior`, even though they're different claims. Fixed by
   removing `getCashPrior` from `ASSET_CUSTODY_01`'s anchor set (kept
   `exchangeRateStoredInternal`/`exchangeRateStored`/`balanceOf`, which
   remain unique to the audited donation-attack claim) and re-ran to confirm
   Trust Boundary now correctly falls to `UNMAPPED` instead.
2. **The same run plus a realistic Foundry runtime payload** (field names
   matched directly against `CompoundValidator.sol`'s real output shape) —
   same resolution, confirms runtime predicates evaluate without error.
3. **Nothing wired at all** — confirms no crash; only the always-emitted
   negative control appears, everything else correctly reports "no matching
   finding this run" instead of fabricating one.
4. **Synthetic full-coverage run** built directly from the corrected
   canonical taxonomy's own `mechanism_tokens`, including a synthetic
   hallucinated delegator claim standing in for UPGRADEABILITY-01 — all 5
   findings resolved to the correct spec key, and the hallucinated claim
   correctly resolved into `UPGRADEABILITY_01` and was contradicted by the
   real Foundry evidence rather than silently accepted or left unmatched.

All four ran clean after the anchor-token fix. `node --check` passed
throughout.

## Real Foundry evidence wired into `MANUAL_FOUNDRY_SNAPSHOT`

Run by the user directly against live Ethereum mainnet (block 25788996,
forge 1.7.1, 2026-08-19) — not fabricated or assumed:

| Test | Result |
|---|---|
| `CompoundUpgradeableProxyControlTest` | PASS (negative control) |
| `CompoundReserveFactorAccessControlTest` | PASS |
| `CompoundDonationAttackTest` | PASS (real numeric deltas recorded) |
| `CompoundPauseGuardianDeprecationTest` | PASS, 3/3 sub-tests |
| `CompoundInterestAccrualTest` | EXECUTED_PRECONDITION_UNMET |
| `CompoundGovernanceModelCheckTest` | PASS (no canonical finding yet) |
| `CompoundSeizeAuthorizationTest` | PASS (no canonical finding yet) |
