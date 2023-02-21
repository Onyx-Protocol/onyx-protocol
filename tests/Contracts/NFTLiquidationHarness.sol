// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../../../contracts/Liquidation/NFTLiquidation.sol";

/**
 * @title Onyx's NFT Liquidation Proxy Harness Contract
 * @author Onyx
 */
contract NFTLiquidationHarness is NFTLiquidation {
    function harnessSetComptroller(address _comptroller) external {
        comptroller = _comptroller;
    }

    function harnessSetOEther(address _oEther) external {
        oEther = _oEther;
    }

    function harnessSetProtocolFeeRecipient(address payable _protocolFeeRecipient) external {
        protocolFeeRecipient = _protocolFeeRecipient;
    }

    function harnessSetProtocolFeeMantissa(uint256 _protocolFeeMantissa) external {
        protocolFeeMantissa = _protocolFeeMantissa;
    }

}
