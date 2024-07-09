// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

// Interface for BendDAO NFT Oracle
// https://etherscan.io/address/0x7c2a19e54e48718f6c60908a9cff3396e4ea1eba

interface INFTOracle {

    // get asset price
    function getAssetPrice(address _nftContract) external view returns (uint256);
}
