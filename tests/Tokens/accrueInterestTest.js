const {
  etherMantissa,
  etherUnsigned,
  UInt256Max
} = require('../Utils/Ethereum');
const {
  makeOToken,
  setBorrowRate
} = require('../Utils/Onyx');

const blockNumber = 2e7;
const borrowIndex = 1e18;
const borrowRate = .000001;

async function pretendBlock(oToken, accrualBlock = blockNumber, deltaBlocks = 1) {
  await send(oToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(oToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber + deltaBlocks)]);
  await send(oToken, 'harnessSetBorrowIndex', [etherUnsigned(borrowIndex)]);
}

async function preAccrue(oToken) {
  await setBorrowRate(oToken, borrowRate);
  await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oToken, 'harnessExchangeRateDetails', [0, 0, 0]);
}

describe('OToken', () => {
  let root, accounts;
  let oToken;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    oToken = await makeOToken({comptrollerOpts: {kind: 'bool'}});
  });

  beforeEach(async () => {
    await preAccrue(oToken);
  });

  describe('accrueInterest', () => {
    it('reverts if the interest rate is absurdly high', async () => {
      await pretendBlock(oToken, blockNumber, 1);
      expect(await call(oToken, 'getBorrowRateMaxMantissa')).toEqualNumber(etherMantissa(0.000005)); // 0.0005% per block
      await setBorrowRate(oToken, 0.001e-2); // 0.0010% per block
      await expect(send(oToken, 'accrueInterest')).rejects.toRevert("revert borrow rate is absurdly high");
    });

    it('fails if new borrow rate calculation fails', async () => {
      await pretendBlock(oToken, blockNumber, 1);
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(send(oToken, 'accrueInterest')).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it('fails if simple interest factor calculation fails', async () => {
      await pretendBlock(oToken, blockNumber, 5e70);
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_SIMPLE_INTEREST_FACTOR_CALCULATION_FAILED');
    });

    it('fails if new borrow index calculation fails', async () => {
      await pretendBlock(oToken, blockNumber, 5e60);
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if new borrow interest index calculation fails', async () => {
      await pretendBlock(oToken)
      await send(oToken, 'harnessSetBorrowIndex', [UInt256Max()]);
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED');
    });

    it('fails if interest accumulated calculation fails', async () => {
      await send(oToken, 'harnessExchangeRateDetails', [0, UInt256Max(), 0]);
      await pretendBlock(oToken)
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_ACCUMULATED_INTEREST_CALCULATION_FAILED');
    });

    it('fails if new total borrows calculation fails', async () => {
      await setBorrowRate(oToken, 1e-18);
      await pretendBlock(oToken)
      await send(oToken, 'harnessExchangeRateDetails', [0, UInt256Max(), 0]);
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_BORROWS_CALCULATION_FAILED');
    });

    it('fails if interest accumulated for reserves calculation fails', async () => {
      await setBorrowRate(oToken, .000001);
      await send(oToken, 'harnessExchangeRateDetails', [0, etherUnsigned(1e30), UInt256Max()]);
      await send(oToken, 'harnessSetReserveFactorFresh', [etherUnsigned(1e10)]);
      await pretendBlock(oToken, blockNumber, 5e20)
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('fails if new total reserves calculation fails', async () => {
      await setBorrowRate(oToken, 1e-18);
      await send(oToken, 'harnessExchangeRateDetails', [0, etherUnsigned(1e56), UInt256Max()]);
      await send(oToken, 'harnessSetReserveFactorFresh', [etherUnsigned(1e17)]);
      await pretendBlock(oToken)
      expect(await send(oToken, 'accrueInterest')).toHaveTokenFailure('MATH_ERROR', 'ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED');
    });

    it('succeeds and saves updated values in storage on success', async () => {
      const startingTotalBorrows = 1e22;
      const startingTotalReserves = 1e20;
      const reserveFactor = 1e17;

      await send(oToken, 'harnessExchangeRateDetails', [0, etherUnsigned(startingTotalBorrows), etherUnsigned(startingTotalReserves)]);
      await send(oToken, 'harnessSetReserveFactorFresh', [etherUnsigned(reserveFactor)]);
      await pretendBlock(oToken)

      const expectedAccrualBlockNumber = blockNumber + 1;
      const expectedBorrowIndex = borrowIndex + borrowIndex * borrowRate;
      const expectedTotalBorrows = startingTotalBorrows + startingTotalBorrows * borrowRate;
      const expectedTotalReserves = startingTotalReserves + startingTotalBorrows *  borrowRate * reserveFactor / 1e18;

      const receipt = await send(oToken, 'accrueInterest')
      expect(receipt).toSucceed();
      expect(receipt).toHaveLog('AccrueInterest', {
        cashPrior: 0,
        interestAccumulated: etherUnsigned(expectedTotalBorrows).minus(etherUnsigned(startingTotalBorrows)).toFixed(),
        borrowIndex: etherUnsigned(expectedBorrowIndex).toFixed(),
        totalBorrows: etherUnsigned(expectedTotalBorrows).toFixed()
      })
      expect(await call(oToken, 'accrualBlockNumber')).toEqualNumber(expectedAccrualBlockNumber);
      expect(await call(oToken, 'borrowIndex')).toEqualNumber(expectedBorrowIndex);
      expect(await call(oToken, 'totalBorrows')).toEqualNumber(expectedTotalBorrows);
      expect(await call(oToken, 'totalReserves')).toEqualNumber(expectedTotalReserves);
    });
  });
});
