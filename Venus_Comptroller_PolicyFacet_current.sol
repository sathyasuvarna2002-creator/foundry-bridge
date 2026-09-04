// contracts/Comptroller/Diamond/facets/PolicyFacet.sol
// Source: VenusProtocol/venus-protocol, develop branch (fetched 2026-08-10)
// https://raw.githubusercontent.com/VenusProtocol/venus-protocol/develop/contracts/Comptroller/Diamond/facets/PolicyFacet.sol
//
// IMPORTANT VERSION CAVEAT:
// This is the CURRENT develop-branch file, not a pinned historical snapshot from
// March 15 2026 (the exploit date). It contains features (Prime scoring,
// deviationBoundedOracle, multi-pool userPoolId/PoolMarketId logic) that read as
// materially newer than a classic Compound-fork Comptroller, and at least one of
// them (deviationBoundedOracle, used in borrowAllowed for price bounding) could
// plausibly be a post-incident hardening addition. Do not treat this file as
// "the exact bytecode live during the exploit" -- treat it as the best available
// reference for the CURRENT mintAllowed()/supplyCaps architecture and note the
// dating uncertainty explicitly in any finding that cites it.
//
// Also corrects an earlier assumption made in this project: Venus Core Pool's
// Comptroller IS implemented as a Diamond proxy with facets (MarketFacet,
// PolicyFacet, RewardFacet, SetterFacet) -- confirmed via the repo's own
// README.md on the master branch ("Diamond Comptroller ... implemented as a
// Diamond proxy with several facets"). The flat, non-Diamond ComptrollerStorage.sol
// / Unitroller.sol / ComptrollerInterface.sol the user pasted earlier is an
// OLDER architectural layer (UnitrollerAdminStorage is still the base of the
// current ComptrollerV1Storage chain), not evidence that Core Pool skipped
// Diamond -- the Diamond sits on top of / alongside that legacy storage lineage.
//
// Relevant to the donation-attack finding: mintAllowed() below computes
// nextTotalSupply using VToken(vToken).exchangeRateStored() and compares it
// against supplyCaps[vToken]. It trusts the VToken's own exchange-rate
// calculation as ground truth with no independent cross-check -- so if
// getCashPrior() on the VToken side is manipulated (the actual pre-patch bug,
// see VBep20_prepatch_excerpt.sol), the Comptroller's supply-cap policy check
// inherits that corrupted value rather than catching it. This is a trust-boundary
// observation about the Comptroller, not the root cause itself.

pragma solidity 0.8.25;

import { VToken } from "../../../Tokens/VTokens/VToken.sol";
import { Action } from "../../ComptrollerInterface.sol";
import { IPolicyFacet } from "../interfaces/IPolicyFacet.sol";

import { XVSRewardsHelper } from "./XVSRewardsHelper.sol";
import { PoolMarketId } from "../../../Comptroller/Types/PoolMarketId.sol";
import { WeightFunction } from "../interfaces/IFacetBase.sol";

/**
 * @title PolicyFacet
 * @author Venus
 * @dev This facet contains all the hooks used while transferring the assets
 * @notice This facet contract contains all the external pre-hook functions related to vToken
 */
contract PolicyFacet is IPolicyFacet, XVSRewardsHelper {
    /// @notice Emitted when a new borrow-side XVS speed is calculated for a market
    event VenusBorrowSpeedUpdated(VToken indexed vToken, uint256 newSpeed);

    /// @notice Emitted when a new supply-side XVS speed is calculated for a market
    event VenusSupplySpeedUpdated(VToken indexed vToken, uint256 newSpeed);

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param vToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address vToken, address minter, uint256 mintAmount) external returns (uint256) {
        // Pausing is a very serious situation - we revert to sound the alarms
        checkProtocolPauseState();
        checkActionPauseState(vToken, Action.MINT);
        ensureListed(getCorePoolMarket(vToken));

        uint256 supplyCap = supplyCaps[vToken];
        require(supplyCap != 0, "market supply cap is 0");

        uint256 vTokenSupply = VToken(vToken).totalSupply();
        Exp memory exchangeRate = Exp({ mantissa: VToken(vToken).exchangeRateStored() });
        uint256 nextTotalSupply = mul_ScalarTruncateAddUInt(exchangeRate, vTokenSupply, mintAmount);
        require(nextTotalSupply <= supplyCap, "market supply cap reached");

        // Keep the flywheel moving
        updateVenusSupplyIndex(vToken);
        distributeSupplierVenus(vToken, minter);

        return uint256(Error.NO_ERROR);
    }

    // ... redeemAllowed / borrowAllowed / repayBorrowAllowed / liquidateBorrowAllowed /
    // seizeAllowed / transferAllowed and their *Verify counterparts follow the same
    // pattern (pause checks, ensureListed, cap checks, flywheel updates). Full file
    // fetched and available on request -- trimmed here to the section relevant to
    // the donation-attack causal chain (mintAllowed / supplyCaps / exchangeRateStored).
}
