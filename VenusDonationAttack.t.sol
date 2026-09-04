// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/interfaces/IVToken.sol";

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @dev Standard Compound-fork mint signature (VBep20/CToken convention:
/// returns a uint256 error code rather than reverting on failure). Not
/// independently re-confirmed against Venus's exact VBep20.sol source in
/// this pass -- the getCashPrior()/exchangeRateStoredInternal() excerpts
/// in the Venus post-mortem confirm the surrounding contract, but not
/// this specific external mint() line. High confidence given how
/// standardized this signature is across the Compound-fork ecosystem
/// (matches the mintAllowed(address,address,uint256) signature already
/// confirmed in PolicyFacet.sol), but flagging the gap rather than
/// silently presenting it as verified.
interface IVTokenMintable {
    function mint(uint256 mintAmount) external returns (uint256);
}

/**
 * @title VenusDonationAttackTest
 * @notice State-behavior Foundry test validating the claim behind
 *         claim_id VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR:
 *         that vTHE's exchangeRateStored() is directly movable by an
 *         ungated, non-mint ERC-20 transfer of the underlying THE
 *         token into the vToken contract -- the architectural
 *         precursor to the March 15 2026 donation-attack incident.
 *
 * @dev This is a STATEFUL fork test (impersonation + a real transfer
 *      against forked chain state), not a read-only resolver check.
 *      It does not fit IPoolValidator's `validate() view returns
 *      (ValidationResult memory)` pattern -- that interface can only
 *      report what a contract currently IS, not what happens when you
 *      DO something to it. Kept as a separate forge test file, run
 *      via `forge test`, not folded into ValidateProtocol.s.sol or
 *      VenusValidator.sol. See Venus_StateBehavior_Check_Design.md
 *      for the full reasoning and how results feed back into the
 *      pipeline's SUPPORTED / CONTRADICTED / UNRESOLVED framing.
 *
 * VERIFIED against the actual Venus post-mortem
 * (https://community.venus.io/t/the-market-incident-post-mortem/5712)
 * and BlockSec's independent writeup
 * (https://blocksec.com/blog/venus-thena-donation-attack):
 *   - getCashPrior()/exchangeRateStoredInternal() code excerpted in
 *     the post-mortem matches this test's assumptions exactly --
 *     getCashPrior() returns IERC20(underlying).balanceOf(address(this)),
 *     confirming this is the real mechanism, not a hypothetical.
 *   - Attack tx: 0x4f477e941c12bbf32a58dc12db7bb0cb4d31d41ff25b2457e6af3c15d7f5663f
 *     (~11:55 UTC, March 15 2026). Any BSC block strictly before this
 *     tx is a valid PRE_PATCH_BLOCK candidate.
 *   - Real exchange-rate delta observed on-chain: 10,086,934,836 ->
 *     38,420,106,438 (3.81x) after ~36M THE was donated across 6
 *     wallets -- useful as a sanity-check magnitude if this test's
 *     result looks implausible.
 *   - THE_WHALE below (0x1a35...) is the post-mortem's own "original
 *     supplier" address, one of the six wallets that donated THE
 *     directly to vTHE in the real attack -- a real, on-chain-confirmed
 *     THE holder, not an arbitrary guess. Its LIQUID (non-deposited)
 *     THE balance at whatever PRE_PATCH_BLOCK you choose still needs
 *     checking -- the require() below will simply revert cleanly if
 *     it's too low at that specific block, so this is self-correcting,
 *     not silently wrong.
 *
 * NOW VERIFIED (previous pass could not confirm these -- BscScan is
 * JS-rendered and Chrome wasn't connected yet; both resolved once
 * Chrome was connected):
 *
 *   VTHE = 0x86e06EAfa6A1eA631Eab51DE500E3D474933739f -- confirmed
 *          directly from Venus's own official docs, BNB Chain
 *          Mainnet > Core Pool market list:
 *          https://docs-v4.venus.io/deployed-contracts/markets.md
 *          (same section also gives the Core Pool Comptroller:
 *          0xfD36E2c2a6789Db23113685031d7F16329158384 -- not used by
 *          this test directly, but useful as an independently-known
 *          reference value for the VENUS-P01-COMPTROLLER-LISTING
 *          resolver check in server_with_venus_checks.js).
 *   THE_TOKEN = 0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11 -- confirmed
 *          from the same Venus docs page, BNB Chain Mainnet > Core
 *          Pool > Underlying tokens.
 *   PRE_PATCH_BLOCK = 86688236 -- derived from a REAL sourced anchor,
 *          not estimated from a date/block-time calculation (BSC block
 *          time isn't assumed stable across a 5-month gap). The Venus
 *          post-mortem itself states the attack position peaked "At
 *          peak (block 86738236, 12:42 UTC)" on March 15 2026. This
 *          test's block is that real anchor minus a 50,000-block
 *          buffer (86738236 - 50000 = 86688236) -- comfortably before
 *          the attack's 11:55 UTC start (tx
 *          0x4f477e941c12bbf32a58dc12db7bb0cb4d31d41ff25b2457e6af3c15d7f5663f)
 *          under any reasonable BSC block-time assumption, without
 *          having to trust a specific seconds-per-block figure.
 *
 * Running at the wrong block silently changes what a result means:
 * running this at or after the patch block will make the core test
 * fail for a DIFFERENT reason than "the claim was wrong" -- it would
 * mean "the claim was right but has since been fixed." The design doc
 * covers how to tell these two failure modes apart before reporting
 * CONTRADICTED.
 */
contract VenusDonationAttackTest is Test {

    address constant VTHE = 0x86e06EAfa6A1eA631Eab51DE500E3D474933739f; // Venus official docs, BNB Chain Mainnet > Core Pool
    address constant THE_TOKEN = 0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11; // Venus official docs, BNB Chain Mainnet > Core Pool > Underlying tokens
    address constant THE_WHALE = 0x1a35bD28efd46Cfc46c2136f878777D69AE16231; // Venus post-mortem's "original supplier" -- real, on-chain-confirmed THE donor in the actual attack
    uint256 constant PRE_PATCH_BLOCK = 86688236; // real anchor block 86738236 (post-mortem, 12:42 UTC Mar 15 2026) minus a 50,000-block safety buffer -- see note above

    // Donation size is deliberately a round, moderate figure -- large
    // enough to move exchangeRateStored() measurably against a real
    // market's cash size, small enough to be plausible for a single
    // whale-sized transfer. Re-tune once real THE decimals and vTHE's
    // actual pre-patch cash size are known (log cashBefore first and
    // adjust if the delta below is negligible).
    uint256 constant DONATION_AMOUNT = 1_000_000 * 1e18;

    function setUp() public {

        require(VTHE != address(0), "VTHE not set -- fill in before running");
        require(THE_TOKEN != address(0), "THE_TOKEN not set -- fill in before running");
        require(THE_WHALE != address(0), "THE_WHALE not set -- fill in before running");
        require(PRE_PATCH_BLOCK != 0, "PRE_PATCH_BLOCK not set -- fill in before running");

        vm.createSelectFork(vm.envString("BSC_RPC_URL"), PRE_PATCH_BLOCK);
    }

    /// @notice CORE CLAIM TEST -- maps to claim_id
    ///         VENUS-BALANCEOF-EXCHANGERATESTOREDINTERNAL-GETCASHPRIOR
    ///
    /// PASS  -> claim SUPPORTED at PRE_PATCH_BLOCK (subject to the
    ///          control test in this same file also passing --
    ///          see design doc, "reading results" section).
    /// FAIL  -> claim CONTRADICTED at PRE_PATCH_BLOCK, IF the control
    ///          test passed (instrumentation is sound, so the
    ///          mechanism genuinely doesn't behave as described).
    ///          If the control test ALSO failed, this is UNRESOLVED,
    ///          not CONTRADICTED -- see design doc.
    function test_DonationMovesExchangeRateWithoutMint() public {

        IVToken vToken = IVToken(VTHE);
        IERC20Like theToken = IERC20Like(THE_TOKEN);

        uint256 rateBefore = vToken.exchangeRateStored();
        uint256 cashBefore = vToken.getCash();
        uint256 vTokenSupplyBefore = vToken.totalSupply();

        uint256 whaleBalance = theToken.balanceOf(THE_WHALE);
        require(whaleBalance >= DONATION_AMOUNT, "THE_WHALE balance too low at this block -- pick a different whale or block");

        // Donate: direct ERC-20 transfer, NOT vToken.mint(). This is
        // the exact mechanism the finding describes -- bypassing the
        // Comptroller's mintAllowed()/supplyCaps policy entirely,
        // since no mint() call is made at all.
        vm.prank(THE_WHALE);
        bool ok = theToken.transfer(VTHE, DONATION_AMOUNT);
        require(ok, "donation transfer failed -- check THE token doesn't have transfer restrictions/blacklists active at this block");

        uint256 rateAfter = vToken.exchangeRateStored();
        uint256 cashAfter = vToken.getCash();
        uint256 vTokenSupplyAfter = vToken.totalSupply();

        // ---- 1. Confirm this was a pure donation, not a disguised mint ----
        assertEq(
            vTokenSupplyAfter,
            vTokenSupplyBefore,
            "vToken supply changed after a plain transfer -- test setup is wrong, this should be impossible without calling mint()"
        );

        assertGt(
            cashAfter,
            cashBefore,
            "cash did not increase after the donation -- transfer may have silently no-opped, or getCash() is not reading the token balance the way assumed"
        );

        // ---- 2. THE CORE CLAIM ----
        assertGt(
            rateAfter,
            rateBefore,
            "exchangeRateStored did not move despite cash increasing -- claim NOT supported at this block; either getCashPrior() is not wired to balanceOf() the way Node06 described, or a mitigation is already active at PRE_PATCH_BLOCK"
        );

        console2.log("rateBefore", rateBefore);
        console2.log("rateAfter", rateAfter);
        console2.log("rateDelta", rateAfter - rateBefore);
        console2.log("cashBefore", cashBefore);
        console2.log("cashAfter", cashAfter);
    }

    /// @notice CONTROL TEST -- confirms the GATED path (mint) also
    ///         moves cash/rate as expected at this same block. Exists
    ///         so a failure in the core test above can be read
    ///         correctly: if mint() ALSO fails to move cash/rate,
    ///         something is wrong with the fork/instrumentation
    ///         itself (RPC issue, wrong block, wrong addresses), not
    ///         with the architectural claim -- that failure mode is
    ///         UNRESOLVED, not CONTRADICTED. Only trust a core-test
    ///         failure as CONTRADICTED if this control test passes.
    function test_Control_MintAlsoMovesCash() public {

        IVToken vToken = IVToken(VTHE);
        IERC20Like theToken = IERC20Like(THE_TOKEN);

        uint256 cashBefore = vToken.getCash();

        uint256 whaleBalance = theToken.balanceOf(THE_WHALE);
        require(whaleBalance >= DONATION_AMOUNT, "THE_WHALE balance too low at this block");

        vm.startPrank(THE_WHALE);
        theToken.approve(VTHE, DONATION_AMOUNT);

        uint256 mintError = IVTokenMintable(VTHE).mint(DONATION_AMOUNT);
        require(mintError == 0, "mint() returned a non-zero Compound-style error code -- check THE_WHALE has enough liquid THE and no supply cap/pause is active at this block");

        vm.stopPrank();

        uint256 cashAfter = vToken.getCash();

        assertGt(
            cashAfter,
            cashBefore,
            "control failed: even the normal gated mint() path did not move cash -- fork/instrumentation problem, not an architectural finding. Do not report the core test's result as CONTRADICTED if this control also fails."
        );
    }
}
