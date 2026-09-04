# Venus Node 06 — Comptroller Integration & Citation Fix

Documentation of the process that closed the last gap in the Venus donation-attack
backtest: getting the Comptroller side of the causal chain into Node 06's
architecture recon, and fixing a citation-integrity bug discovered along the way.
Written up for reuse in later project writing (methodology sections, Jerry-style
progress updates, etc.).

## Background

The framework's Venus backtest reconstructs the March 15, 2026 Venus THE
(Thena) donation-attack exploit. The VToken side of the causal chain (the
vulnerable `getCashPrior()` reading raw ERC-20 `balanceOf`) was reconstructed
earlier from GitHub PR #664. The missing piece was the Comptroller side —
specifically, does the Comptroller's `mintAllowed()` / `supplyCaps` policy
check trust the VToken's self-reported exchange rate, or does it independently
verify it? Without that file, Node 06 couldn't establish whether the
Comptroller's trust in VToken-reported state is itself part of the
architectural risk.

## Step 1 — Locating the Comptroller source

Direct GitHub path guesses (raw.githubusercontent.com, api.github.com) mostly
returned empty. What worked was targeted WebSearch queries against the
VenusProtocol/venus-protocol repo, which surfaced:

- The repo's own README confirms Core Pool's Comptroller **is** a Diamond
  proxy with facets (MarketFacet, PolicyFacet, RewardFacet, SetterFacet) —
  correcting an earlier assumption in this project that Core Pool used a
  flat, non-Diamond Comptroller.
- `contracts/Comptroller/Diamond/facets/PolicyFacet.sol` on the `develop`
  branch contains the real `mintAllowed()` implementation, which enforces
  `supplyCaps[vToken]` against a value computed from
  `VToken(vToken).exchangeRateStored()` and `VToken(vToken).totalSupply()`.

**Caveat carried forward into every downstream artifact:** this is the
*current* `develop`-branch file, not a pinned March-2026 snapshot. It
contains features (Prime scoring, `deviationBoundedOracle`) that look newer
than the exploit date and may include post-incident hardening. It's the best
available reference for the *architecture* of `mintAllowed()`/`supplyCaps`,
not verified exploit-era bytecode.

Saved as `Venus_Comptroller_PolicyFacet_current.sol`.

## Step 2 — Getting the source into Node 06

The existing Code node ("Source Code Normaliser") pulls the primary,
Etherscan-verified contract automatically but had no path for supplementary
architectural evidence. Filled in a `supportingVenusSource` template literal
block appending four files after the primary source: the pre-patch VBep20
excerpt, the PolicyFacet file (with its dating caveat inline), the legacy
`ComptrollerStorage.sol`/`UnitrollerAdminStorage`, and
`ComptrollerInterface.sol`. Saved as `Venus_Source_Normalizer_filled.js`.

## Step 3 — First real run: a new bug class

Ran Node 06 on the full bundle. Result was schema-valid and substantively
strong (the `getCashPrior`/`exchangeRate` mutation-path chain was correctly
identified), but a grep of all evidence-string file-path citations found:

```
Vokens typo count: 12 / 65 VToken-related path citations
(contracts/Tokens/VTokens/... appearing as contracts/Tokens/Vokens/...)
```

This wasn't a one-off typo — the same dropped letter, in the same position,
recurring across 12 separate citations. Diagnosis: the model was retyping
long file paths from memory late in a long context window rather than
copying them, and drifting. This is a distinct failure mode from the earlier
`$ref`/schema-type bugs — it corrupts evidence traceability rather than
structure, which matters more for a framework whose core claim is
"evidence-grounded, not guessed."

**Fix:** added a new, narrowly-scoped section to Node 06's prompt —
`06_architecture_recon_prompt_v4_citation_fix.md` — instructing the model to
copy file paths character-for-character from the nearest `FILE:` marker
rather than reconstruct them from recall. Diffed against the prior prompt
version to confirm this was the *only* change (no other rule content
touched).

