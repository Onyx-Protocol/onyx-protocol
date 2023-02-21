pragma solidity ^0.5.16;

import "../../contracts/OErc721Immutable.sol";
import "../../contracts/OErc721Delegator.sol";
import "../../contracts/OErc721Delegate.sol";
import "./ComptrollerScenario.sol";

contract OErc721Harness is OErc721Immutable {
    uint blockNumber = 100000;
    uint harnessExchangeRate;
    bool harnessExchangeRateStored;
    mapping (address => bool) public failTransferToAddresses;

    constructor(address underlying_,
                ComptrollerInterface comptroller_,
                InterestRateModel interestRateModel_,
                uint initialExchangeRateMantissa_,
                string memory name_,
                string memory symbol_,
                uint8 decimals_,
                address payable admin_)
    OErc721Immutable(
    underlying_,
    comptroller_,
    interestRateModel_,
    initialExchangeRateMantissa_,
    name_,
    symbol_,
    decimals_,
    admin_) public {}

    function doTransfer(address from, address to, uint amount) internal {
    //     require(failTransferToAddresses[to] == false, "TOKEN_TRANSFER_OUT_FAILED");
    //     return super.doTransfer(from, to, amount);
    }

    function doTransferOut(address payable to, uint amount) internal {
        require(failTransferToAddresses[to] == false, "TOKEN_TRANSFER_OUT_FAILED");
        return super.doTransferOut(to, amount);
    }

    // function getBlockNumber() internal view returns (uint) {
    //     return blockNumber;
    // }

    function harnessSetAccrualBlockNumber(uint _accrualblockNumber) public {
        accrualBlockNumber = _accrualblockNumber;
    }

    function harnessSetBlockNumber(uint newBlockNumber) public {
        blockNumber = newBlockNumber;
    }

    function harnessFastForward(uint blocks) public {
        blockNumber += blocks;
    }

    function harnessSetBalance(address account, uint amount) external {
        accountTokens[account] = amount;
    }

    function harnessSetTotalSupply(uint totalSupply_) public {
        totalSupply = totalSupply_;
    }

    function harnessSetExchangeRate(uint exchangeRate) public {
        harnessExchangeRate = exchangeRate;
        harnessExchangeRateStored = true;
    }

    function harnessSetFailTransferToAddress(address _to, bool _fail) public {
        failTransferToAddresses[_to] = _fail;
    }

    function harnessMintFresh(address account, uint tokenId) public returns (uint) {
        (uint err,) = super.mintFresh(account, tokenId);
        return err;
    }

    function harnessRedeemFresh(address payable account, uint redeemTokenIn) public returns (uint) {
        return super.redeemFreshOToken(account, redeemTokenIn);
    }

    function getBlockNumber() internal view returns (uint) {
        ComptrollerScenario comptrollerScenario = ComptrollerScenario(address(comptroller));
        return comptrollerScenario.blockNumber();
    }
}

contract OErc721Scenario is OErc721Immutable {
    constructor(address underlying_,
                ComptrollerInterface comptroller_,
                InterestRateModel interestRateModel_,
                uint initialExchangeRateMantissa_,
                string memory name_,
                string memory symbol_,
                uint8 decimals_,
                address payable admin_)
    OErc721Immutable(
    underlying_,
    comptroller_,
    interestRateModel_,
    initialExchangeRateMantissa_,
    name_,
    symbol_,
    decimals_,
    admin_) public {}

    function getBlockNumber() internal view returns (uint) {
        ComptrollerScenario comptrollerScenario = ComptrollerScenario(address(comptroller));
        return comptrollerScenario.blockNumber();
    }
}

contract OErc721DelegatorScenario is OErc721Delegator {
    constructor(address underlying_,
                ComptrollerInterface comptroller_,
                InterestRateModel interestRateModel_,
                uint initialExchangeRateMantissa_,
                string memory name_,
                string memory symbol_,
                uint8 decimals_,
                address payable admin_,
                address implementation_,
                bytes memory becomeImplementationData)
    OErc721Delegator(
    underlying_,
    comptroller_,
    interestRateModel_,
    initialExchangeRateMantissa_,
    name_,
    symbol_,
    decimals_,
    admin_,
    implementation_,
    becomeImplementationData) public {}
}

contract OErc721DelegateHarness is OErc721Delegate {
    event Log(string x, address y);
    event Log(string x, uint y);

    uint blockNumber = 100000;
    uint harnessExchangeRate;
    bool harnessExchangeRateStored;

    mapping (address => bool) public failTransferToAddresses;

    function doTransfer(address from, address to, uint amount) internal {
        // require(failTransferToAddresses[to] == false, "TOKEN_TRANSFER_OUT_FAILED");
        // return super.doTransfer(from, to, amount);
    }

    function doTransferOut(address payable to, uint amount) internal {
        require(failTransferToAddresses[to] == false, "TOKEN_TRANSFER_OUT_FAILED");
        return super.doTransferOut(to, amount);
    }

    function getBlockNumber() internal view returns (uint) {
        return blockNumber;
    }

    function harnessSetBlockNumber(uint newBlockNumber) public {
        blockNumber = newBlockNumber;
    }

    function harnessFastForward(uint blocks) public {
        blockNumber += blocks;
    }

    function harnessSetBalance(address account, uint amount) external {
        accountTokens[account] = amount;
    }

    function harnessSetAccrualBlockNumber(uint _accrualblockNumber) public {
        accrualBlockNumber = _accrualblockNumber;
    }

    function harnessSetTotalSupply(uint totalSupply_) public {
        totalSupply = totalSupply_;
    }

    function harnessSetExchangeRate(uint exchangeRate) public {
        harnessExchangeRate = exchangeRate;
        harnessExchangeRateStored = true;
    }

    function harnessSetFailTransferToAddress(address _to, bool _fail) public {
        failTransferToAddresses[_to] = _fail;
    }

    function harnessMintFresh(address account, uint tokenId) public returns (uint) {
        (uint err,) = super.mintFresh(account, tokenId);
        return err;
    }

    function harnessRedeemFresh(address payable account, uint redeemTokenIn) public returns (uint) {
        return super.redeemFreshOToken(account, redeemTokenIn);
    }

    function harnessAccountBorrows(address account) public view returns (uint principal, uint interestIndex) {
        BorrowSnapshot memory snapshot = accountBorrows[account];
        return (snapshot.principal, snapshot.interestIndex);
    }
}

contract OErc721DelegateScenario is OErc721Delegate {
    function getBlockNumber() internal view returns (uint) {
        ComptrollerScenario comptrollerScenario = ComptrollerScenario(address(comptroller));
        return comptrollerScenario.blockNumber();
    }

}
