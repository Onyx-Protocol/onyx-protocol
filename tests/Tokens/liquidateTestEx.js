const {
  etherGasCost,
  etherUnsigned,
  etherMantissa,
  UInt256Max, 
  etherExp
} = require('../Utils/Ethereum');

const {
  makeOToken,
  makeOTokenEx,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove,
  preApproveNFT,
  quickMintNFT,
  enterMarkets
} = require('../Utils/Onyx');

const repayAmount = etherExp(10);
const seizeTokens = 10; // forced

async function preLiquidate(oToken, liquidator, borrower, repayAmount, oTokenCollateral) {
  // setup for success in liquidating
  await send(oToken.comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(oToken.comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(oToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(oToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(oToken.comptroller, 'setSeizeAllowed', [true]);
  await send(oToken.comptroller, 'setSeizeVerify', [true]);
  await send(oToken.comptroller, 'setFailCalculateSeizeTokens', [false]);
  await send(oToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oTokenCollateral.comptroller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await send(oTokenCollateral, 'harnessSetTotalSupply', [etherExp(10)]);
  await setBalance(oTokenCollateral, liquidator, 0);
  await setBalance(oTokenCollateral, borrower, seizeTokens);
  // await pretendBorrow(oTokenCollateral, borrower, 0, 1, 0);

  // keep same blocknumber with oToken
  await send(oTokenCollateral, 'harnessSetAccrualBlockNumber', [etherUnsigned(2e7)]);
  await send(oTokenCollateral, 'harnessSetBlockNumber', [etherUnsigned(2e7)]);

  await pretendBorrow(oToken, borrower, 1, 1, repayAmount);
  await preApprove(oToken, liquidator, repayAmount);
}

async function liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral) {
  return send(oToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, oTokenCollateral._address]);
}

async function liquidate(oToken, liquidator, borrower, repayAmount, oTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(oToken, 1);
  await fastForward(oTokenCollateral, 1);
  return send(oToken, 'liquidateBorrow', [borrower, repayAmount, oTokenCollateral._address], {from: liquidator});
}

async function seize(oToken, liquidator, borrower, seizeAmount) {
  return send(oToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('OTokenEx', function () {
  let root, liquidator, borrower, accounts;
  let oToken, oTokenCollateral;

  const exchangeRate = etherExp(1);

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    oToken = await makeOToken({comptrollerOpts: {kind: 'bool'}});
    oTokenCollateral = await makeOTokenEx({comptroller: oToken.comptroller});
    expect(await send(oTokenCollateral, 'harnessSetExchangeRate', [exchangeRate])).toSucceed();
  });
  
  beforeEach(async () => {
    await preLiquidate(oToken, liquidator, borrower, repayAmount, oTokenCollateral);
  });

  describe('liquidateBorrowFresh', () => {
    it("fails if comptroller tells it to", async () => {
      await send(oToken.comptroller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      expect(
        await liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(oToken);
      expect(
        await liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_FRESHNESS_CHECK');
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(oToken);
      await fastForward(oTokenCollateral);
      await send(oToken, 'accrueInterest');
      expect(
        await liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateFresh(oToken, borrower, borrower, repayAmount, oTokenCollateral)
      ).toHaveTokenFailure('INVALID_ACCOUNT_PAIR', 'LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateFresh(oToken, liquidator, borrower, 0, oTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalances([oToken, oTokenCollateral], [liquidator, borrower]);
      await send(oToken.comptroller, 'setFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).rejects.toRevert('revert LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_EX_FAILED');
      const afterBalances = await getBalances([oToken, oTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    it("fails if repay fails", async () => {
      await send(oToken.comptroller, 'setRepayBorrowAllowed', [false]);
      expect(
        await liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    });

    it("reverts if seize fails", async () => {
      await send(oToken.comptroller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    xit("reverts if liquidateBorrowVerify fails", async() => {
      await send(oToken.comptroller, 'setLiquidateBorrowVerify', [false]);
      await expect(
        liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral)
      ).rejects.toRevert("revert liquidateBorrowVerify rejected liquidateBorrow");
    });

    it("transfers the cash, borrows, tokens, and emits Transfer, LiquidateBorrow events", async () => {
      const beforeBalances = await getBalances([oToken, oTokenCollateral], [liquidator, borrower]);
      const result = await liquidateFresh(oToken, liquidator, borrower, repayAmount, oTokenCollateral);
      const afterBalances = await getBalances([oToken, oTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBorrow', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        oTokenCollateral: oTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 0], {
        from: liquidator,
        to: oToken._address,
        amount: repayAmount.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [oToken, 'cash', repayAmount],
        [oToken, 'borrows', -repayAmount],
        [oToken, liquidator, 'cash', -repayAmount],
        [oTokenCollateral, liquidator, 'tokens', seizeTokens],
        [oToken, borrower, 'borrows', -repayAmount],
        [oTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('liquidateBorrow', () => {
    it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(oToken, liquidator, borrower, repayAmount, oTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
      await send(oTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(oToken, liquidator, borrower, repayAmount, oTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from liquidateBorrowFresh without emitting any extra logs", async () => {
      expect(await liquidate(oToken, liquidator, borrower, 0, oTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBorrowFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalances([oToken, oTokenCollateral], [liquidator, borrower]);
      const result = await liquidate(oToken, liquidator, borrower, repayAmount, oTokenCollateral);
      const gasCost = await etherGasCost(result);
      const afterBalances = await getBalances([oToken, oTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [oToken, 'cash', repayAmount],
        [oToken, 'borrows', -repayAmount],
        [oToken, liquidator, 'eth', -gasCost],
        [oToken, liquidator, 'cash', -repayAmount],
        [oTokenCollateral, liquidator, 'eth', -gasCost],
        [oTokenCollateral, liquidator, 'tokens', seizeTokens],
        [oToken, borrower, 'borrows', -repayAmount],
        [oTokenCollateral, borrower, 'tokens', -seizeTokens],
      ]));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(oToken.comptroller, 'setSeizeAllowed', [false]);
      expect(await seize(oTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if oTokenBalances[borrower] < amount", async () => {
      await setBalance(oTokenCollateral, borrower, 1);
      expect(await seize(oTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if oTokenBalances[liquidator] overflows", async () => {
      await setBalance(oTokenCollateral, liquidator, UInt256Max());
      expect(await seize(oTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, adds to reserves, and emits Transfer and ReservesAdded events", async () => {
      const beforeBalances = await getBalances([oTokenCollateral], [liquidator, borrower]);
      const result = await seize(oTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalances([oTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog(['Transfer', 0], {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [oTokenCollateral, liquidator, 'tokens', seizeTokens],
        [oTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });
});

const tokenId1 = 1;
const tokenId2 = 2;
const tokenId3 = 3;

describe('Comptroller', () => {
  it('liquidateBorrowAllowed allows deprecated markets to be liquidated', async () => {
    let [root, liquidator, borrower] = saddle.accounts;
    let collatAmount = 3;
    let borrowAmount = 1;
    const oTokenCollat = await makeOTokenEx({supportMarket: true, underlyingPrice: 1, collateralFactor: .5});
    const oTokenBorrow = await makeOToken({supportMarket: true, underlyingPrice: 1, comptroller: oTokenCollat.comptroller});
    const comptroller = oTokenCollat.comptroller;

    // borrow some tokens
    await send(oTokenCollat.underlying, 'harnessSetBalance', [borrower, collatAmount]);
    // await send(oTokenCollat.underlying, 'approve', [oTokenCollat._address, tokenId], {from: borrower});
    await send(oTokenBorrow.underlying, 'harnessSetBalance', [oTokenBorrow._address, collatAmount]);
    await send(oTokenBorrow, 'harnessSetTotalSupply', [collatAmount * 10]);
    await send(oTokenBorrow, 'harnessSetExchangeRate', [etherExp(1)]);
    expect(await enterMarkets([oTokenCollat], borrower)).toSucceed();
    // expect(await send(oTokenCollat, 'mint', [collatAmount], {from: borrower})).toSucceed();
    await quickMintNFT(oTokenCollat, borrower, tokenId1);
    await quickMintNFT(oTokenCollat, borrower, tokenId2);
    await quickMintNFT(oTokenCollat, borrower, tokenId3);
    expect(await send(oTokenBorrow, 'borrow', [borrowAmount], {from: borrower})).toSucceed();

    // show the account is healthy
    expect(await call(comptroller, 'isDeprecated', [oTokenBorrow._address])).toEqual(false);
    expect(await call(comptroller, 'liquidateBorrowAllowed', [oTokenBorrow._address, oTokenCollat._address, liquidator, borrower, borrowAmount])).toHaveTrollError('INSUFFICIENT_SHORTFALL');

    // show deprecating a market works
    expect(await send(comptroller, '_setCollateralFactor', [oTokenBorrow._address, 0])).toSucceed();
    expect(await send(comptroller, '_setBorrowPaused', [oTokenBorrow._address, true])).toSucceed();
    expect(await send(oTokenBorrow, '_setReserveFactor', [etherMantissa(1)])).toSucceed();

    expect(await call(comptroller, 'isDeprecated', [oTokenBorrow._address])).toEqual(true);

    // show deprecated markets can be liquidated even if healthy
    expect(await send(comptroller, 'liquidateBorrowAllowed', [oTokenBorrow._address, oTokenCollat._address, liquidator, borrower, borrowAmount])).toSucceed();
    
    // even if deprecated, cant over repay
    await expect(send(comptroller, 'liquidateBorrowAllowed', [oTokenBorrow._address, oTokenCollat._address, liquidator, borrower, borrowAmount * 2])).rejects.toRevert('revert Can not repay more than the total borrow');
  });
})