**Re-run result:** 0/65 typo count. Fix held on the very next run.

## Step 4 — Closing the Comptroller connection explicitly

Getting the PolicyFacet source into the input was necessary but not
sufficient — Node 06's first two runs mentioned the Comptroller only at the
level of "calls comptroller.mintAllowed()," without tracing what that
function actually checks. The user added a new instruction block to the
input message:

```
CROSS-CONTRACT ARCHITECTURE REQUIREMENT
When supporting contract source is provided, do not limit the reconstruction
to the primary contract's direct function calls. Inspect the supporting
contracts for architectural state and policy mechanisms that are directly
connected to the primary contract. Where the primary contract calls an
external policy function, trace that function into the supplied supporting
source and record the observable architecture of that policy mechanism,
including: the policy function; state variables it reads; calculations it
performs; configuration/state that controls the policy; the contract or
storage layer where that state is defined; the relationship between the
primary contract and that policy. Only report relationships that are
directly supported by the supplied source. Do not infer missing
implementation details or historical behaviour.
```

**Result:** confirmed via grep, the re-run explicitly connects
`PolicyFacet.mintAllowed()` → `VToken.exchangeRateStored()` /
`VToken.totalSupply()` → `supplyCaps[vToken]` in four separate places in the
output (architectural_patterns, downstream_dependencies, critical_assets
mutation paths, and a dedicated trust_assumption: "Comptroller policy
trust" — stating that Comptroller-level enforcement depends on
VToken-reported accounting it does not independently verify).

## The completed causal chain

Node 06's output, taken as a whole, now documents the full architectural
chain behind the donation attack without asserting a vulnerability (that's
Node 07's job):

1. `PolicyFacet.mintAllowed()` enforces `supplyCaps[vToken]` by computing
   `nextTotalSupply` from `VToken(vToken).exchangeRateStored()` and
   `VToken(vToken).totalSupply()`.
2. `exchangeRateStoredInternal()` computes that exchange rate from
   `getCashPrior() + totalBorrows - totalReserves`, divided by `totalSupply`.
3. `getCashPrior()` (pre-patch) returns `IERC20(underlying).balanceOf(address(this))`
   — a raw balance read.
4. That balance can be inflated by any direct ERC-20 transfer to the
   contract; `doTransferIn`/`doTransferOut` maintain no internal ledger to
   catch the discrepancy pre-patch.
5. Therefore the Comptroller's policy layer (supply cap enforcement)
   inherits whatever exchange rate the VToken reports, including one
   corrupted by an unguarded external transfer, with no independent check.

## Verification methodology used throughout

Every claim in this document was checked programmatically, not eyeballed:
- Evidence-citation grep counts (`Vokens` vs `VTokens`) run against the raw
  pasted text before and after each prompt change.
- Schema-structural validation (`node -e` scripts) against
  `06_architecture_recon_schema_v2_dereferenced.json` for required keys,
  types, and per-item shape on every run.
- Direct diff (`diff` command) between prompt versions to confirm each fix
  was the only change made, isolating cause from effect.

## Files produced this thread (all saved to the project folder)

- `Venus_Comptroller_PolicyFacet_current.sol` — the located Comptroller logic, with dating caveat
- `Venus_Node06_Source_Bundle.sol` — merged four-file paste-ready source bundle
- `Venus_Source_Normalizer_filled.js` — the filled-in n8n Code node
- `06_architecture_recon_prompt_v4_citation_fix.md` — the citation-integrity fix
- This document

## Open item carried forward

`downstream_dependencies` and `critical_assets` granularity varied between
runs on materially similar input (2 vs 0 entries; 1 bundled item vs 4-5
separate items). Not treated as a bug — flagged as a concrete question for
the pending reproducibility test (task #6, N≥5 runs) rather than chased
individually.
