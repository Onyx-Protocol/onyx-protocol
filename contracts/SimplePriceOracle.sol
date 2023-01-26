pragma solidity ^0.5.16;

import "./PriceOracle.sol";
import "./OErc20.sol";

contract SimplePriceOracle is PriceOracle {
    mapping(address => uint) prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);

    function _getUnderlyingAddress(OToken oToken) private view returns (address) {
        address asset;
        if (compareStrings(oToken.symbol(), "oETH")) {
            asset = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        } else {
            asset = address(OErc20(address(oToken)).underlying());
        }
        return asset;
    }

    function getUnderlyingPrice(OToken oToken) public view returns (uint) {
        return prices[_getUnderlyingAddress(oToken)];
    }

    function setUnderlyingPrice(OToken oToken, uint underlyingPriceMantissa) public {
        address asset = _getUnderlyingAddress(oToken);
        emit PricePosted(asset, prices[asset], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint price) public {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    // v1 price oracle interface for use as backing of proxy
    function assetPrices(address asset) external view returns (uint) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
