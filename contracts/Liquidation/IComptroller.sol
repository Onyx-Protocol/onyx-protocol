// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface IComptroller {
    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address) external view returns (uint, uint, uint);

    function oracle() external view returns (address);
    function liquidateCalculateSeizeTokensEx(address oTokenBorrowed, address oTokenExCollateral, uint repayAmount) external view returns (uint, uint, uint);
    
    function liquidationIncentiveMantissa() external view returns(uint256);
    function closeFactorMantissa() external view returns(uint256);
}
