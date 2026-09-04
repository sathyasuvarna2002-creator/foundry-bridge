# Venus State-Behavior Check — Design Note (task #21)

Covers the "heavier piece" flagged when this Foundry-validation work started: the resolver
checks added to `server.js` (task #20) can only confirm what a contract currently *is* --
addresses, listings, existence. They cannot test what happens when you *do* something to it.
The donation-attack claim (`claim_id: VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR`)
is specifically a claim about behavior under a state change -- "an ungated ERC-20 transfer
moves the exchange rate" -- so it needs a different check type entirely.

## Why this doesn't fit the existing pattern

`IPoolValidator.validate(address) external view returns (ValidationResult memory)` is `view` --
it can only read. `VenusValidator.sol` and `ValidateProtocol.s.sol` are built around that
constraint deliberately (per `ValidationResult.sol`'s own design principle: "unsupported values
MUST return false/0/address(0) and MUST NEVER revert" -- a read-only, always-safe contract).
A donation-attack test needs to actually *transfer tokens* and then *observe a change* --
`vm.prank` + a real call + before/after comparison. That's a `forge test`, not a `forge script`
view call, and it can't return a `ValidationResult` struct because its output isn't "here's what
this contract reports," it's "here's what happened when I did X."

So `VenusDonationAttack.t.sol` is a separate file, run separately (`forge test --match-contract
VenusDonationAttackTest --fork-url $BSC_RPC_URL -vv`), not wired into the `/validate` endpoint's
existing forge-script dispatch.

## What it actually tests

Two tests, one file:

- `test_DonationMovesExchangeRateWithoutMint` -- the core claim. Forks BSC at a pre-patch block,
  impersonates a THE holder, transfers THE directly to vTHE (not through `mint()`), and asserts
  `exchangeRateStored()` increased while `vToken.totalSupply()` stayed flat -- i.e. cash moved
  without going through the Comptroller's `mintAllowed()`/`supplyCaps` gate at all.
- `test_Control_MintAlsoMovesCash` -- a control, not the claim itself. Confirms the *normal*
  gated path (approve + `mint()`) also moves cash/rate at the same block. This exists so a
  failure in the core test can be read correctly (see below) instead of assumed to mean the
  claim is false.

## Reading the results: SUPPORTED / CONTRADICTED / UNRESOLVED

This is the one part of the pipeline that already uses three-valued (K3) logic rather than
binary pass/fail (per the Aave report's Section 7 framing). Applied here:

| Core test | Control test | Verdict for `VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR` |
|---|---|---|
| PASS | PASS | **SUPPORTED** -- donation moved the rate, and instrumentation is confirmed sound (mint also works) |
| FAIL | PASS | **CONTRADICTED** -- instrumentation is sound (mint works), but the ungated donation did NOT move the rate at this block. Two sub-cases worth distinguishing in the report text, not collapsing into one line: (a) a mitigation is already active at `PRE_PATCH_BLOCK` -- wrong block chosen, re-run earlier; (b) `getCashPrior()` genuinely isn't wired to raw `balanceOf()` the way Node06's architecture model claimed -- a real Node06 error worth feeding back |
| FAIL | FAIL | **UNRESOLVED** -- something is wrong with the fork itself (RPC issue, stale/wrong block, wrong addresses, THE has an active blacklist at that block). This is an execution failure, not evidence about the architecture, and must not be reported as CONTRADICTED |
| PASS | FAIL | **UNRESOLVED**, flag for manual review -- unusual combination (donation worked, gated mint didn't) worth a human look rather than auto-classifying |

This mapping is what should feed Node 16/17 as the deterministic-validation input for this
specific `claim_id`, the same way `resolver_execution_results` currently feeds fusion for the
Aave resolver checks.

## What's still a placeholder, deliberately not guessed

`VTHE`, `THE_TOKEN`, `THE_WHALE`, `PRE_PATCH_BLOCK` are all `address(0)`/`0` in the file, with
`require()` guards that stop the test from silently running against the zero address. Consistent
with how the earlier Comptroller-source work handled dating ("current file, not a March-2026
snapshot"), I'm not fabricating specific BSC addresses or a block number from memory for
something this load-bearing -- these need to come from BscScan directly:

- `VTHE` / `THE_TOKEN`: pull from Venus's own market list / the on-chain Comptroller's
  `getAllMarkets()` + that market's `underlying()` -- both already readable via the existing
  `IVToken`/`IComptroller` interfaces if you point `cast call` at a live Comptroller.
- `THE_WHALE`: BscScan's THE token "Holders" tab, cross-referenced for balance *at* the chosen
  block, not current balance (a large holder today may not have been one pre-patch, and vice
  versa).
- `PRE_PATCH_BLOCK`: needs the actual patch transaction hash for the March 15 2026 fix, then
  pick a block comfortably before it. Estimating from the date alone risks landing on a block
  that already includes the patch, which would flip a SUPPORTED result into a false
  CONTRADICTED (see table above).

## Matching strategy update (post real-run test)

The first real v5 run (not a placeholder scaffold) showed that exact `claim_id` string
matching is too brittle even after the sort/consistency bugs are fixed (see task #23 / v6
prompt fix): the same underlying `getCashPrior()` architectural fact produced
`VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR` in one run and
`VENUS-DOTRANSFERIN-GETCASHPRIOR-UNDERLYING` in another -- both are legitimate, verbatim-cited
token selections from the same evidence, just different subsets. `getCashPrior` is the one
token common to both.

**Matching rule for this test going forward:** whatever wires Node 07 output to
`VenusDonationAttack.t.sol` (Node 16, or a pre-fusion matcher) should check for the presence of
an anchor token -- `getCashPrior` -- anywhere in a finding's `validation_target.mechanism_tokens`
OR `validation_target.dependency_chain`, not exact equality against a fixed claim_id string.
Anchor set for this specific test: `{getCashPrior, exchangeRateStoredInternal, balanceOf,
doTransferIn, getCashPrior}` (i.e. any token that's part of the cash/exchange-rate computation
chain) -- a finding matches if its mechanism_tokens/dependency_chain intersects this set at all,
regardless of which subset it happened to select or which risk_category it landed under.

## Open dependency on task #20's control test

`test_Control_MintAlsoMovesCash` calls a `mint()` function that `IVToken.sol` doesn't currently
expose (it's a read-only validation interface by design). Left as an explicit `// FILL IN` gap
in the file with a comment rather than guessing Venus's exact `mint()` signature/return
convention (some Compound forks return an error-code `uint256` instead of reverting on failure)
-- needs either a small `IVTokenMintable` interface added, or reusing whatever mint signature is
already confirmed elsewhere in the Venus source bundle already pulled into this project.
