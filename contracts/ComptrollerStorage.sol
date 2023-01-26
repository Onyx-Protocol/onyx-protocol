pragma solidity ^0.5.16;

import "./OToken.sol";
import "./PriceOracle.sol";

contract UnitrollerAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of Unitroller
    */
    address public comptrollerImplementation;

    /**
    * @notice Pending brains of Unitroller
    */
    address public pendingComptrollerImplementation;
}

contract ComptrollerV1Storage is UnitrollerAdminStorage {

    /**
     * @notice Oracle which gives the price of any given asset
     */
    PriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => OToken[]) public accountAssets;

}

contract ComptrollerV2Storage is ComptrollerV1Storage {
    struct Market {
        /// @notice Whether or not this market is listed
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /// @notice Per-market mapping of "accounts in this asset"
        mapping(address => bool) accountMembership;

        /// @notice Whether or not this market receives XCN
        bool isXcned;
    }

    /**
     * @notice Official mapping of oTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;


    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;
}

contract ComptrollerV3Storage is ComptrollerV2Storage {
    struct XcnMarketState {
        /// @notice The market's last updated xcnBorrowIndex or xcnSupplyIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice A list of all markets
    OToken[] public allMarkets;

    /// @notice The rate at which the flywheel distributes XCN, per block
    uint public xcnRate;

    /// @notice The portion of xcnRate that each market currently receives
    mapping(address => uint) public xcnSpeeds;

    /// @notice The XCN market supply state for each market
    mapping(address => XcnMarketState) public xcnSupplyState;

    /// @notice The XCN market borrow state for each market
    mapping(address => XcnMarketState) public xcnBorrowState;

    /// @notice The XCN borrow index for each market for each supplier as of the last time they accrued XCN
    mapping(address => mapping(address => uint)) public xcnSupplierIndex;

    /// @notice The XCN borrow index for each market for each borrower as of the last time they accrued XCN
    mapping(address => mapping(address => uint)) public xcnBorrowerIndex;

    /// @notice The XCN accrued but not yet transferred to each user
    mapping(address => uint) public xcnAccrued;
}

contract ComptrollerV4Storage is ComptrollerV3Storage {
    // @notice The marketCapGuardian can set marketCaps to any number for any market.
    // Lowering the supply cap could disable supplying on the given market.
    // Lowering the borrow cap could disable borrowing on the given market.
    address public marketCapGuardian;
    
    // @notice Supply caps enforced by mintAllowed for each oToken address. Defaults to zero which corresponds to unlimited supplying.
    mapping(address => uint) public supplyCaps;

    // @notice Borrow caps enforced by borrowAllowed for each oToken address. Defaults to zero which corresponds to unlimited borrowing.
    mapping(address => uint) public borrowCaps;
}

contract ComptrollerV5Storage is ComptrollerV4Storage {
    /// @notice The rate at which xcn is distributed to the corresponding borrow market (per block)
    mapping(address => uint) public xcnBorrowSpeeds;

    /// @notice The rate at which xcn is distributed to the corresponding supply market (per block)
    mapping(address => uint) public xcnSupplySpeeds;
}
