// ============================================================================
// VENUS SOURCE BUNDLE FOR NODE 06 (ARCHITECTURE RECON) -- Comptroller/VToken
// side of the March 15 2026 donation-attack backtest.
// Paste this whole file (or the relevant sections) into whatever input field
// Node 06's prompt reads source code from.
// ============================================================================


// ============================================================================
// FILE 1 of 4: contracts/Tokens/VTokens/VBep20.sol (PRE-PATCH, VULNERABLE)
// Reconstructed by reverse-applying VenusProtocol/venus-protocol PR #664.
// This is the file that was live through March 15 2026 -- getCashPrior()
// reads raw ERC-20 balanceOf with no internal ledger to cross-check it.
// ============================================================================

contract VBep20 is VToken, VBep20Interface {

    function doTransferIn(address from, uint256 amount) internal virtual override returns (uint256) {
        IERC20 token = IERC20(underlying);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

    function doTransferOut(address payable to, uint256 amount) internal virtual override {
        IERC20 token = IERC20(underlying);
        token.safeTransfer(to, amount);
    }

    function getCashPrior() internal view override returns (uint) {
        return IERC20(underlying).balanceOf(address(this));
    }
}

// Note: pre-patch, there is no internalCash storage variable, no
// sweepTokenAndSync() function, no CashSynced/TokenSwept events -- all of
// those were added BY the March-2026 patch (PR #664). getCashPrior() reads
// the contract's raw token balance directly, and neither doTransferIn nor
// doTransferOut maintain any separate internal ledger to compare it against,
// so a plain ERC-20 transfer to the contract inflates the balance
// getCashPrior() reports with nothing to catch it.


// ============================================================================
// FILE 2 of 4: contracts/Comptroller/Diamond/facets/PolicyFacet.sol
// SOURCE-DATING CAVEAT: this is the CURRENT develop-branch file (fetched
// 2026-08-10), not a pinned March-2026 snapshot. It contains features (Prime
// scoring, deviationBoundedOracle) that look newer than the exploit date and
// may include post-incident hardening. Treat this as the best available
// reference for CURRENT mintAllowed()/supplyCaps architecture, not as
// verified exploit-era bytecode. Flag this dating uncertainty in any finding
// that leans on this file.
// ============================================================================

pragma solidity 0.8.25;

import { VToken } from "../../../Tokens/VTokens/VToken.sol";
import { Action } from "../../ComptrollerInterface.sol";
import { IPolicyFacet } from "../interfaces/IPolicyFacet.sol";
import { XVSRewardsHelper } from "./XVSRewardsHelper.sol";
import { PoolMarketId } from "../../../Comptroller/Types/PoolMarketId.sol";
import { WeightFunction } from "../interfaces/IFacetBase.sol";

contract PolicyFacet is IPolicyFacet, XVSRewardsHelper {
    event VenusBorrowSpeedUpdated(VToken indexed vToken, uint256 newSpeed);
    event VenusSupplySpeedUpdated(VToken indexed vToken, uint256 newSpeed);

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     */
    function mintAllowed(address vToken, address minter, uint256 mintAmount) external returns (uint256) {
        checkProtocolPauseState();
        checkActionPauseState(vToken, Action.MINT);
        ensureListed(getCorePoolMarket(vToken));

        uint256 supplyCap = supplyCaps[vToken];
        require(supplyCap != 0, "market supply cap is 0");

        uint256 vTokenSupply = VToken(vToken).totalSupply();
        Exp memory exchangeRate = Exp({ mantissa: VToken(vToken).exchangeRateStored() });
        uint256 nextTotalSupply = mul_ScalarTruncateAddUInt(exchangeRate, vTokenSupply, mintAmount);
        require(nextTotalSupply <= supplyCap, "market supply cap reached");

        updateVenusSupplyIndex(vToken);
        distributeSupplierVenus(vToken, minter);

        return uint256(Error.NO_ERROR);
    }

    // redeemAllowed / borrowAllowed / repayBorrowAllowed / liquidateBorrowAllowed /
    // seizeAllowed / transferAllowed and their *Verify counterparts follow the
    // same pattern: pause checks, ensureListed, cap checks, flywheel updates.
    // Full file available in Venus_Comptroller_PolicyFacet_current.sol if needed.
}

// Relevant to the donation-attack chain: mintAllowed() computes
// nextTotalSupply using VToken(vToken).exchangeRateStored() and compares it
// against supplyCaps[vToken]. It trusts the VToken's own exchange-rate
// calculation as ground truth with no independent cross-check -- so if
// getCashPrior() on the VToken side is manipulated (FILE 1 above), the
// Comptroller's supply-cap policy check inherits the corrupted value rather
// than catching it.


// ============================================================================
// FILE 3 of 4: contracts/ComptrollerStorage.sol (legacy storage layer,
// UnitrollerAdminStorage + ComptrollerStorage, underneath the Diamond)
// pragma 0.5.16-era snapshot as pasted by the user from their own source pull
// ============================================================================

pragma solidity ^0.5.16;

import "./VToken.sol";
import "./PriceOracle.sol";
import "./VAIControllerInterface.sol";

contract UnitrollerAdminStorage {
    address public admin;
    address public pendingAdmin;
    address public comptrollerImplementation;
    address public pendingComptrollerImplementation;
}

contract ComptrollerStorage is UnitrollerAdminStorage {
    PriceOracle public oracle;
    uint public closeFactorMantissa;
    uint public liquidationIncentiveMantissa;
    uint public maxAssets;
    mapping(address => VToken[]) public accountAssets;

    struct Market {
        bool isListed;
        uint collateralFactorMantissa;
        mapping(address => bool) accountMembership;
        bool isVenus;
    }

    mapping(address => Market) public markets;

    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;

    struct VenusMarketState {
        uint224 index;
        uint32 block;
    }

    VToken[] public allMarkets;
    uint public venusRate;
    mapping(address => uint) public venusSpeeds;
    mapping(address => VenusMarketState) public venusSupplyState;
    mapping(address => VenusMarketState) public venusBorrowState;
    mapping(address => mapping(address => uint)) public venusSupplierIndex;
    mapping(address => mapping(address => uint)) public venusBorrowerIndex;
    mapping(address => uint) public venusAccrued;
    VAIControllerInterface public vaiController;
    mapping(address => uint) public mintedVAIs;
    uint public vaiMintRate;
    bool public mintVAIGuardianPaused;
    bool public repayVAIGuardianPaused;
    bool public protocolPaused;
}


// ============================================================================
// FILE 4 of 4: contracts/Unitroller.sol + ComptrollerInterface.sol
// (delegatecall admin proxy + external policy-hook interface, as pasted)
// ============================================================================

pragma solidity ^0.5.16;

contract ComptrollerInterface {
    bool public constant isComptroller = true;

    function enterMarkets(address[] calldata vTokens) external returns (uint[] memory);
    function exitMarket(address vToken) external returns (uint);

    function mintAllowed(address vToken, address minter, uint mintAmount) external returns (uint);
    function mintVerify(address vToken, address minter, uint mintAmount, uint mintTokens) external;

    function redeemAllowed(address vToken, address redeemer, uint redeemTokens) external returns (uint);
    function redeemVerify(address vToken, address redeemer, uint redeemAmount, uint redeemTokens) external;

    function borrowAllowed(address vToken, address borrower, uint borrowAmount) external returns (uint);
    function borrowVerify(address vToken, address borrower, uint borrowAmount) external;

    function repayBorrowAllowed(
        address vToken, address payer, address borrower, uint repayAmount
    ) external returns (uint);
    function repayBorrowVerify(
        address vToken, address payer, address borrower, uint repayAmount, uint borrowerIndex
    ) external;

    function liquidateBorrowAllowed(
        address vTokenBorrowed, address vTokenCollateral, address liquidator, address borrower, uint repayAmount
    ) external returns (uint);
    function liquidateBorrowVerify(
        address vTokenBorrowed, address vTokenCollateral, address liquidator, address borrower,
        uint repayAmount, uint seizeTokens
    ) external;

    function seizeAllowed(
        address vTokenCollateral, address vTokenBorrowed, address liquidator, address borrower, uint seizeTokens
    ) external returns (uint);
    function seizeVerify(
        address vTokenCollateral, address vTokenBorrowed, address liquidator, address borrower, uint seizeTokens
    ) external;

    function transferAllowed(address vToken, address src, address dst, uint transferTokens) external returns (uint);
    function transferVerify(address vToken, address src, address dst, uint transferTokens) external;

    function liquidateCalculateSeizeTokens(
        address vTokenBorrowed, address vTokenCollateral, uint repayAmount
    ) external view returns (uint, uint);

    function mintedVAIOf(address owner) external view returns (uint);
    function setMintedVAIOf(address owner, uint amount) external returns (uint);
    function getVAIMintRate() external view returns (uint);
}

// Note: Unitroller.sol itself (the delegatecall admin proxy shell) was pasted
// by the user earlier in this project but its body wasn't included in this
// bundle -- it contains no logic relevant to the donation-attack chain
// (pure admin/upgrade plumbing: _setPendingImplementation, _acceptImplementation,
// fallback delegatecall). Include it in Node 06's input too if you want full
// upgradeability-pattern coverage in that section of the output.
