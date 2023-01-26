const {
  makeOToken,
  getBalances,
  adjustBalances
} = require('../Utils/Onyx');

const exchangeRate = 5;

describe('OEther', function () {
  let root, nonRoot, accounts;
  let oToken;
  beforeEach(async () => {
    [root, nonRoot, ...accounts] = saddle.accounts;
    oToken = await makeOToken({kind: 'oether', comptrollerOpts: {kind: 'bool'}});
  });

  describe("getCashPrior", () => {
    it("returns the amount of ether held by the oEther contract before the current message", async () => {
      expect(await call(oToken, 'harnessGetCashPrior', [], {value: 100})).toEqualNumber(0);
    });
  });

  describe("doTransferIn", () => {
    it("succeeds if from is msg.nonRoot and amount is msg.value", async () => {
      expect(await call(oToken, 'harnessDoTransferIn', [root, 100], {value: 100})).toEqualNumber(100);
    });

    it("reverts if from != msg.sender", async () => {
      await expect(call(oToken, 'harnessDoTransferIn', [nonRoot, 100], {value: 100})).rejects.toRevert("revert sender mismatch");
    });

    it("reverts if amount != msg.value", async () => {
      await expect(call(oToken, 'harnessDoTransferIn', [root, 77], {value: 100})).rejects.toRevert("revert value mismatch");
    });

    describe("doTransferOut", () => {
      it("transfers ether out", async () => {
        const beforeBalances = await getBalances([oToken], [nonRoot]);
        const receipt = await send(oToken, 'harnessDoTransferOut', [nonRoot, 77], {value: 77});
        const afterBalances = await getBalances([oToken], [nonRoot]);
        expect(receipt).toSucceed();
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [oToken, nonRoot, 'eth', 77]
        ]));
      });

      it("reverts if it fails", async () => {
        await expect(call(oToken, 'harnessDoTransferOut', [root, 77], {value: 0})).rejects.toRevert();
      });
    });
  });
});
