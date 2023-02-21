// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../../../contracts/Liquidation/NFTLiquidation.sol";

/**
 * @title Onyx's NFT Liquidation Proxy Harness Contract
 * @author Onyx
 */
contract NFTLiquidationScenario is NFTLiquidation {
    uint public blockNumber;
    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

}
