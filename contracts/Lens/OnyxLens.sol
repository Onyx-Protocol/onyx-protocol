pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../OErc20.sol";
import "../OErc721.sol";
import "../OToken.sol";
import "../PriceOracle.sol";
import "../EIP20Interface.sol";
import "../EIP721Interface.sol";
import "../XCNInterface.sol";
import "../SafeMath.sol";

interface ComptrollerLensInterface {

    function markets(address) external view returns (bool, uint);

    function oracle() external view returns (PriceOracle);

    function getAccountLiquidity(address) external view returns (uint, uint, uint);

    function getAssetsIn(address) external view returns (OToken[] memory);

    function claimXcn(address) external;

    function xcnAccrued(address) external view returns (uint);

    function xcnSupplySpeeds(address) external view returns (uint);

    function xcnBorrowSpeeds(address) external view returns (uint);

    function getAllMarkets() external view returns (OToken[] memory);

    function xcnSupplierIndex(address, address) external view returns (uint);

    function xcnInitialIndex() external view returns (uint224);

    function xcnBorrowerIndex(address, address) external view returns (uint);

    function xcnBorrowState(address) external view returns (uint224, uint32);

    function xcnSupplyState(address) external view returns (uint224, uint32);

    // function markets(address) external view returns (bool, uint);
    // function oracle() external view returns (PriceOracle);
    // function getAccountLiquidity(address) external view returns (uint, uint, uint);
    // function getAssetsIn(address) external view returns (OToken[] memory);
    // function claimXcn(address) external;
    // function xcnAccrued(address) external view returns (uint);
    function xcnSpeeds(address) external view returns (uint);
    // function xcnSupplySpeeds(address) external view returns (uint);
    // function xcnBorrowSpeeds(address) external view returns (uint);
    function borrowCaps(address) external view returns (uint);
}

interface GovernorBravoInterface {
    struct Receipt {
        bool hasVoted;
        uint8 support;
        uint96 votes;
    }
    struct Proposal {
        uint id;
        address proposer;
        uint eta;
        uint startBlock;
        uint endBlock;
        uint forVotes;
        uint againstVotes;
        uint abstainVotes;
        bool canceled;
        bool executed;
    }
    function getActions(uint proposalId) external view returns (address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas);
    function proposals(uint proposalId) external view returns (Proposal memory);
    function getReceipt(uint proposalId, address voter) external view returns (Receipt memory);
}

