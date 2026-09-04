# Node 16 — Plain-Language Summary

**File:** `16_deterministic_evidence_anchor_venus.js` (new — Venus companion to the Aave `16_...` v6.0 file)

## Why Node 16 needed a Venus version

Same root problem as Node 13: the Aave version of Node 16 requires findings to be
named `F01`–`F11` exactly, and throws if they aren't. Ran the pasted Aave v6.0
script against real Venus output (`UPGRADEABILITY_01`, `DEPENDENCY_01`, etc.) and
confirmed it fails immediately — none of the 6 Venus finding IDs match the `F##`
pattern, so it extracts zero findings and throws "must supply exactly the 11
canonical findings."

There was a second, less obvious problem underneath that one. The Aave version
looks up behavioral (L3 experiment) evidence from a separate live Foundry node,
keyed by proposition ID. Venus doesn't have that live endpoint yet — tonight's 5
passing forge-test results are recorded directly on each predicate in Node 13
(Venus)'s own output, as `validation_result` / `validation_evidence`. Even after
fixing the ID-matching problem, the Aave version would still report all 5 of
those real, passing tests as "unresolved" because it's looking in the wrong
place.

## What the Venus version does differently

1. **Open finding taxonomy.** No fixed 11-ID list. Accepts whatever finding IDs
   Node 13 (Venus) actually supplies. Only enforced rule: no duplicates in a
   single run (throws if there are).

2. **Two-tier experiment evidence, clearly labeled.** For behavioral claims,
   checks a live Foundry node first (if one exists later). If there's nothing
   there, falls back to Node 13 (Venus)'s own embedded manual test-run record —
   but only accepts it as proof when the record itself says the test was
   actually run (`requires_execution: false`) and names a specific test
   (`executed_test`). A proposed-but-not-yet-run test (like the reserve-reduction
   one, which is honestly marked `NOT_TESTED`) stays unresolved either way.
   Every result sourced from the manual snapshot is tagged
   `Foundry-manual-snapshot` in the output, never `Foundry-live` — so nothing
   downstream can mistake a manually recorded test for a live re-execution.

3. **Runtime checks look in one more place.** Venus's Foundry data nests
   properties under an `observations` key; added that as a container to check,
   plus a last-resort fallback to Node 13 (Venus)'s own mirrored runtime data if
   no separate Foundry node is wired in at all.

4. **Proposition IDs used as-is** (`UPGRADEABILITY-01-P01`), not reformatted to
   Aave's `F01-P01` shape.

Everything else — the three-value logic (supported/contradicted/unresolved),
architecture evidence only counting if it's mapped to that specific proposition
(not borrowed from the finding level), and the self-check that runs before
returning — carried over unchanged from the Aave v6.0 file.

## How I know it works

Ran it against your actual Venus payload (all 6 findings, 16 propositions) in a
sandboxed test harness with five scenarios:

