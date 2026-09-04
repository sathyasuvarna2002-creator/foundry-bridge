# Deterministic Evidence Fusion Engine — Plain-Language Summary

**File:** `Deterministic_Evidence_Fusion_Engine.js`
**n8n node name:** `Deterministic Evidence Fusion`

## Why this file didn't have a number before

Every other pipeline-stage file in this repo (`06_...` through `19_...`) is
versioned per protocol where its content differs — `13_deterministic_evidence_specification.js`
has an explicit `_venus` sibling, `16_deterministic_evidence_anchor.js` too, and
so on. This node never got that treatment: it's the same single Code node,
shared unmodified across Aave, Venus, and Compound, sitting between
`12_Temporal_Evidence_Engine` and `11_Audit_Repository_Resolver` in the graph.
Because it was never saved as a numbered file, there was no changelog and no
record of what it actually did — any bug in it silently affected all three
protocols' fused confidence scores at once, retroactively, with no paper trail.
This file (and this changelog) exist to close that gap. It's deliberately
*not* given a `13`/`16`-style number, since doing so would misrepresent it as
a single linear stage when it's actually a shared, cross-protocol node — the
absence of a number is itself the documentation of that fact.

## What was wrong with it

Six real bugs, found by reading the node's own source against the actual
Solidity validators and real n8n run outputs, not by inspection alone:

1. **`foundry.flashLoansSupported` (plural) vs. the real field
   `foundry.flashLoanSupported` (singular).** The typo meant this field was
   always `undefined` — flash loan evidence was silently never read,
   regardless of the real value.

2. **`validated_properties` was a static, always-true array.** It
   unconditionally claimed "Flash Loan Capability Confirmed" and "Contract
   Deployment Confirmed" even when those were false — a factually incorrect
   claim in an investment-committee-facing report. Now built conditionally
   from the actual evidence.

3. **`sourcesExpected` was hardcoded to 5.** Only 4 sources are actually
   evaluated at this pre-audit stage (runtime, architecture, historical,
   temporal — audit is explicitly deferred per the node's own
   `sources_pending: ["AUDIT"]`). The wrong denominator capped `support_ratio`
   at 0.8 even when all 4 real sources fully agreed. `sourcesExpected` is now
   4, and `sources_evaluated` is derived from the actual count of sources
   that returned usable evidence rather than a separate hardcoded `4` that
   could silently diverge from reality.

4. **`institutional_readiness` and `institutional_assessment_ready` were
   hardcoded literals** (`true` / `false` / `true`) — never derived from any
   evidence, confidence score, or pending-source state. That's why
   `institutional_assessment_ready` (hardcoded `true`) and
   `ready_for_final_assessment` (hardcoded `false`) could read as
   contradictory: neither meant anything relative to real evidence. Now:
   `ready_for_audit` requires runtime validation to have succeeded AND at
   least one other source to have returned usable confidence.
   `ready_for_final_assessment` is computed from `sources_pending` (always
   false at this pre-audit stage, by design, but now genuinely computed
   rather than coincidentally correct). Top-level
   `institutional_assessment_ready` is kept for backward compatibility but is
   now an explicit alias of `ready_for_audit`.

5. **`flashLoanSupported` evidence text overclaimed "verified absence."**
   First-pass fix said `false` meant flash loans were "explicitly checked and
   found unsupported." Checked the actual Solidity validators before
   shipping this: `flashLoanSupported` is declared once in the shared
   `ValidationResult.sol` struct (Solidity default `false`). Only
   `AaveValidator.sol` actually determines it (a real `try/catch` on
   `FLASHLOAN_PREMIUM_TOTAL()`) — `VenusValidator.sol` and
   `CompoundValidator.sol` never touch the field, so their `false` is an
   unset default, not a verified answer. A JSON bool can't represent
   "undefined," so there's no way to distinguish "actively verified false"
   from "defaulted false" from the payload alone. Reverted to neutral
   language ("no flash loan capability detected via the available runtime
   interface") that's accurate for all three protocols regardless of which
   validator actually performs the check, and removed the "Confirmed Absent"
   claim from `validated_properties` for the same reason. A real fix would
   need an explicit `flashLoanChecked` field added to `ValidationResult.sol`
   and each validator — a Solidity-layer change, out of scope for this file.

6. **`historicalConfidence` averaged in no-precedent entries as zeros.** The
   Historical Intelligence Agent correctly returns `precedent_found: false`
   when it doesn't have a genuine match, rather than forcing a weak one —
   exactly the conservative behavior its prompt is designed to reward. The
   old averaging logic folded those in as confidence-0 data points,
   penalizing the agent for being appropriately conservative. Confirmed on
   real Compound data: 4 genuine precedent matches averaging 0.85 were
   dragged down to 0.57 by 2 no-precedent zeros, flipping the reported
   support tier from `SUPPORTED` to `LOW_CONFIDENCE` and pulling
   `deterministic_confidence` down by roughly 0.05. Fixed by averaging only
   over assessments where `precedent_found === true`; the no-precedent count
   is now reported separately in the evidence/reasoning text instead of
   silently folded into the confidence number. Also checked against real
   Aave data (1 no-precedent case of 11, scored 0.3 not 0) — same dilution
   mechanism, much smaller effect, which is why it went unnoticed until
   Compound's higher no-precedent proportion made it visible.

## How I know it works

Verified via `node --check` after every revision, plus mock-run test
harnesses stubbing `$()` (n8n's node-reference syntax) with real pasted
Compound and Aave data shapes, confirming exact expected numeric outputs:
Compound → 0.85 `historicalConfidence`, 0.92 `deterministic_confidence`,
`SUPPORTED` tier; Aave → 0.86 `historicalConfidence`, negligible change,
tier unchanged; all-no-precedent edge case → 0 `historicalConfidence`,
`UNAVAILABLE` tier, no divide-by-zero.

**Confirmed against real n8n runs**, not just the sandbox: pasted live
execution output after each fix and verified the corrected fields were
actually present in the live payload — FIX 4 (`institutional_readiness`),
then the OLD FIX 5 text still showing (caught before the correction shipped),
then the CORRECTED FIX 5 text live, then FIX 6's `historicalConfidence`
recalculation live on a real Compound run.

## Why this matters across all three protocols

Unlike a bug in `13_...`/`16_...`, which is scoped to whichever protocol's
versioned file it's in, every one of these six bugs affected Aave, Venus,
*and* Compound simultaneously and retroactively, since all three protocols
run through this exact same node. That's the reason this file needed cross-
protocol verification at every step rather than being treated as a
Compound-only fix.
