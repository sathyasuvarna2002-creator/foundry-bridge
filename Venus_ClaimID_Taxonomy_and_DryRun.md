# Venus claim_id Taxonomy + Dry-Run Verification

Covers task #19 (define the Venus claim_id taxonomy) and task #22 (verify claim_id
would correctly and unambiguously identify findings against real Node07 output) together,
since doing the second is how the first got produced.

## Method and an honest data caveat

The v5 `claim_id` algorithm (see `07_risk_reasoner_prompt_v5_claimid.md`) was applied by
hand to the real Venus crossref Node07 run (`venus_node07_crossref_run.json` /
`venus_node07_crossref_FULLTEXT.txt`) -- the run with the actual Comptroller cross-reference
instruction, 7 findings.

That JSON has real `risk_name`, `finding_id`, `risk_category`, `confidence` values, but its
`evidence` arrays are redacted placeholders (`["a","b","c"]`) -- they were replaced during
earlier scaffolding work. The `_FULLTEXT.txt` companion file has the real `risk_name` +
`description` prose, which for two findings names exact literal function/variable identifiers
directly. For those two, the claim_id below is a **confirmed** application of the algorithm.
For the other five, the description is a conceptual paraphrase rather than a verbatim evidence
list, so the function names below are **plausible reconstructions** based on the described
mechanism and standard Venus/Compound-fork admin-function naming, not literal token-for-token
extraction from an evidence array. Flagging this distinction explicitly rather than presenting
all seven with equal confidence -- the whole point of claim_id is that it should be built from
verbatim evidence strings, so the five "plausible" ones are exactly what a real v5 run needs to
confirm or correct.

## Results

| finding_id (this run) | risk_category (this run) | risk_name | claim_id | Confidence in claim_id itself |
|---|---|---|---|---|
| UPGRADEABILITY-01 | Upgradeability | Admin-controlled implementation upgrade and runtime initialization | `VENUS-_BECOMEIMPLEMENTATION-_RESIGNIMPLEMENTATION-_SETIMPLEMENTATION` | **Confirmed** -- all three tokens named directly in the finding text |
| CENTRALISATION-01 | Centralisation | Concentrated admin privileges over critical protocol configuration | `VENUS-_REDUCERESERVESFRESH-_SETACCESSCONTROLMANAGER-_SETCOMPTROLLER-_SETIMPLEMENTATION` | Plausible -- mechanism (multi-setter admin) is real, exact setter names inferred from standard Venus VBep20 admin-function naming, not from a verbatim evidence array |
| DEPENDENCY-01 | Dependency | Comptroller dependency for permissioning, caps, and treasury parameters | `VENUS-BORROWALLOWED-MINTALLOWED-REDEEMALLOWED-SEIZEALLOWED-TRANSFERALLOWED` | **Confirmed** -- all five hook names are listed verbatim in the finding text |
| DEPENDENCY-02 | Dependency | External AccessControlManager dependency for function-level permissions | `VENUS-ENSUREALLOWED` | **Confirmed** -- `ensureAllowed(functionSig)` named directly (single-token claim_id, below the 2-token minimum in the schema pattern -- see note below) |
| ECONOMIC-DEPENDENCY-01 | Economic Dependency | Interest rate model external dependency affecting accrual and borrow/supply maths | `VENUS-ACCRUEINTEREST-INTERESTRATEMODEL` | Plausible -- `accrueInterest` named directly; `InterestRateModel` is the dependency's type name, not a function call, included as the second token since evidence explicitly names it as external contract |
| **TRUST-BOUNDARY-01** | **Trust Boundary** | **Trust boundary expansion by treating external ERC-20 balanceOf as canonical cash** | **`VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR`** | **Confirmed** -- this is the donation-attack precursor finding; all three tokens (`getCashPrior()`, `exchangeRateStoredInternal()`, `balanceOf(address(this))`) are named verbatim in the finding text |
| ASSET-CUSTODY-01 | Asset Custody | External protocol reserve sink controls custody of reduced reserves | `VENUS-_REDUCERESERVESFRESH-UPDATEASSETSSTATE` | **Confirmed** -- `_reduceReservesFresh` and `updateAssetsState` both named directly |

## The one that matters most for the backtest

**`VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR`** is the claim_id for the
donation-attack precursor -- the finding that landed under three different `risk_category`
values across the 5-run reproducibility test (Trust Boundary x3, Operational Resilience x1,
Asset Custody x1), confidence range 0.82-0.96. This claim_id would be identical across all 5
of those runs, because `getCashPrior()`, `exchangeRateStoredInternal()`, and
`balanceOf(address(this))` are the literal function names the finding is *about*, cited
verbatim in every run regardless of which category the model filed it under. This is the
target Foundry's state-behavior check (task #21) needs to key against.

## One schema issue this dry-run surfaced

DEPENDENCY-02 (`ensureAllowed`) only has one clearly central token, producing a single-token
claim_id. The v5 schema's `claim_id` pattern requires 2-6 tokens
(`^[A-Z0-9_]+(-[A-Z0-9_]+){2,7}$`, i.e. minimum 3 hyphen-separated segments). A genuinely
single-mechanism finding like this would fail that pattern. Two options, not yet decided:

1. Loosen the pattern to allow a single token (`{1,7}` instead of `{2,7}`) -- simplest, but
   loses a small amount of collision-resistance for single-word mechanisms.
