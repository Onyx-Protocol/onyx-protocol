const {
  etherUnsigned,
  etherMantissa,
  UInt256Max
} = require('../Utils/Ethereum');

const {
  makeOToken,
  makeOTokenEx,
  setBorrowRate,
  pretendBorrow,
  quickMintNFT,
} = require('../Utils/Onyx');

describe('OToken', function () {
  let root, admin, accounts;
  beforeEach(async () => {
    [root, admin, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("fails when non erc-20 underlying", async () => {
      await expect(makeOToken({ underlying: { _address: root } })).rejects.toRevert("revert");
    });

    it("fails when 0 initial exchange rate", async () => {
      await expect(makeOToken({ exchangeRate: 0 })).rejects.toRevert("revert initial exchange rate must be greater than zero.");
    });

    it("succeeds with erc-20 underlying and non-zero exchange rate", async () => {
      const oToken = await makeOToken();
      expect(await call(oToken, 'underlying')).toEqual(oToken.underlying._address);
      expect(await call(oToken, 'admin')).toEqual(root);
    });

    it("succeeds when setting admin to contructor argument", async () => {
      const oToken = await makeOToken({ admin: admin });
      expect(await call(oToken, 'admin')).toEqual(admin);
    });
  });

  describe('name, symbol, decimals', () => {
    let oToken;

    beforeEach(async () => {
      oToken = await makeOToken({ name: "OToken Foo", symbol: "cFOO", decimals: 10 });
    });

    it('should return correct name', async () => {
      expect(await call(oToken, 'name')).toEqual("OToken Foo");
    });

    it('should return correct symbol', async () => {
      expect(await call(oToken, 'symbol')).toEqual("cFOO");
    });

    it('should return correct decimals', async () => {
      expect(await call(oToken, 'decimals')).toEqualNumber(10);
    });
  });

  describe('balanceOfUnderlying', () => {
    it("has an underlying balance", async () => {
      const oToken = await makeOToken({ supportMarket: true, exchangeRate: 2 });
      await send(oToken, 'harnessSetBalance', [root, 100]);
      expect(await call(oToken, 'balanceOfUnderlying', [root])).toEqualNumber(200);
    });
  });

  describe('borrowRatePerBlock', () => {
    it("has a borrow rate", async () => {
      const oToken = await makeOToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(oToken, 'borrowRatePerBlock');
      expect(Math.abs(perBlock * 2102400 - 5e16)).toBeLessThanOrEqual(1e8);
    });
  });

  describe('supplyRatePerBlock', () => {
    it("returns 0 if there's no supply", async () => {
      const oToken = await makeOToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(oToken, 'supplyRatePerBlock');
      await expect(perBlock).toEqualNumber(0);
    });

    it("has a supply rate", async () => {
      const baseRate = 0.05;
      const multiplier = 0.45;
      const kink = 0.95;
      const jump = 5 * multiplier;
      const oToken = await makeOToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate, multiplier, kink, jump } });
      await send(oToken, 'harnessSetReserveFactorFresh', [etherMantissa(.01)]);
      await send(oToken, 'harnessExchangeRateDetails', [1, 1, 0]);
      await send(oToken, 'harnessSetExchangeRate', [etherMantissa(1)]);
      // Full utilization (Over the kink so jump is included), 1% reserves
      const borrowRate = baseRate + multiplier * kink + jump * .05;
      const expectedSuplyRate = borrowRate * .99;

      const perBlock = await call(oToken, 'supplyRatePerBlock');
      expect(Math.abs(perBlock * 2102400 - expectedSuplyRate * 1e18)).toBeLessThanOrEqual(1e8);
    });
  });

  describe("borrowBalanceCurrent", () => {
    let borrower;
    let oToken;

    beforeEach(async () => {
      borrower = accounts[0];
      oToken = await makeOToken();
    });

    beforeEach(async () => {
      await setBorrowRate(oToken, .001)
      await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
    });

    it("reverts if interest accrual fails", async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      // make sure we accrue interest
      await send(oToken, 'harnessFastForward', [1]);
      await expect(send(oToken, 'borrowBalanceCurrent', [borrower])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns successful result from borrowBalanceStored with no interest", async () => {
      await setBorrowRate(oToken, 0);
      await pretendBorrow(oToken, borrower, 1, 1, 5e18);
      expect(await call(oToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18)
    });

    it("returns successful result from borrowBalanceCurrent with no interest", async () => {
      await setBorrowRate(oToken, 0);
      await pretendBorrow(oToken, borrower, 1, 3, 5e18);
      expect(await send(oToken, 'harnessFastForward', [5])).toSucceed();
      expect(await call(oToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18 * 3)
    });
  });

  describe("borrowBalanceStored", () => {
    let borrower;
    let oToken;

    beforeEach(async () => {
      borrower = accounts[0];
      oToken = await makeOToken({ comptrollerOpts: { kind: 'bool' } });
    });

    it("returns 0 for account with no borrows", async () => {
      expect(await call(oToken, 'borrowBalanceStored', [borrower])).toEqualNumber(0)
    });

    it("returns stored principal when account and market indexes are the same", async () => {
      await pretendBorrow(oToken, borrower, 1, 1, 5e18);
      expect(await call(oToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18);
    });

    it("returns calculated balance when market index is higher than account index", async () => {
      await pretendBorrow(oToken, borrower, 1, 3, 5e18);
      expect(await call(oToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18 * 3);
    });

    it("has undefined behavior when market index is lower than account index", async () => {
      // The market index < account index should NEVER happen, so we don't test this case
    });

    it("reverts on overflow of principal", async () => {
      await pretendBorrow(oToken, borrower, 1, 3, UInt256Max());
      await expect(call(oToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });

    it("reverts on non-zero stored principal with zero account index", async () => {
      await pretendBorrow(oToken, borrower, 0, 3, 5);
      await expect(call(oToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });
  });

  describe('exchangeRateStored', () => {
    let oToken, exchangeRate = 2;

    beforeEach(async () => {
      oToken = await makeOToken({ exchangeRate });
    });

    it("returns initial exchange rate with zero oTokenSupply", async () => {
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(exchangeRate));
    });

    it("calculates with single oTokenSupply and single total borrow", async () => {
      const oTokenSupply = 1, totalBorrows = 1, totalReserves = 0;
      await send(oToken, 'harnessExchangeRateDetails', [oTokenSupply, totalBorrows, totalReserves]);
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1));
    });

    it("calculates with oTokenSupply and total borrows", async () => {
      const oTokenSupply = 100e18, totalBorrows = 10e18, totalReserves = 0;
      await send(oToken, 'harnessExchangeRateDetails', [oTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(.1));
    });

    it("calculates with cash and oTokenSupply", async () => {
      const oTokenSupply = 5e18, totalBorrows = 0, totalReserves = 0;
      expect(
        await send(oToken.underlying, 'transfer', [oToken._address, etherMantissa(500)])
      ).toSucceed();
      await send(oToken, 'harnessExchangeRateDetails', [oTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(100));
    });

    it("calculates with cash, borrows, reserves and oTokenSupply", async () => {
      const oTokenSupply = 500e18, totalBorrows = 500e18, totalReserves = 5e18;
      expect(
        await send(oToken.underlying, 'transfer', [oToken._address, etherMantissa(500)])
      ).toSucceed();
      await send(oToken, 'harnessExchangeRateDetails', [oTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1.99));
    });
  });

  describe('getCash', () => {
    it("gets the cash", async () => {
      const oToken = await makeOToken();
      const result = await call(oToken, 'getCash');
      expect(result).toEqualNumber(0);
    });
  });
});

describe('OTokenEx', function () {
  let root, admin, accounts;
  beforeEach(async () => {
    [root, admin, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("fails when non erc-721 underlying", async () => {
      await expect(makeOTokenEx({ underlying: { _address: root } })).rejects.toRevert("revert");
    });

    it("succeeds with erc-721 underlying and non-zero exchange rate", async () => {
      const oToken = await makeOTokenEx();
      expect(await call(oToken, 'underlying')).toEqual(oToken.underlying._address);
      expect(await call(oToken, 'admin')).toEqual(root);
    });

    it("succeeds when setting admin to contructor argument", async () => {
      const oToken = await makeOTokenEx({ admin: admin });
      expect(await call(oToken, 'admin')).toEqual(admin);
    });
  });

  describe('name, symbol, decimals', () => {
    let oToken;

    beforeEach(async () => {
      oToken = await makeOTokenEx({ name: "OToken Foo", symbol: "cFOO", decimals: 10 });
    });

    it('should return correct name', async () => {
      expect(await call(oToken, 'name')).toEqual("OToken Foo");
    });

    it('should return correct symbol', async () => {
      expect(await call(oToken, 'symbol')).toEqual("cFOO");
    });

    it('should return correct decimals', async () => {
      expect(await call(oToken, 'decimals')).toEqualNumber(10);
    });
  });

  describe('balanceOfUnderlying', () => {
    it("has an underlying balance", async () => {
      const oToken = await makeOTokenEx({ supportMarket: true });
      await send(oToken, 'harnessSetBalance', [root, 100]);
      expect(await call(oToken, 'balanceOfUnderlying', [root])).toEqualNumber(100);
    });
  });

  describe('borrowRatePerBlock', () => {
    it("has zero borrow rate", async () => {
      const oToken = await makeOTokenEx({ supportMarket: true });
      const perBlock = await call(oToken, 'borrowRatePerBlock');
      expect(perBlock).toEqual('0');
    });
  });

  describe('supplyRatePerBlock', () => {
    it("has zero supply rate", async () => {
      const oToken = await makeOTokenEx({ supportMarket: true });
      const perBlock = await call(oToken, 'supplyRatePerBlock');
      await expect(perBlock).toEqualNumber('0');
    });
  });

  describe("borrow", () => {
    let borrower;
    let oToken;

    beforeEach(async () => {
      borrower = accounts[0];
      oToken = await makeOTokenEx();
    });

    it("reverts borrow action", async () => {
      await expect(send(oToken, 'borrow', [1], { from: borrower })).rejects.toRevert();
    });

    it("borrowBalance is 0", async () => {
      expect(await call(oToken, 'borrowBalanceStored', [borrower])).toEqualNumber(0)
    });
  });

  describe('exchangeRateStored', () => {
    let oToken;
    let minter;

    beforeEach(async () => {
      oToken = await makeOTokenEx({comptrollerOpts: {kind: 'bool'}});
      minter = accounts[0];
    });

    it("returns initial exchange rate with zero oTokenSupply", async () => {
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1));
    });

    it("exchange rate after mint", async () => {
      await send(oToken.comptroller, 'setMintAllowed', [true]);
      expect(await quickMintNFT(oToken, minter, 1)).toSucceed();
      const result = await call(oToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1));
    });
  });

  describe('getCash', () => {
    it("gets the cash", async () => {
      const oToken = await makeOTokenEx();
      const result = await call(oToken, 'getCash');
      expect(result).toEqualNumber(0);
    });
  });
});
