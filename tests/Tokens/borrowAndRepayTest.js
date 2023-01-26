const {
  etherUnsigned,
  etherMantissa,
  UInt256Max
} = require('../Utils/Ethereum');

const {
  makeOToken,
  balanceOf,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  setBalance,
  preApprove,
  pretendBorrow
} = require('../Utils/Onyx');

const borrowAmount = etherUnsigned(10e3);
const repayAmount = etherUnsigned(10e2);

async function preBorrow(oToken, borrower, borrowAmount) {
  await send(oToken.comptroller, 'setBorrowAllowed', [true]);
  await send(oToken.comptroller, 'setBorrowVerify', [true]);
  await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oToken.underlying, 'harnessSetBalance', [oToken._address, borrowAmount]);
  await send(oToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(oToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(oToken, 'harnessSetTotalBorrows', [0]);
}

async function borrowFresh(oToken, borrower, borrowAmount) {
  return send(oToken, 'harnessBorrowFresh', [borrower, borrowAmount]);
}

async function borrow(oToken, borrower, borrowAmount, opts = {}) {
  // make sure to have a block delta so we accrue interest
  await send(oToken, 'harnessFastForward', [1]);
  return send(oToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(oToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(oToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(oToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oToken.underlying, 'harnessSetFailTransferFromAddress', [benefactor, false]);
  await send(oToken.underlying, 'harnessSetFailTransferFromAddress', [borrower, false]);
  await pretendBorrow(oToken, borrower, 1, 1, repayAmount);
  await preApprove(oToken, benefactor, repayAmount);
  await preApprove(oToken, borrower, repayAmount);
}

async function repayBorrowFresh(oToken, payer, borrower, repayAmount) {
  return send(oToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer});
}

async function repayBorrow(oToken, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(oToken, 'harnessFastForward', [1]);
  return send(oToken, 'repayBorrow', [repayAmount], {from: borrower});
}

async function repayBorrowBehalf(oToken, payer, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(oToken, 'harnessFastForward', [1]);
  return send(oToken, 'repayBorrowBehalf', [borrower, repayAmount], {from: payer});
}

describe('OToken', function () {
  let oToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    oToken = await makeOToken({comptrollerOpts: {kind: 'bool'}});
  });

  describe('borrowFresh', () => {
    beforeEach(async () => await preBorrow(oToken, borrower, borrowAmount));

    it("fails if comptroller tells it to", async () => {
      await send(oToken.comptroller, 'setBorrowAllowed', [false]);
      expect(await borrowFresh(oToken, borrower, borrowAmount)).toHaveTrollReject('BORROW_COMPTROLLER_REJECTION');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await borrowFresh(oToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(oToken);
      expect(await borrowFresh(oToken, borrower, borrowAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'BORROW_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(oToken, 'accrueInterest')).toSucceed();
      await expect(await borrowFresh(oToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if error if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(oToken, borrower, borrowAmount.plus(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(oToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(oToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(oToken, borrower, 1e-18, 1e-18, UInt256Max());
      expect(await borrowFresh(oToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(oToken, 'harnessSetTotalBorrows', [UInt256Max()]);
      expect(await borrowFresh(oToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(oToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(oToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    xit("reverts if borrowVerify fails", async() => {
      await send(oToken.comptroller, 'setBorrowVerify', [false]);
      await expect(borrowFresh(oToken, borrower, borrowAmount)).rejects.toRevert("revert borrowVerify rejected borrow");
    });

    it("transfers the underlying cash, tokens, and emits Transfer, Borrow events", async () => {
      const beforeProtocolCash = await balanceOf(oToken.underlying, oToken._address);
      const beforeProtocolBorrows = await totalBorrows(oToken);
      const beforeAccountCash = await balanceOf(oToken.underlying, borrower);
      const result = await borrowFresh(oToken, borrower, borrowAmount);
      expect(result).toSucceed();
      expect(await balanceOf(oToken.underlying, borrower)).toEqualNumber(beforeAccountCash.plus(borrowAmount));
      expect(await balanceOf(oToken.underlying, oToken._address)).toEqualNumber(beforeProtocolCash.minus(borrowAmount));
      expect(await totalBorrows(oToken)).toEqualNumber(beforeProtocolBorrows.plus(borrowAmount));
      expect(result).toHaveLog('Transfer', {
        from: oToken._address,
        to: borrower,
        amount: borrowAmount.toString()
      });
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.plus(borrowAmount).toString()
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(oToken);
      await pretendBorrow(oToken, borrower, 0, 3, 0);
      await borrowFresh(oToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(oToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(etherMantissa(3));
      expect(await totalBorrows(oToken)).toEqualNumber(beforeProtocolBorrows.plus(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(oToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(borrow(oToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(oToken, borrower, borrowAmount.plus(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeAccountCash = await balanceOf(oToken.underlying, borrower);
      await fastForward(oToken);
      expect(await borrow(oToken, borrower, borrowAmount)).toSucceed();
      expect(await balanceOf(oToken.underlying, borrower)).toEqualNumber(beforeAccountCash.plus(borrowAmount));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach((benefactorIsPayer) => {
      let payer;
      const label = benefactorIsPayer ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorIsPayer ? benefactor : borrower;
          await preRepay(oToken, payer, borrower, repayAmount);
        });

        it("fails if repay is not allowed", async () => {
          await send(oToken.comptroller, 'setRepayBorrowAllowed', [false]);
          expect(await repayBorrowFresh(oToken, payer, borrower, repayAmount)).toHaveTrollReject('REPAY_BORROW_COMPTROLLER_REJECTION', 'MATH_ERROR');
        });

        it("fails if block number ≠ current block number", async () => {
          await fastForward(oToken);
          expect(await repayBorrowFresh(oToken, payer, borrower, repayAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REPAY_BORROW_FRESHNESS_CHECK');
        });

        it("fails if insufficient approval", async() => {
          await preApprove(oToken, payer, 1);
          await expect(repayBorrowFresh(oToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient allowance');
        });

        it("fails if insufficient balance", async() => {
          await setBalance(oToken.underlying, payer, 1);
          await expect(repayBorrowFresh(oToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
        });


        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(oToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(oToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(oToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(oToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED");
        });


        it("reverts if doTransferIn fails", async () => {
          await send(oToken.underlying, 'harnessSetFailTransferFromAddress', [payer, true]);
          await expect(repayBorrowFresh(oToken, payer, borrower, repayAmount)).rejects.toRevert("revert TOKEN_TRANSFER_IN_FAILED");
        });

        xit("reverts if repayBorrowVerify fails", async() => {
          await send(oToken.comptroller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(oToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits Transfer, RepayBorrow events", async () => {
          const beforeProtocolCash = await balanceOf(oToken.underlying, oToken._address);
          const result = await repayBorrowFresh(oToken, payer, borrower, repayAmount);
          expect(await balanceOf(oToken.underlying, oToken._address)).toEqualNumber(beforeProtocolCash.plus(repayAmount));
          expect(result).toHaveLog('Transfer', {
            from: payer,
            to: oToken._address,
            amount: repayAmount.toString()
          });
          expect(result).toHaveLog('RepayBorrow', {
            payer: payer,
            borrower: borrower,
            repayAmount: repayAmount.toString(),
            accountBorrows: "0",
            totalBorrows: "0"
          });
        });

        it("stores new borrow principal and interest index", async () => {
          const beforeProtocolBorrows = await totalBorrows(oToken);
          const beforeAccountBorrowSnap = await borrowSnapshot(oToken, borrower);
          expect(await repayBorrowFresh(oToken, payer, borrower, repayAmount)).toSucceed();
          const afterAccountBorrows = await borrowSnapshot(oToken, borrower);
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.minus(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(etherMantissa(1));
          expect(await totalBorrows(oToken)).toEqualNumber(beforeProtocolBorrows.minus(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(oToken, borrower, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(oToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(oToken.underlying, borrower, 1);
      await expect(repayBorrow(oToken, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(oToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(oToken, borrower);
      expect(await repayBorrow(oToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(oToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.minus(repayAmount));
    });

    it("repays the full amount owed if payer has enough", async () => {
      await fastForward(oToken);
      expect(await repayBorrow(oToken, borrower, UInt256Max())).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(oToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(0);
    });

    it("fails gracefully if payer does not have enough", async () => {
      await setBalance(oToken.underlying, borrower, 3);
      await fastForward(oToken);
      await expect(repayBorrow(oToken, borrower, UInt256Max())).rejects.toRevert('revert Insufficient balance');
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(oToken, payer, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(oToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(oToken.underlying, payer, 1);
      await expect(repayBorrowBehalf(oToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(oToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(oToken, borrower);
      expect(await repayBorrowBehalf(oToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(oToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.minus(repayAmount));
    });
  });
});
