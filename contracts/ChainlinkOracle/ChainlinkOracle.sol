// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "../PriceOracle.sol";
import "../SafeMath.sol";
import "./AggregatorV2V3Interface.sol";
import "../EIP20Interface.sol";

interface IToken {
    function symbol() external view returns (string memory);

    function decimals() external view returns (uint256);
}

interface IOToken {
    function symbol() external view returns (string memory);

    function underlying() external view returns (address);
}

contract ChainlinkOracle {
    using SafeMath for uint256;
    address public admin;

    mapping(address => uint256) internal prices;
    mapping(bytes32 => AggregatorV2V3Interface) internal feeds;
    mapping(bytes32 => bool) internal isETHBases;
    event PricePosted(
        address asset,
        uint256 previousPriceMantissa,
        uint256 requestedPriceMantissa,
        uint256 newPriceMantissa
    );
    event NewAdmin(address oldAdmin, address newAdmin);
    event FeedSet(address feed, string symbol);

    constructor() public {
        admin = msg.sender;
    }

    function getUnderlyingPrice(OToken oToken) public view returns (uint) {
        string memory oSymbol = oToken.symbol();
        if (compareStrings(oSymbol, "oETH")) {
            return getChainlinkPrice(getFeed("ETH"));
        } else {
            return getPrice(oToken);
        }
    }

    function getPrice(OToken oToken) internal view returns (uint price) {
        EIP20Interface token = EIP20Interface(IOToken(address(oToken)).underlying());

        // we get price with decimal 18
        if (prices[address(token)] != 0) {
            // we assume price is set with decimal 18
            price = prices[address(token)];
        } else {
            price = getChainlinkPrice(getFeed(token.symbol()));

            if (getETHBase(token.symbol())) {
                AggregatorV2V3Interface baseFeed = getFeed("ETH");
                price = getChainlinkPrice(baseFeed).mul(price).div(1e18);
            }
        }

        if (oToken.decimals() == 0) {
            // we return nft price with 18 plus deciaml
            return price.mul(10 ** 18);
        } else {
            uint decimalDelta = uint(18).sub(uint(token.decimals()));
            // Ensure that we don't multiply the result by 0
            if (decimalDelta > 0) {
                return price.mul(10 ** decimalDelta);
            } else {
                return price;
            }
        }
    }

    function getChainlinkPrice(AggregatorV2V3Interface feed) 
        public
        view
        returns (uint256)
    {
        // Chainlink USD-denominated feeds store answers at 8 decimals
        uint decimalDelta = uint256(18).sub(feed.decimals());

        (, int256 answer, , , ) = feed.latestRoundData();

        if (decimalDelta > 0) {
            return uint(answer).mul(10 ** decimalDelta);
        } else {
            return uint(answer);
        }
    }

    function setUnderlyingPrice(address oToken, uint256 underlyingPriceMantissa)
        external
        onlyAdmin
    {
        address asset = IOToken(oToken).underlying();
        emit PricePosted(
            asset,
            prices[asset],
            underlyingPriceMantissa,
            underlyingPriceMantissa
        );
        prices[asset] = underlyingPriceMantissa;
    }

    function setDirectPrice(address asset, uint256 price) external onlyAdmin {
        emit PricePosted(asset, prices[asset], price, price);
        prices[asset] = price;
    }

    function setFeed(
        string calldata symbol,
        address feed,
        bool isETHBase
    ) external onlyAdmin {
        require(
            feed != address(0) && feed != address(this),
            "invalid feed address"
        );
        emit FeedSet(feed, symbol);
        feeds[keccak256(abi.encodePacked(symbol))] = AggregatorV2V3Interface(
            feed
        );
        isETHBases[keccak256(abi.encodePacked(symbol))] = isETHBase;
    }

    function getFeed(string memory symbol)
        public
        view
        returns (AggregatorV2V3Interface)
    {
        return feeds[keccak256(abi.encodePacked(symbol))];
    }

    function getETHBase(string memory symbol) public view returns (bool) {
        return isETHBases[keccak256(abi.encodePacked(symbol))];
    }

    function assetPrices(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function compareStrings(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        address oldAdmin = admin;
        admin = newAdmin;

        emit NewAdmin(oldAdmin, newAdmin);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin may call");
        _;
    }
}
