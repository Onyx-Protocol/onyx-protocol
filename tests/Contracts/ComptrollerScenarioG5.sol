pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG5.sol";

contract ComptrollerScenarioG5 is ComptrollerG5 {
    uint public blockNumber;
    address public xcnAddress;

    constructor() ComptrollerG5() public {}

    function setXcnAddress(address xcnAddress_) public {
        xcnAddress = xcnAddress_;
    }

    function getXcnAddress() public view returns (address) {
        return xcnAddress;
    }

    function membershipLength(OToken oToken) public view returns (uint) {
        return accountAssets[address(oToken)].length;
    }

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

    function getXcnMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isXcned) {
                n++;
            }
        }

        address[] memory xcnMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isXcned) {
                xcnMarkets[k++] = address(allMarkets[i]);
            }
        }
        return xcnMarkets;
    }

    function unlist(OToken oToken) public {
        markets[address(oToken)].isListed = false;
    }
}