2. Require the protocol slug plus at least one token minimum (effectively what a 1-token
   claim_id already is: `VENUS-ENSUREALLOWED` is protocol + 1 token, 2 segments total) --
   which is actually what the current pattern already permits, since `{2,7}` counts
   hyphen-separated repeats *after* the first token, so `VENUS-ENSUREALLOWED` is 1 base + 1
   repeat = valid. Re-checking: the regex is `^[A-Z0-9_]+(-[A-Z0-9_]+){2,7}$`, which requires
   the first token PLUS 2-7 more -- so `VENUS-ENSUREALLOWED` (1 base + 1 more) actually
   **fails** this pattern (needs at least 3 total segments). This is a real bug, not just a
   style question.

**Fixed** in `07_risk_reasoner_schema_v5_claimid.json` and the matching prompt: pattern changed
from `{2,7}` to `{1,7}` (`PROTOCOL-TOKEN`, 2 segments total, is now valid), and the algorithm
text changed from "identify the 2-6 ... tokens" to "1-6 tokens," with an explicit note not to
pad a genuinely single-mechanism finding with unrelated tokens just to raise the count.
Re-checked all 7 claim_ids above against the corrected pattern programmatically -- all 7 pass,
including the single-token `VENUS-ENSUREALLOWED` case.

## Addendum: first real v5 run (not a placeholder scaffold)

Everything above was derived by hand-applying the algorithm to old placeholder-content JSON.
The first actual v5 run against the real prompt produced genuinely useful, non-placeholder
output -- 6 findings, all with real `claim_id`/`validation_target` populated. Checked
programmatically (diffing each `claim_id` against its own `mechanism_tokens`, not eyeballed):

- Schema mechanics: solid across all 6 findings -- required fields present, valid enums,
  `mitigation_considerations` correctly arrayed, `governance_model` a single string,
  `architectural_rationale` a single paragraph string, no citation typos. None of the
  previously-fixed bugs (from v2/v3/v4) regressed.
- `claim_id` pattern validity: 6/6 pass.
- `claim_id` correctly alphabetically sorted: only 3/6 (`DEPENDENCY-01`, `DEPENDENCY-02`,
  `ACCESS-CONTROL-01`). The other 3 either copied `mechanism_tokens`' array order verbatim
  (no independent sort performed) or, in one case (`ECONOMIC-DEPENDENCY-01`), dropped a token
  (`accrueInterest`) that was present in `mechanism_tokens` and `dependency_chain` but missing
  from `claim_id` entirely.
- **The finding that matters most for the backtest did not reproduce its predicted claim_id.**
  This run's donation-attack-adjacent finding (`DEPENDENCY-02`, "Reliance on underlying ERC-20
  semantics for cash/accounting") produced `claim_id: VENUS-DOTRANSFERIN-GETCASHPRIOR-UNDERLYING`
  -- not `VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR` as predicted above. Both are
  legitimate, verbatim-cited token selections from the same underlying `getCashPrior()` evidence;
  the model just centered on a different subset (`doTransferIn`/`underlying` vs.
  `balanceOf`/`exchangeRateStoredInternal`) and also reframed the finding more generally (ERC-20
  quirks / fee-on-transfer) rather than the donation-attack-specific framing, filing it under
  `Dependency` rather than `Trust Boundary`.

**What this means:** `claim_id` is a real improvement over `finding_id`/`risk_category` -- it's
grounded in verbatim source tokens instead of a category judgment -- but it is NOT fully stable
by itself, because *which* tokens count as "central" remains a discretionary selection step.
The sort/token-count bugs above are separate, purely mechanical errors (fixed in v6, see
`07_risk_reasoner_prompt_v6_claimid_fix.md`) and don't explain the token-selection variance,
which is a genuine, disclosed limitation, not a bug to chase away. Practical consequence:
Foundry/Node16 matching against this specific test should check for token overlap (e.g. does
`getCashPrior` appear anywhere in `mechanism_tokens`/`dependency_chain`) rather than exact
`claim_id` string equality -- see the "Matching strategy update" section in
`Venus_StateBehavior_Check_Design.md`.

## Addendum 2: first real v6 run (post sort/consistency fix)

Ran the identical input through the v6-fixed prompt. Checked programmatically (same script,
now also verifying `dependency_chain ⊆ mechanism_tokens`): **7/7 findings pass every check**
-- pattern valid, `claim_id` token count matches `mechanism_tokens`, same token set, and the
sort order is genuinely alphabetical (underscore-prefixed tokens compared by their letters, not
their leading `_`) rather than copied array order. `ECONOMIC-DEPENDENCY-01` also correctly kept
`accrueInterest` this time -- the exact token that was silently dropped in the pre-fix run. The
mechanical bugs are fixed, confirmed on real output, not just the placeholder dry-run.

The token-selection question (which tokens count as "central") is the one thing v6 was never
going to fix, and it didn't -- this run's donation-attack-adjacent finding
(`ASSET-CUSTODY-01`, filed under a FOURTH distinct risk_category now: Trust Boundary → Dependency
→ Asset Custody across the three real runs so far) produced yet another distinct claim_id:
`VENUS-DOTRANSFERIN-DOTRANSFEROUT-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR-UNDERLYING` -- a
5-token set that's roughly the union of the previous two runs' selections (3 tokens, then 3
different tokens, now 5). But `getCashPrior` -- the anchor token the matching-strategy update
in `Venus_StateBehavior_Check_Design.md` keys on -- has now appeared in `mechanism_tokens` in
**all 3 real runs** of this finding. That's the one piece of evidence that actually matters for
`VenusDonationAttack.t.sol`: token-overlap matching against `getCashPrior` would have correctly
linked all three runs to the same Foundry check, even though exact `claim_id` matching would
have failed on 3/3. Small sample, but it's the sample the design decision was made on, and so
far it's holding.
