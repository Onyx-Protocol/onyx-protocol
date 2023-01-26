const {
  etherBalance,
  etherGasCost,
  getContract
} = require('./Utils/Ethereum');

const {
  makeComptroller,
  makeOToken,
  makePriceOracle,
  pretendBorrow,
  borrowSnapshot
} = require('./Utils/Onyx');

describe('Maximillion', () => {
  let root, borrower;
  let maximillion, oEther;
  beforeEach(async () => {
    [root, borrower] = saddle.accounts;
    oEther = await makeOToken({kind: "oether", supportMarket: true});
    maximillion = await deploy('Maximillion', [oEther._address]);
  });

  describe("constructor", () => {
    it("sets address of oEther", async () => {
      expect(await call(maximillion, "oEther")).toEqual(oEther._address);
    });
  });

  describe("repayBehalf", () => {
    it("refunds the entire amount with no borrows", async () => {
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.minus(gasCost));
    });

    it("repays part of a borrow", async () => {
      await pretendBorrow(oEther, borrower, 1, 1, 150);
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      const afterBorrowSnap = await borrowSnapshot(oEther, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.minus(gasCost).minus(100));
      expect(afterBorrowSnap.principal).toEqualNumber(50);
    });

    it("repays a full borrow and refunds the rest", async () => {
      await pretendBorrow(oEther, borrower, 1, 1, 90);
      const beforeBalance = await etherBalance(root);
      const result = await send(maximillion, "repayBehalf", [borrower], {value: 100});
      const gasCost = await etherGasCost(result);
      const afterBalance = await etherBalance(root);
      const afterBorrowSnap = await borrowSnapshot(oEther, borrower);
      expect(result).toSucceed();
      expect(afterBalance).toEqualNumber(beforeBalance.minus(gasCost).minus(90));
      expect(afterBorrowSnap.principal).toEqualNumber(0);
    });
  });
});
