// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "../SafeMath.sol";
import "./AggregatorV2V3Interface.sol";
import "./INFTOracle.sol";

contract NFTPriceAdapter {
    using SafeMath for uint256;

    AggregatorV2V3Interface public ETH_PRICE_FEED;
    INFTOracle public NFT_PRICE_ORACLE;
    address public NFT_CONTRACT;

    uint8 public constant DECIMALS = 18;

    constructor(address _ethPriceFeed, address _nftOracle, address _nftContract) public {
        ETH_PRICE_FEED = AggregatorV2V3Interface(_ethPriceFeed);
        NFT_PRICE_ORACLE = INFTOracle(_nftOracle);
        NFT_CONTRACT = _nftContract;
    }

    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        (, int256 ethPrice, , , ) = ETH_PRICE_FEED.latestRoundData();
        uint256 ethDecimals = uint256(ETH_PRICE_FEED.decimals());
        uint256 assetPrice = NFT_PRICE_ORACLE.getAssetPrice(NFT_CONTRACT);
        int256 price = int256(assetPrice.mul(uint256(ethPrice)).div(10 ** ethDecimals));

        return (
            1,
            price,
            block.timestamp,
            block.timestamp,
            1
        );
    }
}
