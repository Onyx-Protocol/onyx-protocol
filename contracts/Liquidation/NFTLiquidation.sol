// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./NFTLiquidationInterface.sol";
import "./NFTLiquidationStorage.sol";
import "./NFTLiquidationProxy.sol";
import "./SafeMath.sol";
import "./IERC20.sol";
import "./IERC721.sol";
import "./IComptroller.sol";
import "./IOToken.sol";
import "./IOracle.sol";

/**
 * @title Onyx's NFT Liquidation Proxy Contract
 * @author Onyx
 */
contract NFTLiquidation is NFTLiquidationV1Storage, NFTLiquidationInterface {
    using SafeMath for uint256;

    /// @notice Emitted when an admin set comptroller
    event NewComptroller(address oldComptroller, address newComptroller);

    /// @notice Emitted when an admin set the oether address
    event NewOEther(address oEther);

    /// @notice Emitted when an admin set the protocol fee recipient
    event NewProtocolFeeRecipient(address _protocolFeeRecipient);

    /// @notice Emitted when an admin set the protocol fee
    event NewProtocolFeeMantissa(uint256 _protocolFeeMantissa);

    /// @notice Emitted when emergency withdraw the underlying asset
    event EmergencyWithdraw(address to, address underlying, uint256 amount);

    /// @notice Emitted when emergency withdraw the NFT
    event EmergencyWithdrawNFT(address to, address underlying, uint256 tokenId);

    constructor() public {}

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin may call");
        _;
    }

    /*** Reentrancy Guard ***/

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        require(_notEntered, "re-entered");
        _notEntered = false;
        _;
        _notEntered = true; // get a gas-refund post-Istanbul
    }

    /*** Liquidator functions ***/

    /**
     * @notice Execute the proxy liquidation with single token repay
     */
    function liquidateWithSingleRepay(address payable borrower, address oTokenCollateral, address oTokenRepay, uint256 repayAmount) external payable nonReentrant {
        require(borrower != address(0), "invalid borrower address");

        (, , uint256 borrowerShortfall) = IComptroller(comptroller).getAccountLiquidity(borrower);
        require(borrowerShortfall > 0, "invalid borrower liquidity shortfall");
        liquidateWithSingleRepayFresh(borrower, oTokenCollateral, oTokenRepay, repayAmount);
        transferSeizedTokenFresh(oTokenCollateral, false);
    }

    /**
     * @notice Execute the proxy liquidation with single token repay and selected seize token value
     */
    function liquidateWithSingleRepayV2(address payable borrower, address oTokenCollateral, address oTokenRepay, uint256 repayAmount, uint256[] calldata _seizeIndexes, bool claimOToken)
        external payable nonReentrant
    {
        require(borrower != address(0), "invalid borrower address");

        (, , uint256 borrowerShortfall) = IComptroller(comptroller).getAccountLiquidity(borrower);
        require(borrowerShortfall > 0, "invalid borrower liquidity shortfall");
        require(seizeIndexes_.length == 0, "invalid initial seize indexes");
        seizeIndexes_ = _seizeIndexes;
        liquidateWithSingleRepayFresh(borrower, oTokenCollateral, oTokenRepay, repayAmount);
        transferSeizedTokenFresh(oTokenCollateral, claimOToken);
    }

    function seizeIndexes() external view returns(uint256[] memory) {
        return seizeIndexes_;
    }

    function liquidateWithSingleRepayFresh(address payable borrower, address oTokenCollateral, address oTokenRepay, uint256 repayAmount) internal {
        require(extraRepayAmount == 0, "invalid initial extra repay amount");

        uint256 borrowedAmount = IOErc20(oTokenRepay).borrowBalanceCurrent(borrower);

        require(repayAmount >= borrowedAmount, "invalid token repay amount");
        extraRepayAmount = repayAmount.sub(borrowedAmount);

        if (oTokenRepay != oEther) {
            address underlying = IOErc20(oTokenRepay).underlying();

            IERC20(underlying).transferFrom(msg.sender, address(this), repayAmount);
            IERC20(underlying).approve(oTokenRepay, borrowedAmount);
            require(IOErc20(oTokenRepay).liquidateBorrow(borrower, borrowedAmount, oTokenCollateral) == 0, "liquidateBorrow failed");

            uint256 protocolFee = extraRepayAmount.mul(protocolFeeMantissa).div(1e18);
            uint256 remained = extraRepayAmount.sub(protocolFee);

            IERC20(underlying).approve(oTokenRepay, remained);
            require(IOErc20(oTokenRepay).mint(remained) == 0, "otoken mint failed");
            IERC20(oTokenRepay).transfer(borrower, IERC20(oTokenRepay).balanceOf(address(this)));

            IERC20(underlying).transfer(protocolFeeRecipient, protocolFee);
        } else {
            require(msg.value == repayAmount, "incorrect ether amount");

            IOEther(oTokenRepay).liquidateBorrow.value(borrowedAmount)(borrower, oTokenCollateral);

            uint256 protocolFee = extraRepayAmount.mul(protocolFeeMantissa).div(1e18);
            uint256 remained = extraRepayAmount.sub(protocolFee);

            // borrower.transfer(remained);
            IOEther(oTokenRepay).mint.value(remained)();
            IERC20(oTokenRepay).transfer(borrower, IERC20(oTokenRepay).balanceOf(address(this)));

            protocolFeeRecipient.transfer(protocolFee);
        }

        // we ensure that all borrow balances are repaid fully
        require(IOErc20(oTokenRepay).borrowBalanceCurrent(borrower) == 0, "invalid token borrow balance");

        extraRepayAmount = 0;
    }

    function transferSeizedTokenFresh(address oTokenCollateral, bool claimOToken) internal {
        uint256 seizedTokenAmount = IOErc721(oTokenCollateral).balanceOf(address(this));
        uint256 i;
        uint256 redeemTokenId;
        if (seizedTokenAmount > 0) {
            if (claimOToken) {
                for(; i < seizedTokenAmount; i++) {
                    IOErc721(oTokenCollateral).transfer(msg.sender, 0);
                }
            } else {
                IOErc721(oTokenCollateral).approve(oTokenCollateral, seizedTokenAmount);
                for(; i < seizedTokenAmount; i++) {
                    redeemTokenId = IOErc721(oTokenCollateral).userTokens(address(this), 0);
                    IOErc721(oTokenCollateral).redeem(0);
                    IERC721(IOErc721(oTokenCollateral).underlying()).transferFrom(address(this), msg.sender, redeemTokenId);
                }
            }
        }

        // we ensure that all seized tokens transfered and all borrow balances are repaid fully
        require(IOErc721(oTokenCollateral).balanceOf(address(this)) == 0, "failed transfer all seized tokens");
        require(IERC721(IOErc721(oTokenCollateral).underlying()).balanceOf(address(this)) == 0, "failed transfer all seized tokens");

        delete seizeIndexes_;
    }

    // /**
    //  * @notice Execute the proxy liquidation with multiple tokens repay
    //  */
    // function liquidateWithMutipleRepay(address payable borrower, address oTokenCollateral, address oTokenRepay1, uint256 repayAmount1, address oTokenRepay2, uint256 repayAmount2) external nonReentrant {
    //     require(borrower != address(0), "invalid borrower address");

    //     (, , uint256 borrowerShortfall) = IComptroller(comptroller).getAccountLiquidity(borrower);
    //     require(borrowerShortfall > 0, "invalid borrower liquidity shortfall");

    //     // we do accrue interest before liquidation to ensure that repay will be done with full amount
    //     uint error = IOErc20(oTokenRepay1).accrueInterest();
    //     require(error == 0, "repay token accure interest failed");

    //     error = IOErc20(oTokenRepay2).accrueInterest();
    //     require(error == 0, "repay token accure interest failed");

    //     error = IOErc721(oTokenCollateral).accrueInterest();
    //     require(error == 0, "collateral token accure interest failed");

    //     liquidateWithMutipleRepayFresh(borrower, oTokenCollateral, oTokenRepay1, repayAmount1, oTokenRepay2, repayAmount2);
    // }

    // function liquidateWithMutipleRepayFresh(address payable borrower, address oTokenCollateral, address oTokenRepay1, uint256 repayAmount1, address oTokenRepay2, uint256 repayAmount2) internal {
    //     require(extraRepayAmount == 0, "invalid initial extra repay amount");

    //     uint256 seizeTokenBeforeBalance = IOErc721(oTokenCollateral).balanceOf(address(this));

    //     uint256 borrowedAmount1 = IOErc20(oTokenRepay1).borrowBalanceCurrent(borrower);
    //     uint256 borrowedAmount2 = IOErc20(oTokenRepay2).borrowBalanceCurrent(borrower);

    //     require(repayAmount1 >= borrowedAmount1, "invalid token1 repay amount");
    //     require(repayAmount2 >= borrowedAmount2, "invalid token2 repay amount");
    //     extraRepayAmount = repayAmount1.sub(borrowedAmount1).add(getExchangedAmount(oTokenRepay2, oTokenRepay1, repayAmount2));

    //     if (oTokenRepay1 != oEther) {
    //         require(msg.value == repayAmount2, "incorrect ether amount");

    //         address underlying = IOErc20(oTokenRepay1).underlying();

    //         require(IOErc20(oTokenRepay1).liquidateBorrow(borrower, borrowedAmount1, oTokenCollateral) == 0, "liquidateBorrow failed");
    //         IOEther(oTokenRepay2).repayBorrowBehalf{value: borrowedAmount2}(borrower);

    //         uint256 protocolFee = extraRepayAmount.mul(protocolFeeMantissa).div(1e18);
    //         uint256 remained = extraRepayAmount.sub(protocolFee);
    //         IERC20(underlying).transferFrom(msg.sender, borrower, remained);
    //         IERC20(underlying).transferFrom(msg.sender, protocolFeeRecipient, protocolFee);
    //     } else {
    //         require(msg.value == repayAmount1, "incorrect ether amount");

    //         IOEther(oTokenRepay1).liquidateBorrow{value: borrowedAmount1}(borrower, oTokenCollateral);
    //         require(IOErc20(oTokenRepay2).repayBorrowBehalf(borrower, borrowedAmount2) == 0,  "repayBorrowBehalf failed");

    //         uint256 protocolFee = extraRepayAmount.mul(protocolFeeMantissa).div(1e18);
    //         uint256 remained = extraRepayAmount.sub(protocolFee);
    //         borrower.transfer(remained);
    //         protocolFeeRecipient.transfer(protocolFee);
    //     }

    //     uint256 seizeTokenAfterBalance = IOErc721(oTokenCollateral).balanceOf(address(this));
    //     uint256 seizedTokenAmount = seizeTokenAfterBalance.sub(seizeTokenBeforeBalance);

    //     // require(possibleSeizeTokens == seizedTokenAmount, "invalid seized amount");

    //     if (seizedTokenAmount > 0) {
    //         for(uint256 i; i < seizedTokenAmount; i++) {
    //             IOErc721(oTokenCollateral).transfer(msg.sender, 0);
    //         }
    //         require(IOErc721(oTokenCollateral).balanceOf(address(this)) == 0, "failed transfer all seized tokens");
    //     }

    //     // we ensure all borrow balances are repaid fully
    //     require(IOErc20(oTokenRepay1).borrowBalanceCurrent(borrower) == 0, "invalid token1 borrow balance");
    //     require(IOErc20(oTokenRepay2).borrowBalanceCurrent(borrower) == 0, "invalid token2 borrow balance");

    //     extraRepayAmount = 0;
    // }

    struct GetExtraRepayLocalVars {
        uint256 oTokenCollateralBalance;
        uint256 oTokenCollateralExchangeRateMantissa;
        uint256 oTokenCollateralAmount;
        uint256 collateralValue;
        uint256 repayValue;
    }

    function getSingleTokenExtraRepayAmount(address payable borrower, address oTokenCollateral, address oTokenRepay, uint256 repayAmount) public view returns(uint256) {
        uint256 liquidationIncentiveMantissa = IComptroller(comptroller).liquidationIncentiveMantissa();

        GetExtraRepayLocalVars memory vars;

        (, vars.oTokenCollateralBalance, , vars.oTokenCollateralExchangeRateMantissa) = IOErc721(oTokenCollateral).getAccountSnapshot(borrower);
        vars.oTokenCollateralAmount = vars.oTokenCollateralBalance.mul(1e18).div(vars.oTokenCollateralExchangeRateMantissa);

        vars.collateralValue = getOTokenUnderlyingValue(oTokenCollateral, vars.oTokenCollateralAmount);
        vars.repayValue = (getOTokenUnderlyingValue(oTokenRepay, repayAmount)).mul(liquidationIncentiveMantissa).div(1e18);

        return vars.collateralValue.sub(vars.repayValue).div(getUnderlyingPrice(oTokenRepay));
    }

    function getBaseTokenExtraRepayAmount(address payable borrower, address oTokenCollateral, address oTokenRepay1, uint256 repayAmount1, address oTokenRepay2, uint256 repayAmount2)
        public view returns(uint256)
    {
        uint256 liquidationIncentiveMantissa = IComptroller(comptroller).liquidationIncentiveMantissa();

        GetExtraRepayLocalVars memory vars;

        (, vars.oTokenCollateralBalance, , vars.oTokenCollateralExchangeRateMantissa) = IOErc721(oTokenCollateral).getAccountSnapshot(borrower);
        vars.oTokenCollateralAmount = vars.oTokenCollateralBalance.mul(1e18).div(vars.oTokenCollateralExchangeRateMantissa);

        vars.collateralValue = getOTokenUnderlyingValue(oTokenCollateral, vars.oTokenCollateralAmount);
        vars.repayValue = (getOTokenUnderlyingValue(oTokenRepay1, repayAmount1).add(getOTokenUnderlyingValue(oTokenRepay2, repayAmount2)))
                                    .mul(liquidationIncentiveMantissa).div(1e18);

        return vars.collateralValue.sub(vars.repayValue).div(getUnderlyingPrice(oTokenRepay1));
    }

    function getOTokenUnderlyingValue(address oToken, uint256 underlyingAmount) public view returns (uint256) {
        address oracle = IComptroller(comptroller).oracle();
        uint256 underlyingPrice = IOracle(oracle).getUnderlyingPrice(oToken);

        return underlyingPrice * underlyingAmount;
    }

    function getUnderlyingPrice(address oToken) public view returns (uint256) {
        address oracle = IComptroller(comptroller).oracle();
        return IOracle(oracle).getUnderlyingPrice(oToken);
    }

    function getExchangedAmount(address oToken1, address oToken2, uint256 token1Amount) public view returns (uint256) {
        uint256 token1Price = getUnderlyingPrice(oToken1);
        uint256 token2Price = getUnderlyingPrice(oToken2);
        return token1Amount.mul(token1Price).div(token2Price);
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /*** Admin functions ***/
    function initialize() onlyAdmin public {
        // The counter starts true to prevent changing it from zero to non-zero (i.e. smaller cost/refund)
        _notEntered = true;
    }

    function _become(NFTLiquidationProxy proxy) public {
        require(msg.sender == NFTLiquidationProxy(proxy).admin(), "only proxy admin can change brains");
        proxy._acceptImplementation();
    }

    function _setComptroller(address _comptroller) external onlyAdmin nonReentrant {
        require(_comptroller != address(0), "comptroller can not be zero");

        address oldComptroller = comptroller;
        comptroller = _comptroller;

        emit NewComptroller(oldComptroller, comptroller);
    }

    function setOEther(address _oEther) external onlyAdmin nonReentrant {
        require(_oEther != address(0), "invalid oToken address");
        require(IOEther(_oEther).isOToken() == true, "not oToken");

        oEther = _oEther;

        emit NewOEther(oEther);
    }

    function setProtocolFeeRecipient(address payable _protocolFeeRecipient) external onlyAdmin nonReentrant {
        require(_protocolFeeRecipient != address(0), "invalid recipient address");

        protocolFeeRecipient = _protocolFeeRecipient;

        emit NewProtocolFeeRecipient(protocolFeeRecipient);
    }

    function setProtocolFeeMantissa(uint256 _protocolFeeMantissa) external onlyAdmin nonReentrant {
        require(protocolFeeMantissa <= 1e18, "invalid fee");

        protocolFeeMantissa = _protocolFeeMantissa;

        emit NewProtocolFeeMantissa(protocolFeeMantissa);
    }

    /**
     * @notice Emergency withdraw the assets that the users have deposited
     * @param underlying The address of the underlying
     * @param withdrawAmount The amount of the underlying token to withdraw
     */
    function emergencyWithdraw(address underlying, uint256 withdrawAmount) external onlyAdmin nonReentrant {
        if (underlying == address(0)) {
            require(address(this).balance >= withdrawAmount);
            msg.sender.transfer(withdrawAmount);
        } else {
            require(IERC20(underlying).balanceOf(address(this)) >= withdrawAmount);
            IERC20(underlying).transfer(msg.sender, withdrawAmount);
        }

        emit EmergencyWithdraw(admin, underlying, withdrawAmount);
    }

    /**
     * @notice Emergency withdraw the NFTs
     * @param underlying The address of the underlying
     * @param tokenId The id of the underlying token to withdraw
     */
    function emergencyWithdrawNFT(address underlying, uint256 tokenId) external onlyAdmin nonReentrant {
        IERC721(underlying).transferFrom(address(this), msg.sender, tokenId);

        emit EmergencyWithdrawNFT(admin, underlying, tokenId);
    }

    /**
     * @notice payable function needed to receive ETH
     */
    function () external payable {
    }
}
