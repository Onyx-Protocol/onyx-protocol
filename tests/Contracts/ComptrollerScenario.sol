pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;
    address public xcnAddress;
    address public liquidationProxyAddress;

    constructor() Comptroller() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setXcnAddress(address xcnAddress_) public {
        xcnAddress = xcnAddress_;
    }

    function getXcnAddress() public view returns (address) {
        return xcnAddress;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function membershipLength(OToken oToken) public view returns (uint) {
        return accountAssets[address(oToken)].length;
    }

    function unlist(OToken oToken) public {
        markets[address(oToken)].isListed = false;
    }

    function setXcnBorrowerIndex(address oToken, address borrower, uint index) public {
        xcnBorrowerIndex[oToken][borrower] = index;
    }

    function setXcnSupplierIndex(address oToken, address supplier, uint index) public {
        xcnSupplierIndex[oToken][supplier] = index;
    }

    /**
     * @notice Recalculate and update XCN speeds for all XCN markets
     */
    function refreshXcnSpeeds() public {
        OToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            OToken oToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: oToken.borrowIndex()});
            updateXcnSupplyIndex(address(oToken));
            updateXcnBorrowIndex(address(oToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            OToken oToken = allMarkets_[i];
            if (xcnSupplySpeeds[address(oToken)] > 0 || xcnBorrowSpeeds[address(oToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(oToken)});
                Exp memory utility = mul_(assetPrice, oToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            OToken oToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(xcnRate, div_(utilities[i], totalUtility)) : 0;
            setXcnSpeedInternal(oToken, newSpeed, newSpeed);
        }
    }

    function getLiquidationProxyAddress() public view returns (address) {
        return liquidationProxyAddress;
    }

    function setLiquidationProxyAddress(address liquidationProxyAddress_) public {
        liquidationProxyAddress = liquidationProxyAddress_;
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