- **No separate Foundry node at all** (worst case — everything has to come from
  Node 13's own embedded data): 5 of 6 findings came back `FULLY_SUPPORTED`, the
  reserve-reduction one came back `PARTIALLY_SUPPORTED` because its untested
  behavioral claim correctly stayed `UNRESOLVED` instead of being guessed at.
  Matches the real state of the evidence exactly.
- **Live Foundry result added for one proposition**: correctly preferred over
  the manual snapshot, labeled `Foundry-live`.
- **Duplicate finding ID injected**: threw, as it should.
- **Manual snapshot with `requires_execution: true` but a test name present
  anyway**: stayed `UNRESOLVED` — confirms the gate requires both conditions,
  not just one.
- **Manual snapshot with conflicting pass/fail signals**: stayed `UNRESOLVED`
  with the conflict named, not silently resolved either way.

All five behaved as designed. No crashes, no fabricated passes.

**Confirmed against a real n8n run of the full pipeline** (not just the sandbox
test): same result — 5/6 findings `FULLY_SUPPORTED`, `OPERATIONAL_RESILIENCE_01`
`PARTIALLY_SUPPORTED` with its untested experiment correctly `UNRESOLVED`, all 5
real passes labeled `Foundry-manual-snapshot`, `self_verification_passed: true`.
The live `10_Foundry_Validation` node was present and matched directly for all
`RUNTIME_EXISTENCE` checks, so the last-resort mirror fallback wasn't even
needed — better than the sandbox test, since that means real independent
verification for those propositions rather than a same-node fallback.

## v1.2 — two correctness fixes found on a fresh code review

You pasted the v1.0 script back in for a check — turns out that's what's still
live in n8n; the repo had already moved to v1.1 (claim_id passthrough, no
logic change). Both bugs below were present in v1.0 *and* v1.1, so they're
fixed together here as v1.2. Paste this whole file into Node 16 (Venus),
replacing everything.

1. **`historicalAssessment()`/`temporalAssessment()` always claimed "FOUND."**
   The functions took no input and returned a hardcoded
   `observation_state: "FOUND"` on every call — regardless of whether the
   Historical or Temporal node actually returned anything. Both variables
   were fetched at the top of the file and then never read again. This
   doesn't affect any finding's SUPPORTED/CONTRADICTED status (historical
   and temporal are, and remain, contextual-only), but it's a false claim
   sitting inside a file whose entire point is "never assert evidence that
   wasn't actually observed." Now it genuinely checks whether the upstream
   payload had content, and reports `NOT_OBSERVED` when it didn't.

2. **`empty_or_unparseable_finding_blocks` was silently always 0 on 5 of 6
   possible input shapes.** `extractNode13Findings()` tries six different
   paths to find Node 13 (Venus)'s findings array
   (`deterministic_evidence.findings`, `findings`, `specification.findings`,
   `deterministic_specification.findings`, `output.findings`,
   `output.specification.findings`) and uses whichever matches first. The
   QA metric that's supposed to report how many raw finding blocks got
   dropped during parsing only ever re-checked the *first* of those six
   paths directly — so on any run where Node 13 actually used one of the
   other five, the fallback math compared a list to a copy of itself and
   always came out to exactly 0, hiding real parse-drop counts.
   `extractNode13Findings()` now reports the true raw block count of
   whichever path it actually matched, so this metric is accurate no
   matter which shape Node 13 (Venus) sends.

Verified with `node --check` (syntax) and a sandbox run: historical/temporal
payloads of `{}` now correctly report `NOT_OBSERVED` (previously always
`FOUND`); a `node13.findings` payload (the second candidate path, not the
first) with one deliberately-unparseable block now correctly reports
`empty_or_unparseable_finding_blocks: 1` (previously always 0 on that path).

---

# Node 16 (Compound) — `16_deterministic_evidence_anchor_compound.js`

## Why Compound needed its own Node 16, architecturally different from Aave/Venus

Aave's and Venus's Node 13 files only *declare* propositions/predicates and
leave all evaluation against live Foundry/architecture/behavioural evidence
to Node 16. Compound's Node 13 doesn't follow that split — it evaluates every
predicate itself, inline, against live sources, and already emits a
`validation_result` per predicate (`PASS` / `FAIL` / `UNVERIFIABLE` /
`MAPPED_PENDING_INDEPENDENT_VERIFICATION` / `NOT_TESTED` /
`EXECUTED_PRECONDITION_UNMET`). Re-implementing Aave/Venus's independent-
evaluation logic on top of that would either duplicate real evaluation logic
that could drift out of sync, or re-derive evidence Node 13 already
processed for no benefit. So Node 16 (Compound)'s actual job is: re-express
Node 13's already-evaluated `validation_result` in the same K3 truth space
and output shape as the Aave/Venus Node 16 files, without independently
re-evaluating anything. `independent_re_evaluation_performed: false` is
disclosed explicitly in the output for this reason, not left to be inferred.

`validation_result` → K3 status mapping: `PASS`→SUPPORTED, `FAIL`→CONTRADICTED,
`NOT_TESTED`/`UNVERIFIABLE`/`EXECUTED_PRECONDITION_UNMET`/`MAPPED_PENDING_
INDEPENDENT_VERIFICATION`→UNRESOLVED. That last mapping is deliberately *not*
SUPPORTED, even though Aave/Venus's Node 16 treats an equivalent
"proposition-specific architecture evidence exists" state as SUPPORTED —
Compound's own Node 13 evaluator explicitly labels this state as "mapped to
the predicate but not independently treated as deterministic proof," which
is more conservative than Aave/Venus's equivalent handling. This file
preserves that conservatism rather than silently overriding it for
cross-protocol consistency — a disclosed, deliberate methodological
asymmetry, not a bug.

`UPGRADEABILITY_01` is a negative control (`finding_polarity:
"NEGATIVE_CONTROL"`): PASS means the risk is ruled out, not confirmed. A new
`status_interpretation` field (`RISK_RULED_OUT` / `RISK_CONFIRMED` /
`RISK_CONTRADICTED` / `INDETERMINATE`), derived from `(status,
finding_polarity)`, makes this explicit so a downstream reader never
misreads a negative control's PASS as risk confirmation.

## v1.0 → v1.1 — two correctness fixes found before/after first live wiring

1. **Wrong candidate node name.** `NODE_13_CANDIDATES` originally included
   `"13_Deterministic Evidence Fusion"`, based on a name reported from the
   canvas. Parsing a fresh full workflow export (`Compound (7).json`)
   confirmed that name actually belongs to the Deterministic Evidence Fusion
   Engine — a different, upstream node entirely (fuses runtime/architecture/
   historical/temporal confidence; unrelated to Node 13's predicate
   specification). Removed it, and moved
   `"13_Deterministic_Evidence_Specification_Compound"` (the correct name)
   to the front of the candidate list.

2. **UNMAPPED findings silently lost their identifying data.** Node 13
   (Compound) emits two different field shapes: resolved findings carry
   `finding_name` / `sources[]` / `claim_ids_by_source` / `risk_category` /
   `finding_resolution` / `anchor_tokens_matched`; the 21 `UNMAPPED-*`
   findings (from `buildUnmappedFinding` in Node 13) carry a *different*
   shape entirely — `source` (singular), `claim_id` (singular),
   `source_finding_name`, `reason`, `resolution_debug`. The original
   `findings` mapping only read the resolved-finding field names, so every
   UNMAPPED finding in a real run showed up as a bare `"finding_name":
   "UNMAPPED-1"` with `"sources": []` and no `reason` — silently discarding
   exactly the transparency data Node 13's own design exists to disclose.
   Fixed by reading both shapes with fallbacks and preserving the
   unmapped-specific fields under their own names (`node13_validation_
   status`, `claim_id`, `unmapped_reason`, `resolution_debug`).

Verified with `node --check` (syntax) and a sandbox test replicating the
exact real `UNMAPPED-1` payload shape from a live run — confirmed
`finding_name`, `sources`, `claim_id`, `unmapped_reason`,
`node13_validation_status`, and `resolution_debug` all populate correctly.

**Confirmed against a real n8n run of the full pipeline** (24 findings: 3
deterministic-ready — `ACCESS_CONTROL_01`, `ECONOMIC_DEPENDENCY_01` both
`PARTIALLY_SUPPORTED`/`INDETERMINATE`, `UPGRADEABILITY_01`
`FULLY_SUPPORTED`/`RISK_RULED_OUT` — plus 21 `UNMAPPED-*` findings, all now
showing their real names/sources/reasons; 7 propositions, 0 contradictions;
3 behavioural predicates split 2 supported / 1 `EXECUTED_PRECONDITION_UNMET`
/ 0 contradicted, matching the real forge snapshot exactly;
`self_verification_passed: true`).
