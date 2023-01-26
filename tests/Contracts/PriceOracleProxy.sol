pragma solidity ^0.5.16;

import "../../contracts/OErc20.sol";
import "../../contracts/OToken.sol";
import "../../contracts/PriceOracle.sol";

interface V1PriceOracleInterface {
    function assetPrices(address asset) external view returns (uint);
}

contract PriceOracleProxy is PriceOracle {
    /// @notice Indicator that this is a PriceOracle contract (for inspection)
    bool public constant isPriceOracle = true;

    /// @notice The v1 price oracle, which will continue to serve prices for v1 assets
    V1PriceOracleInterface public v1PriceOracle;

    /// @notice Address of the guardian, which may set the SAI price once
    address public guardian;

    /// @notice Address of the oEther contract, which has a constant price
    address public oEthAddress;

    /// @notice Address of the oUSDC contract, which we hand pick a key for
    address public oUsdcAddress;

    /// @notice Address of the oUSDT contract, which uses the oUSDC price
    address public oUsdtAddress;

    /// @notice Address of the oSAI contract, which may have its price set
    address public oSaiAddress;

    /// @notice Address of the oDAI contract, which we hand pick a key for
    address public oDaiAddress;

    /// @notice Handpicked key for USDC
    address public constant usdcOracleKey = address(1);

    /// @notice Handpicked key for DAI
    address public constant daiOracleKey = address(2);

    /// @notice Frozen SAI price (or 0 if not set yet)
    uint public saiPrice;

    /**
     * @param guardian_ The address of the guardian, which may set the SAI price once
     * @param v1PriceOracle_ The address of the v1 price oracle, which will continue to operate and hold prices for collateral assets
     * @param oEthAddress_ The address of oETH, which will return a constant 1e18, since all prices relative to ether
     * @param oUsdcAddress_ The address of oUSDC, which will be read from a special oracle key
     * @param oSaiAddress_ The address of oSAI, which may be read directly from storage
     * @param oDaiAddress_ The address of oDAI, which will be read from a special oracle key
     * @param oUsdtAddress_ The address of oUSDT, which uses the oUSDC price
     */
    constructor(address guardian_,
                address v1PriceOracle_,
                address oEthAddress_,
                address oUsdcAddress_,
                address oSaiAddress_,
                address oDaiAddress_,
                address oUsdtAddress_) public {
        guardian = guardian_;
        v1PriceOracle = V1PriceOracleInterface(v1PriceOracle_);

        oEthAddress = oEthAddress_;
        oUsdcAddress = oUsdcAddress_;
        oSaiAddress = oSaiAddress_;
        oDaiAddress = oDaiAddress_;
        oUsdtAddress = oUsdtAddress_;
    }

    /**
     * @notice Get the underlying price of a listed oToken asset
     * @param oToken The oToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18)
     */
    function getUnderlyingPrice(OToken oToken) public view returns (uint) {
        address oTokenAddress = address(oToken);

        if (oTokenAddress == oEthAddress) {
            // ether always worth 1
            return 1e18;
        }

        if (oTokenAddress == oUsdcAddress || oTokenAddress == oUsdtAddress) {
            return v1PriceOracle.assetPrices(usdcOracleKey);
        }

        if (oTokenAddress == oDaiAddress) {
            return v1PriceOracle.assetPrices(daiOracleKey);
        }

        if (oTokenAddress == oSaiAddress) {
            // use the frozen SAI price if set, otherwise use the DAI price
            return saiPrice > 0 ? saiPrice : v1PriceOracle.assetPrices(daiOracleKey);
        }

        // otherwise just read from v1 oracle
        address underlying = OErc20(oTokenAddress).underlying();
        return v1PriceOracle.assetPrices(underlying);
    }

    /**
     * @notice Set the price of SAI, permanently
     * @param price The price for SAI
     */
    function setSaiPrice(uint price) public {
        require(msg.sender == guardian, "only guardian may set the SAI price");
        require(saiPrice == 0, "SAI price may only be set once");
        require(price < 0.1e18, "SAI price must be < 0.1 ETH");
        saiPrice = price;
    }
}
