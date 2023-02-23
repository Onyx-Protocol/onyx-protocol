pragma solidity ^0.5.16;

import "./OTokenEx.sol";

interface IOERC721 {
    function balanceOf(address owner) external view returns (uint256 balance);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/**
 * @title Onyx's OErc721 Contract
 * @notice OTokens which wrap an EIP-721 underlying
 * @author Onyx
 */
contract OErc721 is OTokenEx, OErc721Interface {

    /**
     * @notice Initialize the new money market
     * @param underlying_ The address of the underlying asset
     * @param comptroller_ The address of the Comptroller
     * @param interestRateModel_ The address of the interest rate model
     * @param initialExchangeRateMantissa_ The initial exchange rate, scaled by 1e18
     * @param name_ ERC-20 name of this token
     * @param symbol_ ERC-20 symbol of this token
     * @param decimals_ ERC-20 decimal precision of this token
     */
    function initialize(address underlying_,
                        ComptrollerInterface comptroller_,
                        InterestRateModel interestRateModel_,
                        uint initialExchangeRateMantissa_,
                        string memory name_,
                        string memory symbol_,
                        uint8 decimals_) public {
        // OToken initialize does the bulk of the work
        super.initialize(comptroller_, interestRateModel_, initialExchangeRateMantissa_, name_, symbol_, decimals_);

        // Set underlying and sanity check it
        underlying = underlying_;
        EIP20Interface(underlying).totalSupply();
    }

    /*** User Interface ***/

    /**
     * @notice Sender supplies assets into the market and receives oTokens in exchange
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param mintAmount The amount of the underlying asset to supply
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    // function mint(uint mintAmount) external returns (uint) {
    //     (uint err,) = mintInternal(mintAmount);
    //     return err;
    // }

    /**
     * @notice Sender supplies assets into the market and receives oTokens in exchange
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param tokenId The token id
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function mint(uint tokenId) external returns (uint) {
        (uint err,) = mintInternal(tokenId);
        return err;
    }
    function mints(uint[] calldata tokenIds) external returns (uint[] memory) {
        uint amount = tokenIds.length;
        uint[] memory errs = new uint[](amount);
        for (uint i = 0; i < amount; i++) {
            (errs[i],) = mintInternal(tokenIds[i]);
        }
        return errs;
    }

    /**
     * @notice Sender redeems oTokens in exchange for the underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemTokenId The number of oTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function redeem(uint redeemTokenId) external returns (uint) {
        return redeemInternal(redeemTokenId);
    }
    function redeems(uint[] calldata redeemTokenIds) external returns (uint[] memory) {
        uint amount = redeemTokenIds.length;
        uint[] memory errs = new uint[](amount);
        for (uint i = 0; i < amount; i++) {
            errs[i] = redeemInternal(redeemTokenIds[i]);
        }
        return errs;
    }

    /**
     * @notice Sender redeems oTokens in exchange for a specified amount of underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemAmount The amount of underlying to redeem
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function redeemUnderlying(uint redeemAmount) external returns (uint) {
        return redeemUnderlyingInternal(redeemAmount);
    }

    /**
      * @notice Sender borrows assets from the protocol to their own address
      * @param borrowAmount The amount of the underlying asset to borrow
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function borrow(uint borrowAmount) external returns (uint) {
        require(false);
        return borrowInternal(borrowAmount);
    }

    /**
     * @notice Sender repays their own borrow
     * @param repayAmount The amount to repay
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function repayBorrow(uint repayAmount) external returns (uint) {
        require(false);
        (uint err,) = repayBorrowInternal(repayAmount);
        return err;
    }

    /**
     * @notice Sender repays a borrow belonging to borrower
     * @param borrower the account with the debt being payed off
     * @param repayAmount The amount to repay
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint) {
        require(false);
        (uint err,) = repayBorrowBehalfInternal(borrower, repayAmount);
        return err;
    }

    /**
     * @notice The sender liquidates the borrowers collateral.
     *  The collateral seized is transferred to the liquidator.
     * @param borrower The borrower of this oToken to be liquidated
     * @param repayAmount The amount of the underlying borrowed asset to repay
     * @param oTokenCollateral The market in which to seize collateral from the borrower
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function liquidateBorrow(address borrower, uint repayAmount, OTokenInterface oTokenCollateral) external returns (uint) {
        require(false);
        (uint err,) = liquidateBorrowInternal(borrower, repayAmount, oTokenCollateral);
        return err;
    }

    /**
     * @notice A public function to sweep accidental ERC-20 transfers to this contract. Tokens are sent to admin (timelock)
     * @param token The address of the ERC-20 token to sweep
     */
    function sweepToken(EIP20NonStandardInterface token) external {
    	require(address(token) != underlying, "OErc20::sweepToken: can not sweep underlying token");
    	uint256 balance = token.balanceOf(address(this));
    	token.transfer(admin, balance);
    }

    /*** Safe Token ***/

    /**
     * @notice Gets balance of this contract in terms of the underlying
     * @dev This excludes the value of the current message, if any
     * @return The quantity of underlying tokens owned by this contract
     */
    function getCashPrior() internal view returns (uint) {
        // IOERC721 token = IOERC721(underlying);
        // return token.balanceOf(address(this));

        // NFT transfer to OToken contract can cause exchangeRate changed
        return totalSupply;
    }

    /**
     * @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom` and reverts in that case.
     *      This will revert due to insufficient balance or insufficient allowance.
     *      This function returns the actual amount received,
     *      which may be less than `amount` if there is a fee attached to the transfer.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
     */
    function doTransferIn(address from, uint tokenId) internal returns (uint) {
        IOERC721 token = IOERC721(underlying);
        uint balanceBefore = token.balanceOf(address(this));
        token.transferFrom(from, address(this), tokenId);
        userTokens[from].push(tokenId);

        // bool success;
        // assembly {
        //     switch returndatasize()
        //         case 0 {                       // This is a non-standard ERC-20
        //             success := not(0)          // set success to true
        //         }
        //         case 32 {                      // This is a compliant ERC-20
        //             returndatacopy(0, 0, 32)
        //             success := mload(0)        // Set `success = returndata` of external call
        //         }
        //         default {                      // This is an excessively non-compliant ERC-20, revert.
        //             revert(0, 0)
        //         }
        // }
        // require(success, "TOKEN_TRANSFER_IN_FAILED");

        // Calculate the amount that was *actually* transferred
        uint balanceAfter = token.balanceOf(address(this));
        require(balanceAfter >= balanceBefore, "TOKEN_TRANSFER_IN_OVERFLOW");
        return balanceAfter - balanceBefore;   // underflow already checked above, just subtract
    }

    /**
     * @dev Similar to EIP20 transfer, except it handles a False success from `transfer` and returns an explanatory
     *      error code rather than reverting. If caller has not called checked protocol's balance, this may revert due to
     *      insufficient cash held in this contract. If caller has checked protocol's balance prior to this call, and verified
     *      it is >= amount, this should not revert in normal conditions.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
     */
    function doTransferOut(address payable to, uint tokenIndex) internal {
        require(userTokens[to].length > tokenIndex, "invalid token index");

        IOERC721 token = IOERC721(underlying);
        uint tokenId = userTokens[to][tokenIndex];
        uint newBalance = userTokens[to].length - 1;
        userTokens[to][tokenIndex] = userTokens[to][newBalance];
        userTokens[to].pop();
        token.transferFrom(address(this), to, tokenId);

        // bool success;
        // assembly {
        //     switch returndatasize()
        //         case 0 {                      // This is a non-standard ERC-20
        //             success := not(0)          // set success to true
        //         }
        //         case 32 {                     // This is a complaint ERC-20
        //             returndatacopy(0, 0, 32)
        //             success := mload(0)        // Set `success = returndata` of external call
        //         }
        //         default {                     // This is an excessively non-compliant ERC-20, revert.
        //             revert(0, 0)
        //         }
        // }
        // require(success, "TOKEN_TRANSFER_OUT_FAILED");
    }

    function doTransfer(address from, address to, uint tokenIndex) internal {
        require(userTokens[from].length > tokenIndex, "invalid token index");

        // doTransferOut
        uint newBalance = userTokens[from].length - 1;
        require(tokenIndex <= newBalance);
        uint tokenId = userTokens[from][tokenIndex];
        if (tokenIndex < newBalance) {
            userTokens[from][tokenIndex] = userTokens[from][newBalance];
        }
        userTokens[from].pop();

        // doTransferIn
        userTokens[to].push(tokenId);
    }
}
