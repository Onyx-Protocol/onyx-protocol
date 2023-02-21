pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";
import "../../contracts/PriceOracle.sol";

contract ComptrollerKovan is Comptroller {
  function getXcnAddress() public view returns (address) {
    return 0x61460874a7196d6a22D1eE4922473664b3E95270;
  }
}

contract ComptrollerRopsten is Comptroller {
  function getXcnAddress() public view returns (address) {
    return 0xf76D4a441E4ba86A923ce32B89AFF89dBccAA075;
  }
}

contract ComptrollerHarness is Comptroller {
    address xcnAddress;
    uint public blockNumber;

    constructor() Comptroller() public {}

    function setPauseGuardian(address harnessedPauseGuardian) public {
        pauseGuardian = harnessedPauseGuardian;
    }

    function setXcnSupplyState(address oToken, uint224 index, uint32 blockNumber_) public {
        xcnSupplyState[oToken].index = index;
        xcnSupplyState[oToken].block = blockNumber_;
    }

    function setXcnBorrowState(address oToken, uint224 index, uint32 blockNumber_) public {
        xcnBorrowState[oToken].index = index;
        xcnBorrowState[oToken].block = blockNumber_;
    }

    function setXcnAccrued(address user, uint userAccrued) public {
        xcnAccrued[user] = userAccrued;
    }

    function setXcnAddress(address xcnAddress_) public {
        xcnAddress = xcnAddress_;
    }

    function getXcnAddress() public view returns (address) {
        return xcnAddress;
    }

    /**
     * @notice Set the amount of XCN distributed per block
     * @param xcnRate_ The amount of XCN wei per block to distribute
     */
    function harnessSetXcnRate(uint xcnRate_) public {
        xcnRate = xcnRate_;
    }

    /**
     * @notice Recalculate and update XCN speeds for all XCN markets
     */
    function harnessRefreshXcnSpeeds() public {
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

    function setXcnBorrowerIndex(address oToken, address borrower, uint index) public {
        xcnBorrowerIndex[oToken][borrower] = index;
    }

    function setXcnSupplierIndex(address oToken, address supplier, uint index) public {
        xcnSupplierIndex[oToken][supplier] = index;
    }

    function harnessDistributeAllBorrowerXcn(address oToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerXcn(oToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
        xcnAccrued[borrower] = grantXcnInternal(borrower, xcnAccrued[borrower]);
    }

    function harnessDistributeAllSupplierXcn(address oToken, address supplier) public {
        distributeSupplierXcn(oToken, supplier);
        xcnAccrued[supplier] = grantXcnInternal(supplier, xcnAccrued[supplier]);
    }

    function harnessUpdateXcnBorrowIndex(address oToken, uint marketBorrowIndexMantissa) public {
        updateXcnBorrowIndex(oToken, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessUpdateXcnSupplyIndex(address oToken) public {
        updateXcnSupplyIndex(oToken);
    }

    function harnessDistributeBorrowerXcn(address oToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerXcn(oToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessDistributeSupplierXcn(address oToken, address supplier) public {
        distributeSupplierXcn(oToken, supplier);
    }

    function harnessTransferXcn(address user, uint userAccrued, uint threshold) public returns (uint) {
        if (userAccrued > 0 && userAccrued >= threshold) {
            return grantXcnInternal(user, userAccrued);
        }
        return userAccrued;
    }

    function harnessAddXcnMarkets(address[] memory oTokens) public {
        for (uint i = 0; i < oTokens.length; i++) {
            // temporarily set xcnSpeed to 1 (will be fixed by `harnessRefreshXcnSpeeds`)
            setXcnSpeedInternal(OToken(oTokens[i]), 1, 1);
        }
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getXcnMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (xcnSupplySpeeds[address(allMarkets[i])] > 0 || xcnBorrowSpeeds[address(allMarkets[i])] > 0) {
                n++;
            }
        }

        address[] memory xcnMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (xcnSupplySpeeds[address(allMarkets[i])] > 0 || xcnBorrowSpeeds[address(allMarkets[i])] > 0) {
                xcnMarkets[k++] = address(allMarkets[i]);
            }
        }
        return xcnMarkets;
    }

    /**
     * @notice Return the address of the liquidation proxy
     * @return The address of the liquidation proxy
     */
    function getLiquidationProxyAddress() public view returns (address) {
        return 0x737BCfA44a73D85Db314cF9805A46F961de36437;
    }

    function getLiquidationExtraRepayAmount() public view returns(uint) {
        return 0;
    }

    function getLiquidationSeizeIndexes() public view returns(uint[] memory) {
        uint[] memory seizeIndexes;
        return seizeIndexes;
    }
}

contract ComptrollerBorked {
    function _become(Unitroller unitroller, PriceOracle _oracle, uint _closeFactorMantissa, uint _maxAssets, bool _reinitializing) public {
        _oracle;
        _closeFactorMantissa;
        _maxAssets;
        _reinitializing;

        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        unitroller._acceptImplementation();
    }
}

contract BoolComptroller is ComptrollerInterface {
    bool allowMint = true;
    bool allowRedeem = true;
    bool allowBorrow = true;
    bool allowRepayBorrow = true;
    bool allowLiquidateBorrow = true;
    bool allowSeize = true;
    bool allowTransfer = true;

    bool verifyMint = true;
    bool verifyRedeem = true;
    bool verifyBorrow = true;
    bool verifyRepayBorrow = true;
    bool verifyLiquidateBorrow = true;
    bool verifySeize = true;
    bool verifyTransfer = true;

    bool failCalculateSeizeTokens;
    uint calculatedSeizeTokens;

    uint noError = 0;
    uint opaqueError = noError + 11; // an arbitrary, opaque error code

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata _oTokens) external returns (uint[] memory) {
        _oTokens;
        uint[] memory ret;
        return ret;
    }

    function exitMarket(address _oToken) external returns (uint) {
        _oToken;
        return noError;
    }

    /*** Policy Hooks ***/

    function mintAllowed(address _oToken, address _minter, uint _mintAmount) public returns (uint) {
        _oToken;
        _minter;
        _mintAmount;
        return allowMint ? noError : opaqueError;
    }

    function mintVerify(address _oToken, address _minter, uint _mintAmount, uint _mintTokens) external {
        _oToken;
        _minter;
        _mintAmount;
        _mintTokens;
        require(verifyMint, "mintVerify rejected mint");
    }

    function redeemAllowed(address _oToken, address _redeemer, uint _redeemTokens) public returns (uint) {
        _oToken;
        _redeemer;
        _redeemTokens;
        return allowRedeem ? noError : opaqueError;
    }

    function redeemVerify(address _oToken, address _redeemer, uint _redeemAmount, uint _redeemTokens) external {
        _oToken;
        _redeemer;
        _redeemAmount;
        _redeemTokens;
        require(verifyRedeem, "redeemVerify rejected redeem");
    }

    function borrowAllowed(address _oToken, address _borrower, uint _borrowAmount) public returns (uint) {
        _oToken;
        _borrower;
        _borrowAmount;
        return allowBorrow ? noError : opaqueError;
    }

    function borrowVerify(address _oToken, address _borrower, uint _borrowAmount) external {
        _oToken;
        _borrower;
        _borrowAmount;
        require(verifyBorrow, "borrowVerify rejected borrow");
    }

    function repayBorrowAllowed(
        address _oToken,
        address _payer,
        address _borrower,
        uint _repayAmount) public returns (uint) {
        _oToken;
        _payer;
        _borrower;
        _repayAmount;
        return allowRepayBorrow ? noError : opaqueError;
    }

    function repayBorrowVerify(
        address _oToken,
        address _payer,
        address _borrower,
        uint _repayAmount,
        uint _borrowerIndex) external {
        _oToken;
        _payer;
        _borrower;
        _repayAmount;
        _borrowerIndex;
        require(verifyRepayBorrow, "repayBorrowVerify rejected repayBorrow");
    }

    function liquidateBorrowAllowed(
        address _oTokenBorrowed,
        address _oTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount) public returns (uint) {
        _oTokenBorrowed;
        _oTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        return allowLiquidateBorrow ? noError : opaqueError;
    }

    function liquidateBorrowVerify(
        address _oTokenBorrowed,
        address _oTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount,
        uint _seizeTokens) external {
        _oTokenBorrowed;
        _oTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        _seizeTokens;
        require(verifyLiquidateBorrow, "liquidateBorrowVerify rejected liquidateBorrow");
    }

    function seizeAllowed(
        address _oTokenCollateral,
        address _oTokenBorrowed,
        address _borrower,
        address _liquidator,
        uint _seizeTokens) public returns (uint) {
        _oTokenCollateral;
        _oTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        return allowSeize ? noError : opaqueError;
    }

    function seizeVerify(
        address _oTokenCollateral,
        address _oTokenBorrowed,
        address _liquidator,
        address _borrower,
        uint _seizeTokens) external {
        _oTokenCollateral;
        _oTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        require(verifySeize, "seizeVerify rejected seize");
    }

    function transferAllowed(
        address _oToken,
        address _src,
        address _dst,
        uint _transferTokens) public returns (uint) {
        _oToken;
        _src;
        _dst;
        _transferTokens;
        return allowTransfer ? noError : opaqueError;
    }

    function transferVerify(
        address _oToken,
        address _src,
        address _dst,
        uint _transferTokens) external {
        _oToken;
        _src;
        _dst;
        _transferTokens;
        require(verifyTransfer, "transferVerify rejected transfer");
    }

    /*** Special Liquidation Calculation ***/

    function liquidateCalculateSeizeTokens(
        address _oTokenBorrowed,
        address _oTokenCollateral,
        uint _repayAmount) public view returns (uint, uint) {
        _oTokenBorrowed;
        _oTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0) : (noError, calculatedSeizeTokens);
    }

    function liquidateCalculateSeizeTokensEx(
        address _oTokenBorrowed,
        address _oTokenCollateral,
        uint _repayAmount) public view returns (uint, uint, uint) {
        _oTokenBorrowed;
        _oTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0, 0) : (noError, calculatedSeizeTokens, _repayAmount);
    }

    /**** Mock Settors ****/

    /*** Policy Hooks ***/

    function setMintAllowed(bool allowMint_) public {
        allowMint = allowMint_;
    }

    function setMintVerify(bool verifyMint_) public {
        verifyMint = verifyMint_;
    }

    function setRedeemAllowed(bool allowRedeem_) public {
        allowRedeem = allowRedeem_;
    }

    function setRedeemVerify(bool verifyRedeem_) public {
        verifyRedeem = verifyRedeem_;
    }

    function setBorrowAllowed(bool allowBorrow_) public {
        allowBorrow = allowBorrow_;
    }

    function setBorrowVerify(bool verifyBorrow_) public {
        verifyBorrow = verifyBorrow_;
    }

    function setRepayBorrowAllowed(bool allowRepayBorrow_) public {
        allowRepayBorrow = allowRepayBorrow_;
    }

    function setRepayBorrowVerify(bool verifyRepayBorrow_) public {
        verifyRepayBorrow = verifyRepayBorrow_;
    }

    function setLiquidateBorrowAllowed(bool allowLiquidateBorrow_) public {
        allowLiquidateBorrow = allowLiquidateBorrow_;
    }

    function setLiquidateBorrowVerify(bool verifyLiquidateBorrow_) public {
        verifyLiquidateBorrow = verifyLiquidateBorrow_;
    }

    function setSeizeAllowed(bool allowSeize_) public {
        allowSeize = allowSeize_;
    }

    function setSeizeVerify(bool verifySeize_) public {
        verifySeize = verifySeize_;
    }

    function setTransferAllowed(bool allowTransfer_) public {
        allowTransfer = allowTransfer_;
    }

    function setTransferVerify(bool verifyTransfer_) public {
        verifyTransfer = verifyTransfer_;
    }

    /*** Liquidity/Liquidation Calculations ***/

    function setCalculatedSeizeTokens(uint seizeTokens_) public {
        calculatedSeizeTokens = seizeTokens_;
    }

    function setFailCalculateSeizeTokens(bool shouldFail) public {
        failCalculateSeizeTokens = shouldFail;
    }

    /**
     * @notice Return the address of the liquidation proxy
     * @return The address of the liquidation proxy
     */
    function getLiquidationProxyAddress() public view returns (address) {
        return 0x737BCfA44a73D85Db314cF9805A46F961de36437;
    }

    function getLiquidationExtraRepayAmount() public view returns(uint) {
        return 0;
    }

    function getLiquidationSeizeIndexes() public view returns(uint[] memory) {
        uint[] memory seizeIndexes;
        return seizeIndexes;
    }
}

contract EchoTypesComptroller is UnitrollerAdminStorage {
    function stringy(string memory s) public pure returns(string memory) {
        return s;
    }

    function addresses(address a) public pure returns(address) {
        return a;
    }

    function booly(bool b) public pure returns(bool) {
        return b;
    }

    function listOInts(uint[] memory u) public pure returns(uint[] memory) {
        return u;
    }

    function reverty() public pure {
        require(false, "gotcha sucka");
    }

    function becomeBrains(address payable unitroller) public {
        Unitroller(unitroller)._acceptImplementation();
    }
}
