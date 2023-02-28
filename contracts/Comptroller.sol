pragma solidity ^0.5.16;

import "./OToken.sol";
import "./ErrorReporter.sol";
import "./PriceOracle.sol";
import "./ComptrollerInterface.sol";
import "./ComptrollerExInterface.sol";
import "./ComptrollerStorage.sol";
import "./Unitroller.sol";
import "./XCNInterface.sol";

/**
 * @title Onyx's Comptroller Contract
 * @author Onyx
 */
contract Comptroller is ComptrollerV5Storage, ComptrollerInterface, ComptrollerExInterface, ComptrollerErrorReporter, ExponentialNoError {
    /// @notice Emitted when an admin supports a market
    event MarketListed(OToken oToken);

    /// @notice Emitted when an account enters a market
    event MarketEntered(OToken oToken, address account);

    /// @notice Emitted when an account exits a market
    event MarketExited(OToken oToken, address account);

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(uint oldCloseFactorMantissa, uint newCloseFactorMantissa);

    /// @notice Emitted when a collateral factor is changed by admin
    event NewCollateralFactor(OToken oToken, uint oldCollateralFactorMantissa, uint newCollateralFactorMantissa);

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(uint oldLiquidationIncentiveMantissa, uint newLiquidationIncentiveMantissa);

    /// @notice Emitted when price oracle is changed
    event NewPriceOracle(PriceOracle oldPriceOracle, PriceOracle newPriceOracle);

    /// @notice Emitted when pause guardian is changed
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    /// @notice Emitted when an action is paused globally
    event ActionPaused(string action, bool pauseState);

    /// @notice Emitted when an action is paused on a market
    event ActionPaused(OToken oToken, string action, bool pauseState);

    /// @notice Emitted when a new borrow-side XCN speed is calculated for a market
    event XcnBorrowSpeedUpdated(OToken indexed oToken, uint newSpeed);

    /// @notice Emitted when a new supply-side XCN speed is calculated for a market
    event XcnSupplySpeedUpdated(OToken indexed oToken, uint newSpeed);

    /// @notice Emitted when XCN is distributed to a supplier
    event DistributedSupplierXcn(OToken indexed oToken, address indexed supplier, uint xcnDelta, uint xcnSupplyIndex);

    /// @notice Emitted when XCN is distributed to a borrower
    event DistributedBorrowerXcn(OToken indexed oToken, address indexed borrower, uint xcnDelta, uint xcnBorrowIndex);

    /// @notice Emitted when market caps for a oToken is changed
    event NewMarketCaps(OToken indexed oToken, uint newSupplyCap, uint newBorrowCap);

    /// @notice Emitted when market cap guardian is changed
    event NewMarketCapGuardian(address oldMarketCapGuardian, address newMarketCapGuardian);

    /// @notice Emitted when XCN is granted by admin
    event XcnGranted(address recipient, uint amount);

    /// @notice Emitted when XCN accrued for a user has been manually adjusted.
    event XcnAccruedAdjusted(address indexed user, uint oldXcnAccrued, uint newXcnAccrued);

    /// @notice The initial XCN index for a market
    uint224 public constant xcnInitialIndex = 1e36;

    // No collateralFactorMantissa may exceed this value
    uint internal constant collateralFactorMaxMantissa = 0.9e18; // 0.9

    constructor() public {
        admin = msg.sender;
    }

    /*** Assets You Are In ***/

    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
    function getAssetsIn(address account) external view returns (OToken[] memory) {
        OToken[] memory assetsIn = accountAssets[account];

        return assetsIn;
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param oToken The oToken to check
     * @return True if the account is in the asset, otherwise false.
     */
    function checkMembership(address account, OToken oToken) external view returns (bool) {
        return markets[address(oToken)].accountMembership[account];
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param oTokens The list of addresses of the oToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
    function enterMarkets(address[] memory oTokens) public returns (uint[] memory) {
        uint len = oTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            OToken oToken = OToken(oTokens[i]);

            results[i] = uint(addToMarketInternal(oToken, msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param oToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
    function addToMarketInternal(OToken oToken, address borrower) internal returns (Error) {
        Market storage marketToJoin = markets[address(oToken)];

        if (!marketToJoin.isListed) {
            // market is not listed, cannot join
            return Error.MARKET_NOT_LISTED;
        }

        if (marketToJoin.accountMembership[borrower] == true) {
            // already joined
            return Error.NO_ERROR;
        }

        // survived the gauntlet, add to list
        // NOTE: we store these somewhat redundantly as a significant optimization
        //  this avoids having to iterate through the list for the most common use cases
        //  that is, only when we need to perform liquidity checks
        //  and not whenever we want to check if an account is in a particular market
        marketToJoin.accountMembership[borrower] = true;
        accountAssets[borrower].push(oToken);

        emit MarketEntered(oToken, borrower);

        return Error.NO_ERROR;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing necessary collateral for an outstanding borrow.
     * @param oTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
    function exitMarket(address oTokenAddress) external returns (uint) {
        OToken oToken = OToken(oTokenAddress);
        /* Get sender tokensHeld and amountOwed underlying from the oToken */
        (uint oErr, uint tokensHeld, uint amountOwed, ) = oToken.getAccountSnapshot(msg.sender);
        require(oErr == 0, "exitMarket: getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
        uint allowed = redeemAllowedInternal(oTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[address(oToken)];

        /* Return true if the sender is not already ‘in’ the market */
        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set oToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete oToken from the account’s list of assets */
        // load into memory for faster iteration
        OToken[] memory userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint assetIndex = len;
        for (uint i = 0; i < len; i++) {
            if (userAssetList[i] == oToken) {
                assetIndex = i;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(assetIndex < len);

        // copy last item in list to location of item to be removed, reduce length by 1
        OToken[] storage storedList = accountAssets[msg.sender];
        storedList[assetIndex] = storedList[storedList.length - 1];
        storedList.length--;

        emit MarketExited(oToken, msg.sender);

        return uint(Error.NO_ERROR);
    }

    /*** Policy Hooks ***/

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param oToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address oToken, address minter, uint mintAmount) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintGuardianPaused[oToken], "mint is paused");

        // Shh - currently unused
        minter;
        mintAmount;

        if (!markets[oToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        uint supplyCap = supplyCaps[oToken];
        // Supply cap of 0 corresponds to unlimited supplying
        if (supplyCap != 0) {
            uint totalCash = OToken(oToken).getCash();
            uint totalBorrows = OToken(oToken).totalBorrows();
            uint totalReserves = OToken(oToken).totalReserves();

            uint totalSupplies = sub_(
                add_(totalCash, totalBorrows),
                totalReserves
            );

            uint nextTotalSupplies = add_(totalSupplies, mintAmount);
            require(nextTotalSupplies < supplyCap, "market supply cap reached");
        }

        // Keep the flywheel moving
        updateXcnSupplyIndex(oToken);
        distributeSupplierXcn(oToken, minter);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates mint and reverts on rejection. May emit logs.
     * @param oToken Asset being minted
     * @param minter The address minting the tokens
     * @param actualMintAmount The amount of the underlying asset being minted
     * @param mintTokens The number of tokens being minted
     */
    function mintVerify(address oToken, address minter, uint actualMintAmount, uint mintTokens) external {
        // Shh - currently unused
        oToken;
        minter;
        actualMintAmount;
        mintTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to redeem tokens in the given market
     * @param oToken The market to verify the redeem against
     * @param redeemer The account which would redeem the tokens
     * @param redeemTokens The number of oTokens to exchange for the underlying asset in the market
     * @return 0 if the redeem is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function redeemAllowed(address oToken, address redeemer, uint redeemTokens) external returns (uint) {
        uint allowed = redeemAllowedInternal(oToken, redeemer, redeemTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateXcnSupplyIndex(oToken);
        distributeSupplierXcn(oToken, redeemer);

        return uint(Error.NO_ERROR);
    }

    function redeemAllowedInternal(address oToken, address redeemer, uint redeemTokens) internal view returns (uint) {
        if (!markets[oToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* If the redeemer is not 'in' the market, then we can bypass the liquidity check */
        if (!markets[oToken].accountMembership[redeemer]) {
            return uint(Error.NO_ERROR);
        }

        /* Otherwise, perform a hypothetical liquidity check to guard against shortfall */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(redeemer, OToken(oToken), redeemTokens, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall > 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates redeem and reverts on rejection. May emit logs.
     * @param oToken Asset being redeemed
     * @param redeemer The address redeeming the tokens
     * @param redeemAmount The amount of the underlying asset being redeemed
     * @param redeemTokens The number of tokens being redeemed
     */
    function redeemVerify(address oToken, address redeemer, uint redeemAmount, uint redeemTokens) external {
        // Shh - currently unused
        oToken;
        redeemer;

        // Require tokens is zero or amount is also zero
        if (redeemTokens == 0 && redeemAmount > 0) {
            revert("redeemTokens zero");
        }
    }

    /**
     * @notice Checks if the account should be allowed to borrow the underlying asset of the given market
     * @param oToken The market to verify the borrow against
     * @param borrower The account which would borrow the asset
     * @param borrowAmount The amount of underlying the account would borrow
     * @return 0 if the borrow is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function borrowAllowed(address oToken, address borrower, uint borrowAmount) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!borrowGuardianPaused[oToken], "borrow is paused");

        if (!markets[oToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (!markets[oToken].accountMembership[borrower]) {
            // only oTokens may call borrowAllowed if borrower not in market
            require(msg.sender == oToken, "sender must be oToken");

            // attempt to add borrower to the market
            Error err = addToMarketInternal(OToken(msg.sender), borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }

            // it should be impossible to break the important invariant
            assert(markets[oToken].accountMembership[borrower]);
        }

        if (oracle.getUnderlyingPrice(OToken(oToken)) == 0) {
            return uint(Error.PRICE_ERROR);
        }


        uint borrowCap = borrowCaps[oToken];
        // Borrow cap of 0 corresponds to unlimited borrowing
        if (borrowCap != 0) {
            uint totalBorrows = OToken(oToken).totalBorrows();
            uint nextTotalBorrows = add_(totalBorrows, borrowAmount);
            require(nextTotalBorrows < borrowCap, "market borrow cap reached");
        }

        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, OToken(oToken), 0, borrowAmount);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall > 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: OToken(oToken).borrowIndex()});
        updateXcnBorrowIndex(oToken, borrowIndex);
        distributeBorrowerXcn(oToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates borrow and reverts on rejection. May emit logs.
     * @param oToken Asset whose underlying is being borrowed
     * @param borrower The address borrowing the underlying
     * @param borrowAmount The amount of the underlying asset requested to borrow
     */
    function borrowVerify(address oToken, address borrower, uint borrowAmount) external {
        // Shh - currently unused
        oToken;
        borrower;
        borrowAmount;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to repay a borrow in the given market
     * @param oToken The market to verify the repay against
     * @param payer The account which would repay the asset
     * @param borrower The account which would borrowed the asset
     * @param repayAmount The amount of the underlying asset the account would repay
     * @return 0 if the repay is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function repayBorrowAllowed(
        address oToken,
        address payer,
        address borrower,
        uint repayAmount) external returns (uint) {
        // Shh - currently unused
        payer;
        borrower;
        repayAmount;

        if (!markets[oToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: OToken(oToken).borrowIndex()});
        updateXcnBorrowIndex(oToken, borrowIndex);
        distributeBorrowerXcn(oToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates repayBorrow and reverts on rejection. May emit logs.
     * @param oToken Asset being repaid
     * @param payer The address repaying the borrow
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function repayBorrowVerify(
        address oToken,
        address payer,
        address borrower,
        uint actualRepayAmount,
        uint borrowerIndex) external {
        // Shh - currently unused
        oToken;
        payer;
        borrower;
        actualRepayAmount;
        borrowerIndex;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the liquidation should be allowed to occur
     * @param oTokenBorrowed Asset which was borrowed by the borrower
     * @param oTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param repayAmount The amount of underlying being repaid
     */
    function liquidateBorrowAllowed(
        address oTokenBorrowed,
        address oTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external returns (uint) {
        // Shh - currently unused
        liquidator;

        if (!markets[oTokenBorrowed].isListed || !markets[oTokenCollateral].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        uint borrowBalance = OToken(oTokenBorrowed).borrowBalanceStored(borrower);

        /* allow accounts to be liquidated if the market is deprecated */
        if (isDeprecated(OToken(oTokenBorrowed))) {
            require(borrowBalance >= repayAmount, "Can not repay more than the total borrow");
        } else {
            /* The borrower must have shortfall in order to be liquidatable */
            (Error err, , uint shortfall) = getAccountLiquidityInternal(borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }

            if (shortfall == 0) {
                return uint(Error.INSUFFICIENT_SHORTFALL);
            }

            // if we have proxy's extra repay amount, we allow full liquidate
            if (getLiquidationExtraRepayAmount() == 0) {
                /* The liquidator may not repay more than what is allowed by the closeFactor */
                uint maxClose = mul_ScalarTruncate(Exp({mantissa: closeFactorMantissa}), borrowBalance);
                if (repayAmount > maxClose) {
                    return uint(Error.TOO_MUCH_REPAY);
                }
            }
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates liquidateBorrow and reverts on rejection. May emit logs.
     * @param oTokenBorrowed Asset which was borrowed by the borrower
     * @param oTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function liquidateBorrowVerify(
        address oTokenBorrowed,
        address oTokenCollateral,
        address liquidator,
        address borrower,
        uint actualRepayAmount,
        uint seizeTokens) external {
        // Shh - currently unused
        oTokenBorrowed;
        oTokenCollateral;
        liquidator;
        borrower;
        actualRepayAmount;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the seizing of assets should be allowed to occur
     * @param oTokenCollateral Asset which was used as collateral and will be seized
     * @param oTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeAllowed(
        address oTokenCollateral,
        address oTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!seizeGuardianPaused, "seize is paused");

        // Shh - currently unused
        seizeTokens;

        if (!markets[oTokenCollateral].isListed || !markets[oTokenBorrowed].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (OToken(oTokenCollateral).comptroller() != OToken(oTokenBorrowed).comptroller()) {
            return uint(Error.COMPTROLLER_MISMATCH);
        }

        // Keep the flywheel moving
        updateXcnSupplyIndex(oTokenCollateral);
        distributeSupplierXcn(oTokenCollateral, borrower);
        distributeSupplierXcn(oTokenCollateral, liquidator);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates seize and reverts on rejection. May emit logs.
     * @param oTokenCollateral Asset which was used as collateral and will be seized
     * @param oTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeVerify(
        address oTokenCollateral,
        address oTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external {
        // Shh - currently unused
        oTokenCollateral;
        oTokenBorrowed;
        liquidator;
        borrower;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to transfer tokens in the given market
     * @param oToken The market to verify the transfer against
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of oTokens to transfer
     * @return 0 if the transfer is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function transferAllowed(address oToken, address src, address dst, uint transferTokens) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!transferGuardianPaused, "transfer is paused");

        // Currently the only consideration is whether or not
        //  the src is allowed to redeem this many tokens
        uint allowed = redeemAllowedInternal(oToken, src, transferTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateXcnSupplyIndex(oToken);
        distributeSupplierXcn(oToken, src);
        distributeSupplierXcn(oToken, dst);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates transfer and reverts on rejection. May emit logs.
     * @param oToken Asset being transferred
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of oTokens to transfer
     */
    function transferVerify(address oToken, address src, address dst, uint transferTokens) external {
        // Shh - currently unused
        oToken;
        src;
        dst;
        transferTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /*** Liquidity/Liquidation Calculations ***/

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account liquidity.
     *  Note that `oTokenBalance` is the number of oTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountLiquidityLocalVars {
        uint sumCollateral;
        uint sumBorrowPlusEffects;
        uint oTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address account) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, OToken(0), 0, 0);

        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code,
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidityInternal(address account) internal view returns (Error, uint, uint) {
        return getHypotheticalAccountLiquidityInternal(account, OToken(0), 0, 0);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param oTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @return (possible error code (semi-opaque),
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidity(
        address account,
        address oTokenModify,
        uint redeemTokens,
        uint borrowAmount) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, OToken(oTokenModify), redeemTokens, borrowAmount);
        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param oTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @dev Note that we calculate the exchangeRateStored for each collateral oToken using stored data,
     *  without calculating accumulated interest.
     * @return (possible error code,
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidityInternal(
        address account,
        OToken oTokenModify,
        uint redeemTokens,
        uint borrowAmount) internal view returns (Error, uint, uint) {

        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint oErr;

        // For each asset the account is in
        OToken[] memory assets = accountAssets[account];
        for (uint i = 0; i < assets.length; i++) {
            OToken asset = assets[i];

            // Read the balances and exchange rate from the oToken
            (oErr, vars.oTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = asset.getAccountSnapshot(account);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (Error.SNAPSHOT_ERROR, 0, 0);
            }
            vars.collateralFactor = Exp({mantissa: markets[address(asset)].collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(asset);
            if (vars.oraclePriceMantissa == 0) {
                return (Error.PRICE_ERROR, 0, 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> ether (normalized price value)
            vars.tokensToDenom = mul_(mul_(vars.collateralFactor, vars.exchangeRate), vars.oraclePrice);

            // sumCollateral += tokensToDenom * oTokenBalance
            vars.sumCollateral = mul_ScalarTruncateAddUInt(vars.tokensToDenom, vars.oTokenBalance, vars.sumCollateral);

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);

            // Calculate effects of interacting with oTokenModify
            if (asset == oTokenModify) {
                // redeem effect
                // sumBorrowPlusEffects += tokensToDenom * redeemTokens
                vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.tokensToDenom, redeemTokens, vars.sumBorrowPlusEffects);

                // borrow effect
                // sumBorrowPlusEffects += oraclePrice * borrowAmount
                vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.oraclePrice, borrowAmount, vars.sumBorrowPlusEffects);
            }
        }

        // These are safe, as the underflow condition is checked first
        if (vars.sumCollateral > vars.sumBorrowPlusEffects) {
            return (Error.NO_ERROR, vars.sumCollateral - vars.sumBorrowPlusEffects, 0);
        } else {
            return (Error.NO_ERROR, 0, vars.sumBorrowPlusEffects - vars.sumCollateral);
        }
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in oToken.liquidateBorrowFresh)
     * @param oTokenBorrowed The address of the borrowed oToken
     * @param oTokenCollateral The address of the collateral oToken
     * @param actualRepayAmount The amount of oTokenBorrowed underlying to convert into oTokenCollateral tokens
     * @return (errorCode, number of oTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateCalculateSeizeTokens(address oTokenBorrowed, address oTokenCollateral, uint actualRepayAmount) external view returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = oracle.getUnderlyingPrice(OToken(oTokenBorrowed));
        uint priceCollateralMantissa = oracle.getUnderlyingPrice(OToken(oTokenCollateral));
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /* we add extra repay amount from liquidation proxy to calculation */
        uint extraRepayAmount = getLiquidationExtraRepayAmount();
        uint totalRepayAmount = add_(actualRepayAmount, extraRepayAmount);

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = totalRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = totalRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint exchangeRateMantissa = OToken(oTokenCollateral).exchangeRateStored(); // Note: reverts on error
        uint extendingDecimal = 1;
        // if NFT liquidation, we extend decimals to calculate correct seize tokens with extra repay
        if (OTokenInterface(oTokenCollateral).decimals() == 0) {
            extendingDecimal = 1e18;
        }

        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;

        numerator = mul_(Exp({mantissa: liquidationIncentiveMantissa}), Exp({mantissa: priceBorrowedMantissa}));
        denominator = mul_(Exp({mantissa: priceCollateralMantissa}), Exp({mantissa: exchangeRateMantissa}));
        ratio = div_(Exp({mantissa: numerator.mantissa * extendingDecimal}), denominator);

        // TODO: We need specific calculation for this
        seizeTokens = mul_ScalarTruncate(ratio, totalRepayAmount) / extendingDecimal;

        return (uint(Error.NO_ERROR), seizeTokens);
    }

    /**
     * @notice Calculate(floor) number of tokens of ERC721 collateral asset to seize given an underlying amount
     * @dev Used in ERC721 liquidation (called in oTokenEx.liquidateBorrowFresh)
     * @param oTokenBorrowed The address of the borrowed oToken
     * @param oTokenExCollateral The address of the collateral oTokenEx
     * @param repayAmount The amount of oTokenBorrowed underlying to convert into oTokenExCollateral tokens
     * @return (
            errorCode,
            number of oTokenExCollateral tokens to be seized in a liquidation,
            number of oTokenBorrowed tokens that needs to be repayed in a liquidation
        )
     */
    function liquidateCalculateSeizeTokensEx(address oTokenBorrowed, address oTokenExCollateral, uint repayAmount) external view returns (uint, uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = oracle.getUnderlyingPrice(OToken(oTokenBorrowed));
        uint priceCollateralMantissa = oracle.getUnderlyingPrice(OToken(oTokenExCollateral));
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0, 0);
        }

        /* we add extra repay amount from liquidation proxy to calculation */
        uint extraRepayAmount = getLiquidationExtraRepayAmount();
        uint totalRepayAmount = add_(repayAmount, extraRepayAmount);

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = totalRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = totalRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         *  possibleSizeTokens = floor(seizeTokens)
         */
        uint exchangeRateMantissa = OToken(oTokenExCollateral).exchangeRateStored(); // Note: reverts on error
        uint extendingDecimal = 1;    
        if (OTokenInterface(oTokenExCollateral).decimals() == 0) {
            extendingDecimal = 1e18;
        }

        uint possibleSeizeTokens;
        uint possibleRepayAmount;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;

        numerator = mul_(Exp({mantissa: liquidationIncentiveMantissa}), Exp({mantissa: priceBorrowedMantissa}));
        denominator = mul_(Exp({mantissa: priceCollateralMantissa}), Exp({mantissa: exchangeRateMantissa}));
        ratio = div_(Exp({mantissa: numerator.mantissa * extendingDecimal}), denominator);

        possibleSeizeTokens = mul_ScalarTruncate(ratio, totalRepayAmount) / extendingDecimal;

        if (extraRepayAmount > 0) {
            possibleRepayAmount = sub_(totalRepayAmount, extraRepayAmount);
            return (uint(Error.NO_ERROR), possibleSeizeTokens, possibleRepayAmount);
        } else {
            // We do math ceil here ((n + d - 1) / d);
            uint repayPerSeize = (denominator.mantissa + numerator.mantissa - 1) / numerator.mantissa;
            possibleRepayAmount = possibleSeizeTokens * repayPerSeize * 10001 / 10000;

            return (uint(Error.NO_ERROR), possibleSeizeTokens, possibleRepayAmount);
        }
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new price oracle for the comptroller
      * @dev Admin function to set a new price oracle
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setPriceOracle(PriceOracle newOracle) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PRICE_ORACLE_OWNER_CHECK);
        }

        // Track the old oracle for the comptroller
        PriceOracle oldOracle = oracle;

        // Set comptroller's oracle to newOracle
        oracle = newOracle;

        // Emit NewPriceOracle(oldOracle, newOracle)
        emit NewPriceOracle(oldOracle, newOracle);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the closeFactor used when liquidating borrows
      * @dev Admin function to set closeFactor
      * @param newCloseFactorMantissa New close factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure
      */
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) {
        // Check caller is admin
    	require(msg.sender == admin, "only admin can set close factor");

        uint oldCloseFactorMantissa = closeFactorMantissa;
        closeFactorMantissa = newCloseFactorMantissa;
        emit NewCloseFactor(oldCloseFactorMantissa, closeFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the collateralFactor for a market
      * @dev Admin function to set per-market collateralFactor
      * @param oToken The market to set the factor on
      * @param newCollateralFactorMantissa The new collateral factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCollateralFactor(OToken oToken, uint newCollateralFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COLLATERAL_FACTOR_OWNER_CHECK);
        }

        // Verify market is listed
        Market storage market = markets[address(oToken)];
        if (!market.isListed) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SET_COLLATERAL_FACTOR_NO_EXISTS);
        }

        Exp memory newCollateralFactorExp = Exp({mantissa: newCollateralFactorMantissa});

        // Check collateral factor <= 0.9
        Exp memory highLimit = Exp({mantissa: collateralFactorMaxMantissa});
        if (lessThanExp(highLimit, newCollateralFactorExp)) {
            return fail(Error.INVALID_COLLATERAL_FACTOR, FailureInfo.SET_COLLATERAL_FACTOR_VALIDATION);
        }

        // If collateral factor != 0, fail if price == 0
        if (newCollateralFactorMantissa != 0 && oracle.getUnderlyingPrice(oToken) == 0) {
            return fail(Error.PRICE_ERROR, FailureInfo.SET_COLLATERAL_FACTOR_WITHOUT_PRICE);
        }

        // Set market's collateral factor to new collateral factor, remember old value
        uint oldCollateralFactorMantissa = market.collateralFactorMantissa;
        market.collateralFactorMantissa = newCollateralFactorMantissa;

        // Emit event with asset, old collateral factor, and new collateral factor
        emit NewCollateralFactor(oToken, oldCollateralFactorMantissa, newCollateralFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets liquidationIncentive
      * @dev Admin function to set liquidationIncentive
      * @param newLiquidationIncentiveMantissa New liquidationIncentive scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_LIQUIDATION_INCENTIVE_OWNER_CHECK);
        }

        // Save current value for use in log
        uint oldLiquidationIncentiveMantissa = liquidationIncentiveMantissa;

        // Set liquidation incentive to new incentive
        liquidationIncentiveMantissa = newLiquidationIncentiveMantissa;

        // Emit event with old incentive, new incentive
        emit NewLiquidationIncentive(oldLiquidationIncentiveMantissa, newLiquidationIncentiveMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Add the market to the markets mapping and set it as listed
      * @dev Admin function to set isListed and add support for the market
      * @param oToken The address of the market (token) to list
      * @return uint 0=success, otherwise a failure. (See enum Error for details)
      */
    function _supportMarket(OToken oToken) external returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SUPPORT_MARKET_OWNER_CHECK);
        }

        if (markets[address(oToken)].isListed) {
            return fail(Error.MARKET_ALREADY_LISTED, FailureInfo.SUPPORT_MARKET_EXISTS);
        }

        oToken.isOToken(); // Sanity check to make sure its really a OToken

        // Note that isXcned is not in active use anymore
        markets[address(oToken)] = Market({isListed: true, isXcned: false, collateralFactorMantissa: 0});

        _addMarketInternal(address(oToken));
        _initializeMarket(address(oToken));

        emit MarketListed(oToken);

        return uint(Error.NO_ERROR);
    }

    function _addMarketInternal(address oToken) internal {
        for (uint i = 0; i < allMarkets.length; i ++) {
            require(allMarkets[i] != OToken(oToken), "market already added");
        }
        allMarkets.push(OToken(oToken));
    }

    function _initializeMarket(address oToken) internal {
        uint32 blockNumber = safe32(getBlockNumber(), "block number exceeds 32 bits");

        XcnMarketState storage supplyState = xcnSupplyState[oToken];
        XcnMarketState storage borrowState = xcnBorrowState[oToken];

        /*
         * Update market state indices
         */
        if (supplyState.index == 0) {
            // Initialize supply state index with default value
            supplyState.index = xcnInitialIndex;
        }

        if (borrowState.index == 0) {
            // Initialize borrow state index with default value
            borrowState.index = xcnInitialIndex;
        }

        /*
         * Update market state block numbers
         */
         supplyState.block = borrowState.block = blockNumber;
    }


    /**
      * @notice Set the given market caps for the given oToken markets.
      * Borrowing that brings total borrows to or above borrow cap will revert.
      * Supplying that brings total supplys to or above supply cap will revert.
      * @dev Admin or marketCapGuardian function to set the market caps. A market cap of 0 corresponds to unlimited borrowing, supplying.
      * @param oTokens The addresses of the markets (tokens) to change the market caps for
      * @param newSupplyCaps The new supply cap values in underlying to be set. A value of 0 corresponds to unlimited supplying.
      * @param newBorrowCaps The new borrow cap values in underlying to be set. A value of 0 corresponds to unlimited borrowing.
      */
    function _setMarketCaps(OToken[] calldata oTokens, uint[] calldata newSupplyCaps, uint[] calldata newBorrowCaps) external {
    	require(msg.sender == admin || msg.sender == marketCapGuardian, "only admin or market cap guardian can set market caps"); 

        uint numMarkets = oTokens.length;
        uint numSupplyCaps = newSupplyCaps.length;
        uint numBorrowCaps = newBorrowCaps.length;

        require(numMarkets != 0 && numMarkets == numSupplyCaps && numMarkets == numBorrowCaps, "invalid input");

        for(uint i = 0; i < numMarkets; i++) {
            supplyCaps[address(oTokens[i])] = newSupplyCaps[i];
            borrowCaps[address(oTokens[i])] = newBorrowCaps[i];
            emit NewMarketCaps(oTokens[i], newSupplyCaps[i], newBorrowCaps[i]);
        }
    }

    /**
     * @notice Admin function to change the Market Cap Guardian
     * @param newMarketCapGuardian The address of the new Market Cap Guardian
     */
    function _setMarketCapGuardian(address newMarketCapGuardian) external {
        require(msg.sender == admin, "only admin can set market cap guardian");

        // Save current value for inclusion in log
        address oldMarketCapGuardian = marketCapGuardian;

        // Store marketCapGuardian with value newMarketCapGuardian
        marketCapGuardian = newMarketCapGuardian;

        // Emit NewMarketCapGuardian(OldMarketCapGuardian, NewMarketCapGuardian)
        emit NewMarketCapGuardian(oldMarketCapGuardian, newMarketCapGuardian);
    }

    /**
     * @notice Admin function to change the Pause Guardian
     * @param newPauseGuardian The address of the new Pause Guardian
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setPauseGuardian(address newPauseGuardian) public returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PAUSE_GUARDIAN_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        address oldPauseGuardian = pauseGuardian;

        // Store pauseGuardian with value newPauseGuardian
        pauseGuardian = newPauseGuardian;

        // Emit NewPauseGuardian(OldPauseGuardian, NewPauseGuardian)
        emit NewPauseGuardian(oldPauseGuardian, pauseGuardian);

        return uint(Error.NO_ERROR);
    }

    function _setMintPaused(OToken oToken, bool state) public returns (bool) {
        require(markets[address(oToken)].isListed, "cannot pause a market that is not listed");
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        mintGuardianPaused[address(oToken)] = state;
        emit ActionPaused(oToken, "Mint", state);
        return state;
    }

    function _setBorrowPaused(OToken oToken, bool state) public returns (bool) {
        require(markets[address(oToken)].isListed, "cannot pause a market that is not listed");
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        borrowGuardianPaused[address(oToken)] = state;
        emit ActionPaused(oToken, "Borrow", state);
        return state;
    }

    function _setTransferPaused(bool state) public returns (bool) {
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        transferGuardianPaused = state;
        emit ActionPaused("Transfer", state);
        return state;
    }

    function _setSeizePaused(bool state) public returns (bool) {
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        seizeGuardianPaused = state;
        emit ActionPaused("Seize", state);
        return state;
    }

    function _become(Unitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        require(unitroller._acceptImplementation() == 0, "change not authorized");
    }

    /**
     * @notice Checks caller is admin, or this contract is becoming the new implementation
     */
    function adminOrInitializing() internal view returns (bool) {
        return msg.sender == admin || msg.sender == comptrollerImplementation;
    }

    /*** Xcn Distribution ***/

    /**
     * @notice Set XCN speed for a single market
     * @param oToken The market whose XCN speed to update
     * @param supplySpeed New supply-side XCN speed for market
     * @param borrowSpeed New borrow-side XCN speed for market
     */
    function setXcnSpeedInternal(OToken oToken, uint supplySpeed, uint borrowSpeed) internal {
        Market storage market = markets[address(oToken)];
        require(market.isListed, "xcn market is not listed");

        if (xcnSupplySpeeds[address(oToken)] != supplySpeed) {
            // Supply speed updated so let's update supply state to ensure that
            //  1. XCN accrued properly for the old speed, and
            //  2. XCN accrued at the new speed starts after this block.
            updateXcnSupplyIndex(address(oToken));

            // Update speed and emit event
            xcnSupplySpeeds[address(oToken)] = supplySpeed;
            emit XcnSupplySpeedUpdated(oToken, supplySpeed);
        }

        if (xcnBorrowSpeeds[address(oToken)] != borrowSpeed) {
            // Borrow speed updated so let's update borrow state to ensure that
            //  1. XCN accrued properly for the old speed, and
            //  2. XCN accrued at the new speed starts after this block.
            Exp memory borrowIndex = Exp({mantissa: oToken.borrowIndex()});
            updateXcnBorrowIndex(address(oToken), borrowIndex);

            // Update speed and emit event
            xcnBorrowSpeeds[address(oToken)] = borrowSpeed;
            emit XcnBorrowSpeedUpdated(oToken, borrowSpeed);
        }
    }

    /**
     * @notice Accrue XCN to the market by updating the supply index
     * @param oToken The market whose supply index to update
     * @dev Index is a cumulative sum of the XCN per oToken accrued.
     */
    function updateXcnSupplyIndex(address oToken) internal {
        XcnMarketState storage supplyState = xcnSupplyState[oToken];
        uint supplySpeed = xcnSupplySpeeds[oToken];
        uint32 blockNumber = safe32(getBlockNumber(), "block number exceeds 32 bits");
        uint deltaBlocks = sub_(uint(blockNumber), uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = OToken(oToken).totalSupply();
            uint xcnAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(xcnAccrued, supplyTokens) : Double({mantissa: 0});
            supplyState.index = safe224(add_(Double({mantissa: supplyState.index}), ratio).mantissa, "new index exceeds 224 bits");
            supplyState.block = blockNumber;
        } else if (deltaBlocks > 0) {
            supplyState.block = blockNumber;
        }
    }

    /**
     * @notice Accrue XCN to the market by updating the borrow index
     * @param oToken The market whose borrow index to update
     * @dev Index is a cumulative sum of the XCN per oToken accrued.
     */
    function updateXcnBorrowIndex(address oToken, Exp memory marketBorrowIndex) internal {
        XcnMarketState storage borrowState = xcnBorrowState[oToken];
        uint borrowSpeed = xcnBorrowSpeeds[oToken];
        uint32 blockNumber = safe32(getBlockNumber(), "block number exceeds 32 bits");
        uint deltaBlocks = sub_(uint(blockNumber), uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(OToken(oToken).totalBorrows(), marketBorrowIndex);
            uint xcnAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(xcnAccrued, borrowAmount) : Double({mantissa: 0});
            borrowState.index = safe224(add_(Double({mantissa: borrowState.index}), ratio).mantissa, "new index exceeds 224 bits");
            borrowState.block = blockNumber;
        } else if (deltaBlocks > 0) {
            borrowState.block = blockNumber;
        }
    }

    /**
     * @notice Calculate XCN accrued by a supplier and possibly transfer it to them
     * @param oToken The market in which the supplier is interacting
     * @param supplier The address of the supplier to distribute XCN to
     */
    function distributeSupplierXcn(address oToken, address supplier) internal {
        // TODO: Don't distribute supplier XCN if the user is not in the supplier market.
        // This check should be as gas efficient as possible as distributeSupplierXcn is called in many places.
        // - We really don't want to call an external contract as that's quite expensive.

        XcnMarketState storage supplyState = xcnSupplyState[oToken];
        uint supplyIndex = supplyState.index;
        uint supplierIndex = xcnSupplierIndex[oToken][supplier];

        // Update supplier's index to the current index since we are distributing accrued XCN
        xcnSupplierIndex[oToken][supplier] = supplyIndex;

        if (supplierIndex == 0 && supplyIndex >= xcnInitialIndex) {
            // Covers the case where users supplied tokens before the market's supply state index was set.
            // Rewards the user with XCN accrued from the start of when supplier rewards were first
            // set for the market.
            supplierIndex = xcnInitialIndex;
        }

        // Calculate change in the cumulative sum of the XCN per oToken accrued
        Double memory deltaIndex = Double({mantissa: sub_(supplyIndex, supplierIndex)});

        uint supplierTokens = OToken(oToken).balanceOf(supplier);

        // Calculate XCN accrued: oTokenAmount * accruedPerOToken
        uint supplierDelta = mul_(supplierTokens, deltaIndex);

        uint supplierAccrued = add_(xcnAccrued[supplier], supplierDelta);
        xcnAccrued[supplier] = supplierAccrued;

        emit DistributedSupplierXcn(OToken(oToken), supplier, supplierDelta, supplyIndex);
    }

    /**
     * @notice Calculate XCN accrued by a borrower and possibly transfer it to them
     * @dev Borrowers will not begin to accrue until after the first interaction with the protocol.
     * @param oToken The market in which the borrower is interacting
     * @param borrower The address of the borrower to distribute XCN to
     */
    function distributeBorrowerXcn(address oToken, address borrower, Exp memory marketBorrowIndex) internal {
        // TODO: Don't distribute supplier XCN if the user is not in the borrower market.
        // This check should be as gas efficient as possible as distributeBorrowerXcn is called in many places.
        // - We really don't want to call an external contract as that's quite expensive.

        XcnMarketState storage borrowState = xcnBorrowState[oToken];
        uint borrowIndex = borrowState.index;
        uint borrowerIndex = xcnBorrowerIndex[oToken][borrower];

        // Update borrowers's index to the current index since we are distributing accrued XCN
        xcnBorrowerIndex[oToken][borrower] = borrowIndex;

        if (borrowerIndex == 0 && borrowIndex >= xcnInitialIndex) {
            // Covers the case where users borrowed tokens before the market's borrow state index was set.
            // Rewards the user with XCN accrued from the start of when borrower rewards were first
            // set for the market.
            borrowerIndex = xcnInitialIndex;
        }

        // Calculate change in the cumulative sum of the XCN per borrowed unit accrued
        Double memory deltaIndex = Double({mantissa: sub_(borrowIndex, borrowerIndex)});

        uint borrowerAmount = div_(OToken(oToken).borrowBalanceStored(borrower), marketBorrowIndex);
        
        // Calculate XCN accrued: oTokenAmount * accruedPerBorrowedUnit
        uint borrowerDelta = mul_(borrowerAmount, deltaIndex);

        uint borrowerAccrued = add_(xcnAccrued[borrower], borrowerDelta);
        xcnAccrued[borrower] = borrowerAccrued;

        emit DistributedBorrowerXcn(OToken(oToken), borrower, borrowerDelta, borrowIndex);
    }

    /**
     * @notice Claim all the xcn accrued by holder in all markets
     * @param holder The address to claim XCN for
     */
    function claimXcn(address holder) public {
        return claimXcn(holder, allMarkets);
    }

    /**
     * @notice Claim all the xcn accrued by holder in the specified markets
     * @param holder The address to claim XCN for
     * @param oTokens The list of markets to claim XCN in
     */
    function claimXcn(address holder, OToken[] memory oTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimXcn(holders, oTokens, true, true);
    }

    /**
     * @notice Claim all xcn accrued by the holders
     * @param holders The addresses to claim XCN for
     * @param oTokens The list of markets to claim XCN in
     * @param borrowers Whether or not to claim XCN earned by borrowing
     * @param suppliers Whether or not to claim XCN earned by supplying
     */
    function claimXcn(address[] memory holders, OToken[] memory oTokens, bool borrowers, bool suppliers) public {
        for (uint i = 0; i < oTokens.length; i++) {
            OToken oToken = oTokens[i];
            require(markets[address(oToken)].isListed, "market must be listed");
            if (borrowers == true) {
                Exp memory borrowIndex = Exp({mantissa: oToken.borrowIndex()});
                updateXcnBorrowIndex(address(oToken), borrowIndex);
                for (uint j = 0; j < holders.length; j++) {
                    distributeBorrowerXcn(address(oToken), holders[j], borrowIndex);
                }
            }
            if (suppliers == true) {
                updateXcnSupplyIndex(address(oToken));
                for (uint j = 0; j < holders.length; j++) {
                    distributeSupplierXcn(address(oToken), holders[j]);
                }
            }
        }
        for (uint j = 0; j < holders.length; j++) {
            xcnAccrued[holders[j]] = grantXcnInternal(holders[j], xcnAccrued[holders[j]]);
        }
    }

    /**
     * @notice Transfer XCN to the user
     * @dev Note: If there is not enough XCN, we do not perform the transfer all.
     * @param user The address of the user to transfer XCN to
     * @param amount The amount of XCN to (possibly) transfer
     * @return The amount of XCN which was NOT transferred to the user
     */
    function grantXcnInternal(address user, uint amount) internal returns (uint) {
        Xcn xcn = Xcn(getXcnAddress());
        uint compRemaining = xcn.balanceOf(address(this));
        if (amount > 0 && amount <= compRemaining) {
            xcn.transfer(user, amount);
            return 0;
        }
        return amount;
    }

    /*** Xcn Distribution Admin ***/

    /**
     * @notice Transfer XCN to the recipient
     * @dev Note: If there is not enough XCN, we do not perform the transfer all.
     * @param recipient The address of the recipient to transfer XCN to
     * @param amount The amount of XCN to (possibly) transfer
     */
    function _grantXcn(address recipient, uint amount) public {
        require(adminOrInitializing(), "only admin can grant xcn");
        uint amountLeft = grantXcnInternal(recipient, amount);
        require(amountLeft == 0, "insufficient xcn for grant");
        emit XcnGranted(recipient, amount);
    }

    /**
     * @notice Set XCN borrow and supply speeds for the specified markets.
     * @param oTokens The markets whose XCN speed to update.
     * @param supplySpeeds New supply-side XCN speed for the corresponding market.
     * @param borrowSpeeds New borrow-side XCN speed for the corresponding market.
     */
    function _setXcnSpeeds(OToken[] memory oTokens, uint[] memory supplySpeeds, uint[] memory borrowSpeeds) public {
        require(adminOrInitializing(), "only admin can set xcn speed");

        uint numTokens = oTokens.length;
        require(numTokens == supplySpeeds.length && numTokens == borrowSpeeds.length, "Comptroller::_setXcnSpeeds invalid input");

        for (uint i = 0; i < numTokens; ++i) {
            setXcnSpeedInternal(oTokens[i], supplySpeeds[i], borrowSpeeds[i]);
        }
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (OToken[] memory) {
        return allMarkets;
    }

    /**
     * @notice Returns true if the given oToken market has been deprecated
     * @dev All borrows in a deprecated oToken market can be immediately liquidated
     * @param oToken The market to check if deprecated
     */
    function isDeprecated(OToken oToken) public view returns (bool) {
        return
            markets[address(oToken)].collateralFactorMantissa == 0 && 
            borrowGuardianPaused[address(oToken)] == true && 
            oToken.reserveFactorMantissa() == 1e18
        ;
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the XCN token
     * @return The address of XCN
     */
    function getXcnAddress() public view returns (address) {
        return 0xA2cd3D43c775978A96BdBf12d733D5A1ED94fb18;
    }

    /**
     * @notice Return the address of the liquidation proxy
     * @return The address of the liquidation proxy
     */
    function getLiquidationProxyAddress() public view returns (address) {
        return 0x323398DE3C35F96053D930d25FE8d92132F83d44;
    }

    function getLiquidationExtraRepayAmount() public view returns(uint) {
        // we use static address for liquidation proxy
        address liquidationProxy = getLiquidationProxyAddress();
        if(ILiquidationProxy(liquidationProxy).isNFTLiquidation()) {
            return ILiquidationProxy(liquidationProxy).extraRepayAmount();
        } else {
            return 0;
        }
    }

    function getLiquidationSeizeIndexes() public view returns(uint[] memory) {
        // we use static address for liquidation proxy
        address liquidationProxy = getLiquidationProxyAddress();
        if(ILiquidationProxy(liquidationProxy).isNFTLiquidation()) {
            return ILiquidationProxy(liquidationProxy).seizeIndexes();
        } else {
            uint[] memory seizeIndexes;
            return seizeIndexes;
        }
    }
}