contract OnyxLens is ExponentialNoError {
    using SafeMath for uint;

    /// @notice Blocks Per Day
    uint public constant BLOCKS_PER_DAY = 24 * 60 * 60 / 15;

    struct OTokenMetadata {
        address oToken;
        uint exchangeRateCurrent;
        uint supplyRatePerBlock;
        uint borrowRatePerBlock;
        uint reserveFactorMantissa;
        uint totalBorrows;
        uint totalReserves;
        uint totalSupply;
        uint totalCash;
        bool isListed;
        uint collateralFactorMantissa;
        address underlyingAssetAddress;
        uint oTokenDecimals;
        uint underlyingDecimals;
        uint xcnSupplySpeed;
        uint xcnBorrowSpeed;
        uint borrowCap;
        uint dailySupplyXcn;
        uint dailyBorrowXcn;
    }

    function getXcnSpeeds(ComptrollerLensInterface comptroller, OToken oToken) internal returns (uint, uint) {
        // Getting xcn speeds is gnarly due to not every network having the
        // split xcn speeds from Proposal 62 and other networks don't even
        // have xcn speeds.
        uint xcnSupplySpeed = 0;
        (bool xcnSupplySpeedSuccess, bytes memory xcnSupplySpeedReturnData) =
            address(comptroller).call(
                abi.encodePacked(
                    comptroller.xcnSupplySpeeds.selector,
                    abi.encode(address(oToken))
                )
            );
        if (xcnSupplySpeedSuccess) {
            xcnSupplySpeed = abi.decode(xcnSupplySpeedReturnData, (uint));
        }

        uint xcnBorrowSpeed = 0;
        (bool xcnBorrowSpeedSuccess, bytes memory xcnBorrowSpeedReturnData) =
            address(comptroller).call(
                abi.encodePacked(
                    comptroller.xcnBorrowSpeeds.selector,
                    abi.encode(address(oToken))
                )
            );
        if (xcnBorrowSpeedSuccess) {
            xcnBorrowSpeed = abi.decode(xcnBorrowSpeedReturnData, (uint));
        }

        // If the split xcn speeds call doesn't work, try the  oldest non-spit version.
        if (!xcnSupplySpeedSuccess || !xcnBorrowSpeedSuccess) {
            (bool xcnSpeedSuccess, bytes memory xcnSpeedReturnData) =
            address(comptroller).call(
                abi.encodePacked(
                    comptroller.xcnSpeeds.selector,
                    abi.encode(address(oToken))
                )
            );
            if (xcnSpeedSuccess) {
                xcnSupplySpeed = xcnBorrowSpeed = abi.decode(xcnSpeedReturnData, (uint));
            }
        }
        return (xcnSupplySpeed, xcnBorrowSpeed);
    }

    function oTokenMetadata(OToken oToken) public returns (OTokenMetadata memory) {
        uint exchangeRateCurrent = oToken.exchangeRateCurrent();
        ComptrollerLensInterface comptroller = ComptrollerLensInterface(address(oToken.comptroller()));
        (bool isListed, uint collateralFactorMantissa) = comptroller.markets(address(oToken));
        // address underlyingAssetAddress;
        // uint underlyingDecimals;

        // if (compareStrings(oToken.symbol(), "oETH")) {
        //     underlyingAssetAddress = address(0);
        //     underlyingDecimals = 18;
        // } else {
        //     OErc20 oErc20 = OErc20(address(oToken));
        //     underlyingAssetAddress = oErc20.underlying();
        //     underlyingDecimals = EIP20Interface(oErc20.underlying()).decimals();
        // }

        (uint xcnSupplySpeed, uint xcnBorrowSpeed) = getXcnSpeeds(comptroller, oToken);

        uint borrowCap = 0;
        (bool borrowCapSuccess, bytes memory borrowCapReturnData) =
            address(comptroller).call(
                abi.encodePacked(
                    comptroller.borrowCaps.selector,
                    abi.encode(address(oToken))
                )
            );
        if (borrowCapSuccess) {
            borrowCap = abi.decode(borrowCapReturnData, (uint));
        }

        uint xcnSupplySpeedPerBlock = comptroller.xcnSupplySpeeds(address(oToken));
        uint xcnBorrowSpeedPerBlock = comptroller.xcnBorrowSpeeds(address(oToken));

        return OTokenMetadata({
            oToken: address(oToken),
            exchangeRateCurrent: exchangeRateCurrent,
            supplyRatePerBlock: oToken.supplyRatePerBlock(),
            borrowRatePerBlock: oToken.borrowRatePerBlock(),
            reserveFactorMantissa: oToken.reserveFactorMantissa(),
            totalBorrows: oToken.totalBorrows(),
            totalReserves: oToken.totalReserves(),
            totalSupply: oToken.totalSupply(),
            totalCash: oToken.getCash(),
            isListed: isListed,
            collateralFactorMantissa: collateralFactorMantissa,
            underlyingAssetAddress: compareStrings(oToken.symbol(), "oETH") ? address(0) : OErc20(address(oToken)).underlying(), //underlyingAssetAddress,
            oTokenDecimals: oToken.decimals(),
            underlyingDecimals: 
                compareStrings(oToken.symbol(), "oETH") 
                ? 18 
                : (EIP20Interface(address(oToken)).decimals() > 0 
                    ? EIP20Interface(OErc20(address(oToken)).underlying()).decimals() 
                    : 0
                ), //underlyingDecimals,
            xcnSupplySpeed: xcnSupplySpeed,
            xcnBorrowSpeed: xcnBorrowSpeed,
            borrowCap: borrowCap,
            dailySupplyXcn: xcnSupplySpeedPerBlock.mul(BLOCKS_PER_DAY),
            dailyBorrowXcn: xcnBorrowSpeedPerBlock.mul(BLOCKS_PER_DAY)
        });
    }

    function oTokenMetadataAll(OToken[] calldata oTokens) external returns (OTokenMetadata[] memory) {
        uint oTokenCount = oTokens.length;
        OTokenMetadata[] memory res = new OTokenMetadata[](oTokenCount);
        for (uint i = 0; i < oTokenCount; i++) {
            res[i] = oTokenMetadata(oTokens[i]);
        }
        return res;
    }

    struct OTokenBalances {
        address oToken;
        uint balanceOf;
        uint borrowBalanceCurrent;
        uint balanceOfUnderlying;
        uint tokenBalance;
        uint tokenAllowance;
    }

    function oTokenBalances(OToken oToken, address payable account) public returns (OTokenBalances memory) {
        uint balanceOf = oToken.balanceOf(account);
        uint borrowBalanceCurrent = oToken.borrowBalanceCurrent(account);
        uint balanceOfUnderlying = oToken.balanceOfUnderlying(account);
        uint tokenBalance;
        uint tokenAllowance;

        if (compareStrings(oToken.symbol(), "oETH")) {
            tokenBalance = account.balance;
            tokenAllowance = account.balance;
        } else {
            if (oToken.decimals() > 0) {
                OErc20 oErc20 = OErc20(address(oToken));
                EIP20Interface underlying = EIP20Interface(oErc20.underlying());
                tokenBalance = underlying.balanceOf(account);
                tokenAllowance = underlying.allowance(account, address(oToken));
            } else {
                OErc721 oErc721 = OErc721(address(oToken));
                EIP721Interface underlying = EIP721Interface(oErc721.underlying());
                tokenBalance = underlying.balanceOf(account);
                tokenAllowance = underlying.isApprovedForAll(account, address(oToken)) ? uint256(-1) : 0;
            }
        }

        return OTokenBalances({
            oToken: address(oToken),
            balanceOf: balanceOf,
            borrowBalanceCurrent: borrowBalanceCurrent,
            balanceOfUnderlying: balanceOfUnderlying,
            tokenBalance: tokenBalance,
            tokenAllowance: tokenAllowance
        });
    }

    struct OTokenUnderlyingPrice {
        address oToken;
        uint underlyingPrice;
    }

    function oTokenUnderlyingPrice(OToken oToken) public returns (OTokenUnderlyingPrice memory) {
        ComptrollerLensInterface comptroller = ComptrollerLensInterface(address(oToken.comptroller()));
        PriceOracle priceOracle = comptroller.oracle();

        return OTokenUnderlyingPrice({
            oToken: address(oToken),
            underlyingPrice: priceOracle.getUnderlyingPrice(oToken)
        });
    }

    function oTokenUnderlyingPriceAll(OToken[] calldata oTokens) external returns (OTokenUnderlyingPrice[] memory) {
        uint oTokenCount = oTokens.length;
        OTokenUnderlyingPrice[] memory res = new OTokenUnderlyingPrice[](oTokenCount);
        for (uint i = 0; i < oTokenCount; i++) {
            res[i] = oTokenUnderlyingPrice(oTokens[i]);
        }
        return res;
    }

    struct AccountLimits {
        OToken[] markets;
        uint liquidity;
        uint shortfall;
    }

    function getAccountLimits(ComptrollerLensInterface comptroller, address account) public returns (AccountLimits memory) {
        (uint errorCode, uint liquidity, uint shortfall) = comptroller.getAccountLiquidity(account);
        require(errorCode == 0);

        return AccountLimits({
            markets: comptroller.getAssetsIn(account),
            liquidity: liquidity,
            shortfall: shortfall
        });
    }

    struct GovReceipt {
        uint proposalId;
        bool hasVoted;
        bool support;
        uint96 votes;
    }

    // function getGovReceipts(GovernorAlpha governor, address voter, uint[] memory proposalIds) public view returns (GovReceipt[] memory) {
    //     uint proposalCount = proposalIds.length;
    //     GovReceipt[] memory res = new GovReceipt[](proposalCount);
    //     for (uint i = 0; i < proposalCount; i++) {
    //         GovernorAlpha.Receipt memory receipt = governor.getReceipt(proposalIds[i], voter);
    //         res[i] = GovReceipt({
    //             proposalId: proposalIds[i],
    //             hasVoted: receipt.hasVoted,
    //             support: receipt.support,
    //             votes: receipt.votes
    //         });
    //     }
    //     return res;
    // }

    struct GovBravoReceipt {
        uint proposalId;
        bool hasVoted;
        uint8 support;
        uint96 votes;
    }

    function getGovBravoReceipts(GovernorBravoInterface governor, address voter, uint[] memory proposalIds) public view returns (GovBravoReceipt[] memory) {
        uint proposalCount = proposalIds.length;
        GovBravoReceipt[] memory res = new GovBravoReceipt[](proposalCount);
        for (uint i = 0; i < proposalCount; i++) {
            GovernorBravoInterface.Receipt memory receipt = governor.getReceipt(proposalIds[i], voter);
            res[i] = GovBravoReceipt({
                proposalId: proposalIds[i],
                hasVoted: receipt.hasVoted,
                support: receipt.support,
                votes: receipt.votes
            });
        }
        return res;
    }

    struct GovProposal {
        uint proposalId;
        address proposer;
        uint eta;
        address[] targets;
        uint[] values;
        string[] signatures;
        bytes[] calldatas;
        uint startBlock;
        uint endBlock;
        uint forVotes;
        uint againstVotes;
        bool canceled;
        bool executed;
    }

    // function setProposal(GovProposal memory res, GovernorAlpha governor, uint proposalId) internal view {
    //     (
    //         ,
    //         address proposer,
    //         uint eta,
    //         uint startBlock,
    //         uint endBlock,
    //         uint forVotes,
    //         uint againstVotes,
    //         bool canceled,
    //         bool executed
    //     ) = governor.proposals(proposalId);
    //     res.proposalId = proposalId;
    //     res.proposer = proposer;
    //     res.eta = eta;
    //     res.startBlock = startBlock;
    //     res.endBlock = endBlock;
    //     res.forVotes = forVotes;
    //     res.againstVotes = againstVotes;
    //     res.canceled = canceled;
    //     res.executed = executed;
    // }

    // function getGovProposals(GovernorAlpha governor, uint[] calldata proposalIds) external view returns (GovProposal[] memory) {
    //     GovProposal[] memory res = new GovProposal[](proposalIds.length);
    //     for (uint i = 0; i < proposalIds.length; i++) {
    //         (
    //             address[] memory targets,
    //             uint[] memory values,
    //             string[] memory signatures,
    //             bytes[] memory calldatas
    //         ) = governor.getActions(proposalIds[i]);
    //         res[i] = GovProposal({
    //             proposalId: 0,
    //             proposer: address(0),
    //             eta: 0,
    //             targets: targets,
    //             values: values,
    //             signatures: signatures,
    //             calldatas: calldatas,
    //             startBlock: 0,
    //             endBlock: 0,
    //             forVotes: 0,
    //             againstVotes: 0,
    //             canceled: false,
    //             executed: false
    //         });
    //         setProposal(res[i], governor, proposalIds[i]);
    //     }
    //     return res;
    // }

    struct GovBravoProposal {
        uint proposalId;
        address proposer;
        uint eta;
        address[] targets;
        uint[] values;
        string[] signatures;
        bytes[] calldatas;
        uint startBlock;
        uint endBlock;
        uint forVotes;
        uint againstVotes;
        uint abstainVotes;
        bool canceled;
        bool executed;
    }

    function setBravoProposal(GovBravoProposal memory res, GovernorBravoInterface governor, uint proposalId) internal view {
        GovernorBravoInterface.Proposal memory p = governor.proposals(proposalId);

        res.proposalId = proposalId;
        res.proposer = p.proposer;
        res.eta = p.eta;
        res.startBlock = p.startBlock;
        res.endBlock = p.endBlock;
        res.forVotes = p.forVotes;
        res.againstVotes = p.againstVotes;
        res.abstainVotes = p.abstainVotes;
        res.canceled = p.canceled;
        res.executed = p.executed;
    }

    function getGovBravoProposals(GovernorBravoInterface governor, uint[] calldata proposalIds) external view returns (GovBravoProposal[] memory) {
        GovBravoProposal[] memory res = new GovBravoProposal[](proposalIds.length);
        for (uint i = 0; i < proposalIds.length; i++) {
            (
                address[] memory targets,
                uint[] memory values,
                string[] memory signatures,
                bytes[] memory calldatas
            ) = governor.getActions(proposalIds[i]);
            res[i] = GovBravoProposal({
                proposalId: 0,
                proposer: address(0),
                eta: 0,
                targets: targets,
                values: values,
                signatures: signatures,
                calldatas: calldatas,
                startBlock: 0,
                endBlock: 0,
                forVotes: 0,
                againstVotes: 0,
                abstainVotes: 0,
                canceled: false,
                executed: false
            });
            setBravoProposal(res[i], governor, proposalIds[i]);
        }
        return res;
    }

    struct XcnBalanceMetadata {
        uint balance;
        uint votes;
        address delegate;
    }

    function getXcnBalanceMetadata(Xcn xcn, address account) external view returns (XcnBalanceMetadata memory) {
        return XcnBalanceMetadata({
            balance: xcn.balanceOf(account),
            votes: uint256(xcn.getCurrentVotes(account)),
            delegate: xcn.delegates(account)
        });
    }

    struct XcnBalanceMetadataExt {
        uint balance;
        uint votes;
        address delegate;
        uint allocated;
    }

    function getXcnBalanceMetadataExt(Xcn xcn, ComptrollerLensInterface comptroller, address account) external returns (XcnBalanceMetadataExt memory) {
        uint balance = xcn.balanceOf(account);
        comptroller.claimXcn(account);
        uint newBalance = xcn.balanceOf(account);
        uint accrued = comptroller.xcnAccrued(account);
        uint total = add(accrued, newBalance, "sum xcn total");
        uint allocated = sub(total, balance, "sub allocated");

        return XcnBalanceMetadataExt({
            balance: balance,
            votes: uint256(xcn.getCurrentVotes(account)),
            delegate: xcn.delegates(account),
            allocated: allocated
        });
    }

    struct XcnVotes {
        uint blockNumber;
        uint votes;
    }

    function getXcnVotes(Xcn xcn, address account, uint32[] calldata blockNumbers) external view returns (XcnVotes[] memory) {
        XcnVotes[] memory res = new XcnVotes[](blockNumbers.length);
        for (uint i = 0; i < blockNumbers.length; i++) {
            res[i] = XcnVotes({
                blockNumber: uint256(blockNumbers[i]),
                votes: uint256(xcn.getPriorVotes(account, blockNumbers[i]))
            });
        }
        return res;
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function add(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        uint c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        require(b <= a, errorMessage);
        uint c = a - b;
        return c;
    }

    /**
     * @notice Get amount of XCN distributed daily to an account
     * @param account Address of account to fetch the daily XCN distribution
     * @param comptrollerAddress Address of the comptroller proxy
     * @return Amount of XCN distributed daily to an account
     */
    function getDailyXCN(address payable account, address comptrollerAddress) external returns (uint) {
        ComptrollerLensInterface comptrollerInstance = ComptrollerLensInterface(comptrollerAddress);
        OToken[] memory oTokens = comptrollerInstance.getAllMarkets();
        uint dailyXcnPerAccount = 0;

        for (uint i = 0; i < oTokens.length; i++) {
            OToken oToken = oTokens[i];
            // valid oTokens
            {
                OTokenMetadata memory metaDataItem = oTokenMetadata(oToken);

                //get balanceOfUnderlying and borrowBalanceCurrent from oTokenBalance
                OTokenBalances memory oTokenBalanceInfo = oTokenBalances(oToken, account);

                OTokenUnderlyingPrice memory underlyingPriceResponse = oTokenUnderlyingPrice(oToken);
                uint underlyingPrice = underlyingPriceResponse.underlyingPrice;
                Exp memory underlyingPriceMantissa = Exp({ mantissa: underlyingPrice });

                //get dailyXcnSupplyMarket
                uint dailyXcnSupplyMarket = 0;
                uint supplyInUsd = mul_ScalarTruncate(underlyingPriceMantissa, oTokenBalanceInfo.balanceOfUnderlying);
                uint marketTotalSupply = (metaDataItem.totalSupply.mul(metaDataItem.exchangeRateCurrent)).div(1e18);
                uint marketTotalSupplyInUsd = mul_ScalarTruncate(underlyingPriceMantissa, marketTotalSupply);

                if (marketTotalSupplyInUsd > 0) {
                    dailyXcnSupplyMarket = (metaDataItem.dailySupplyXcn.mul(supplyInUsd)).div(marketTotalSupplyInUsd);
                }

                //get dailyXcnBorrowMarket
                uint dailyXcnBorrowMarket = 0;
                uint borrowsInUsd = mul_ScalarTruncate(underlyingPriceMantissa, oTokenBalanceInfo.borrowBalanceCurrent);
                uint marketTotalBorrowsInUsd = mul_ScalarTruncate(underlyingPriceMantissa, metaDataItem.totalBorrows);

                if (marketTotalBorrowsInUsd > 0) {
                    dailyXcnBorrowMarket = (metaDataItem.dailyBorrowXcn.mul(borrowsInUsd)).div(marketTotalBorrowsInUsd);
                }

                dailyXcnPerAccount += dailyXcnSupplyMarket + dailyXcnBorrowMarket;
            }
        }

        return dailyXcnPerAccount;
    }

    struct ClaimXcnLocalVariables {
        uint totalRewards;
        uint224 borrowIndex;
        uint32 borrowBlock;
        uint224 supplyIndex;
        uint32 supplyBlock;
    }

    struct XcnMarketState {
        uint224 index;
        uint32 block;
    }

    /**
     * @dev Queries the current supply to calculate rewards for an account
     * @param supplyState XcnMarketState struct
     * @param oToken Address of a oToken
     * @param comptroller Address of the comptroller proxy
     */
    function updateXcnSupplyIndex(
        XcnMarketState memory supplyState,
        address oToken,
        ComptrollerLensInterface comptroller
    ) internal view {
        uint supplySpeed = comptroller.xcnSupplySpeeds(oToken);
        uint blockNumber = block.number;
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = OToken(oToken).totalSupply();
            uint xcnAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(xcnAccrued, supplyTokens) : Double({ mantissa: 0 });
            Double memory index = add_(Double({ mantissa: supplyState.index }), ratio);
            supplyState.index = safe224(index.mantissa, "new index overflows");
            supplyState.block = safe32(blockNumber, "block number overflows");
        } else if (deltaBlocks > 0) {
            supplyState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @dev Queries the current borrow to calculate rewards for an account
     * @param borrowState XcnMarketState struct
     * @param oToken Address of a oToken
     * @param comptroller Address of the comptroller proxy
     */
    function updateXcnBorrowIndex(
        XcnMarketState memory borrowState,
        address oToken,
        Exp memory marketBorrowIndex,
        ComptrollerLensInterface comptroller
    ) internal view {
        uint borrowSpeed = comptroller.xcnBorrowSpeeds(oToken);
        uint blockNumber = block.number;
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(OToken(oToken).totalBorrows(), marketBorrowIndex);
            uint xcnAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(xcnAccrued, borrowAmount) : Double({ mantissa: 0 });
            Double memory index = add_(Double({ mantissa: borrowState.index }), ratio);
            borrowState.index = safe224(index.mantissa, "new index overflows");
            borrowState.block = safe32(blockNumber, "block number overflows");
        } else if (deltaBlocks > 0) {
            borrowState.block = safe32(blockNumber, "block number overflows");
        }
    }

    /**
     * @dev Calculate available rewards for an account's supply
     * @param supplyState XcnMarketState struct
     * @param oToken Address of a oToken
     * @param supplier Address of the account supplying
     * @param comptroller Address of the comptroller proxy
     * @return Undistributed earned XCN from supplies
     */
    function distributeSupplierXcn(
        XcnMarketState memory supplyState,
        address oToken,
        address supplier,
        ComptrollerLensInterface comptroller
    ) internal view returns (uint) {
        Double memory supplyIndex = Double({ mantissa: supplyState.index });
        Double memory supplierIndex = Double({ mantissa: comptroller.xcnSupplierIndex(oToken, supplier) });
        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = comptroller.xcnInitialIndex();
        }

        Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
        uint supplierTokens = OToken(oToken).balanceOf(supplier);
        uint supplierDelta = mul_(supplierTokens, deltaIndex);
        return supplierDelta;
    }

    /**
     * @dev Calculate available rewards for an account's borrows
     * @param borrowState XcnMarketState struct
     * @param oToken Address of a oToken
     * @param borrower Address of the account borrowing
     * @param marketBorrowIndex oToken Borrow index
     * @param comptroller Address of the comptroller proxy
     * @return Undistributed earned XCN from borrows
     */
    function distributeBorrowerXcn(
        XcnMarketState memory borrowState,
        address oToken,
        address borrower,
        Exp memory marketBorrowIndex,
        ComptrollerLensInterface comptroller
    ) internal view returns (uint) {
        Double memory borrowIndex = Double({ mantissa: borrowState.index });
        Double memory borrowerIndex = Double({ mantissa: comptroller.xcnBorrowerIndex(oToken, borrower) });
        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(OToken(oToken).borrowBalanceStored(borrower), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            return borrowerDelta;
        }
        return 0;
    }

    /**
     * @notice Calculate the total XCN tokens pending or accrued by a user account
     * @param holder Account to query pending XCN
     * @param comptroller Address of the comptroller
     * @return Total number of accrued XCN that can be claimed
     */
    function pendingXcn(address holder, ComptrollerLensInterface comptroller) external view returns (uint) {
        OToken[] memory oTokens = comptroller.getAllMarkets();
        ClaimXcnLocalVariables memory vars;
        for (uint i = 0; i < oTokens.length; i++) {
            (vars.borrowIndex, vars.borrowBlock) = comptroller.xcnBorrowState(address(oTokens[i]));
            XcnMarketState memory borrowState = XcnMarketState({
                index: vars.borrowIndex,
                block: vars.borrowBlock
            });

            (vars.supplyIndex, vars.supplyBlock) = comptroller.xcnSupplyState(address(oTokens[i]));
            XcnMarketState memory supplyState = XcnMarketState({
                index: vars.supplyIndex,
                block: vars.supplyBlock
            });

            Exp memory borrowIndex = Exp({ mantissa: oTokens[i].borrowIndex() });
            updateXcnBorrowIndex(borrowState, address(oTokens[i]), borrowIndex, comptroller);
            uint reward = distributeBorrowerXcn(borrowState, address(oTokens[i]), holder, borrowIndex, comptroller);
            vars.totalRewards = add_(vars.totalRewards, reward);

            updateXcnSupplyIndex(supplyState, address(oTokens[i]), comptroller);
            reward = distributeSupplierXcn(supplyState, address(oTokens[i]), holder, comptroller);
            vars.totalRewards = add_(vars.totalRewards, reward);
        }
        return add_(comptroller.xcnAccrued(holder), vars.totalRewards);
    }

    /**
     * @notice Get the current oToken balances (outstanding borrows) for all oTokens on an account
     * @param oTokens Addresses of the tokens to check the balance of
     * @param account Account address to fetch the balance of
     * @return OTokenBalances Array with token balance information
     */
    function oTokenBalancesAll(
        OToken[] calldata oTokens,
        address payable account
    ) external returns (OTokenBalances[] memory) {
        uint oTokenCount = oTokens.length;
        OTokenBalances[] memory res = new OTokenBalances[](oTokenCount);
        for (uint i = 0; i < oTokenCount; i++) {
            res[i] = oTokenBalances(oTokens[i], account);
        }
        return res;
    }

}
