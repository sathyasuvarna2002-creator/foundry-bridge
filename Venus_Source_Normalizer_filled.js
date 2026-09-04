const result = $node["04_Get_Source_Code"].json.result[0];
let sourceCode = result.SourceCode;
let files = [];
// Etherscan wraps multi-file "Standard JSON Input" sources in double braces: {{ ... }}
if (sourceCode.startsWith("{{")) {
  const inner = sourceCode.slice(1, -1);
  const parsed = JSON.parse(inner);
  const sources = parsed.sources || {};
  for (const [path, content] of Object.entries(sources)) {
    files.push({
      path,
      content: content.content
    });
  }
}
// Some multi-file sources are a plain JSON object with a "sources" key
else if (sourceCode.trim().startsWith("{")) {
  try {
    const parsed = JSON.parse(sourceCode);
    if (parsed.sources) {
      for (const [path, content] of Object.entries(parsed.sources)) {
        files.push({
          path,
          content: content.content
        });
      }
    } else {
      files.push({
        path: result.ContractName + ".sol",
        content: sourceCode
      });
    }
  } catch (e) {
    files.push({
      path: result.ContractName + ".sol",
      content: sourceCode
    });
  }
}
// Plain single-file source
else {
  files.push({
    path: result.ContractName + ".sol",
    content: sourceCode
  });
}
let combined = files
  .map(f => `// ===== FILE: ${f.path} =====\n${f.content}`)
  .join("\n\n");

// ============================================================
// SUPPORTING VENUS ARCHITECTURAL SOURCE
// ============================================================
const supportingVenusSource = `
// ============================================================
// SUPPORTING VENUS SOURCE BUNDLE
// ============================================================
// IMPORTANT:
// The VToken source above is the PRIMARY CONTRACT.
// The following material is SUPPORTING ARCHITECTURAL EVIDENCE.

// ===== FILE: VBep20_prepatch_excerpt.sol =====
// Reconstructed pre-patch (vulnerable) contracts/Tokens/VTokens/VBep20.sol,
// live on BNB Chain through March 15 2026. Derived by reverse-applying
// VenusProtocol/venus-protocol PR #664. VToken.sol only declares
// doTransferIn/doTransferOut/getCashPrior as abstract -- this is where the
// actual, concrete, vulnerable implementation lived.

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

// ===== FILE: Venus_Comptroller_PolicyFacet_current.sol =====
// SOURCE-DATING CAVEAT: this is the CURRENT develop-branch file (fetched
// 2026-08-10), not a pinned March-2026 snapshot. It contains features (Prime
// scoring, deviationBoundedOracle) that look newer than the exploit date and
// may include post-incident hardening. Treat this as the best available
// reference for CURRENT mintAllowed()/supplyCaps architecture, not as
// verified exploit-era bytecode.

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
}

// Relevant to the donation-attack chain: mintAllowed() computes
// nextTotalSupply using VToken(vToken).exchangeRateStored() and compares it
// against supplyCaps[vToken]. It trusts the VToken's own exchange-rate
// calculation as ground truth with no independent cross-check -- so if
// getCashPrior() on the VToken side is manipulated (see file above), the
// Comptroller's supply-cap policy check inherits the corrupted value rather
// than catching it.

// ===== FILE: ComptrollerStorage.sol =====
// Legacy storage layer (UnitrollerAdminStorage + ComptrollerStorage),
// pragma 0.5.16-era, sitting underneath the Diamond proxy.

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

// ===== FILE: Unitroller.sol + ComptrollerInterface.sol =====
// Delegatecall admin proxy (body not captured -- pure admin/upgrade
// plumbing, not relevant to the donation-attack chain) + external
// policy-hook interface.

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
`;

combined = combined + "\n\n" + supportingVenusSource;

// Guard against blowing the model's context on a huge multi-file contract
const MAX_CHARS = 400000;
let truncated = false;
if (combined.length > MAX_CHARS) {
  combined = combined.slice(0, MAX_CHARS);
  truncated = true;
}

return {
  json: {
    module_status: "SOURCE_NORMALISED",
    file_count: files.length,
    truncated,
    full_source_text: combined
  }
};
