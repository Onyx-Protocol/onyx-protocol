pragma solidity ^0.5.16;

import "./OEther.sol";

/**
 * @title Onyx's Maximillion Contract
 * @author Onyx
 */
contract Maximillion {
    /**
     * @notice The default oEther market to repay in
     */
    OEther public oEther;

    /**
     * @notice Construct a Maximillion to repay max in a OEther market
     */
    constructor(OEther oEther_) public {
        oEther = oEther_;
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in the oEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, oEther);
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in a oEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param oEther_ The address of the oEther contract to repay in
     */
    function repayBehalfExplicit(address borrower, OEther oEther_) public payable {
        uint received = msg.value;
        uint borrows = oEther_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            oEther_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            oEther_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
