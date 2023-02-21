// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IOracle {
    function getUnderlyingPrice(address oToken) external view returns (uint256);
}
