pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG4.sol";

contract ComptrollerScenarioG4 is ComptrollerG4 {
    uint public blockNumber;
    address public xcnAddress;

    constructor() ComptrollerG4() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function membershipLength(OToken oToken) public view returns (uint) {
        return accountAssets[address(oToken)].length;
    }

    function unlist(OToken oToken) public {
        markets[address(oToken)].isListed = false;
    }
}
