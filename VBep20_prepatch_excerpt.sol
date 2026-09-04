// Reconstructed pre-patch excerpt of contracts/Tokens/VTokens/VBep20.sol
// (vulnerable version, live on BNB Chain through March 15 2026)
// Derived by reverse-applying VenusProtocol/venus-protocol PR #664
// (https://github.com/VenusProtocol/venus-protocol/pull/664)
//
// This is the file our original Venus source dump was missing. VToken.sol
// only declares doTransferIn/doTransferOut/getCashPrior as abstract --
// this is where the actual, concrete, vulnerable implementation lived.

contract VBep20 is VToken, VBep20Interface {

    /**
     * @dev Similar to ERC-20 transfer, but handles tokens that have transfer fees.
     *      This function returns the actual amount received,
     *      which may be less than `amount` if there is a fee attached to the transfer.
     * @param from Sender of the underlying tokens
     * @param amount Amount of underlying to transfer
     * @return Actual amount received
     */
    function doTransferIn(address from, uint256 amount) internal virtual override returns (uint256) {
        IERC20 token = IERC20(underlying);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        // Return the amount that was *actually* transferred
        return balanceAfter - balanceBefore;
    }

    /**
     * @dev Just a regular ERC-20 transfer, reverts on failure
     * @param to Receiver of the underlying tokens
     * @param amount Amount of underlying to transfer
     */
    function doTransferOut(address payable to, uint256 amount) internal virtual override {
        IERC20 token = IERC20(underlying);
        token.safeTransfer(to, amount);
    }

    /**
     * @notice Gets balance of this contract in terms of the underlying
     * @dev This excludes the value of the current message, if any
     * @return The quantity of underlying tokens owned by this contract
     */
    function getCashPrior() internal view override returns (uint) {
        return IERC20(underlying).balanceOf(address(this));
    }
}

// Note: pre-patch, there is no `internalCash` storage variable, no
// `sweepTokenAndSync()` function, no `CashSynced`/`TokenSwept` events --
// all of those were added BY the patch. This is the complete pre-patch
// surface relevant to the donation-attack finding: getCashPrior() reads
// the contract's raw token balance directly, and neither doTransferIn nor
// doTransferOut maintain any separate internal ledger to compare it
// against, so a plain ERC-20 transfer to the contract inflates the
// balance getCashPrior() reports with nothing to catch it.
