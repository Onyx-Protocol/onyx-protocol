const {makeOTokenEx, quickMintNFT} = require('../Utils/Onyx');

async function mint(oTokenEx, minter, tokenId) {
  await send(oTokenEx.comptroller, 'setMintAllowed', [true]);
  await quickMintNFT(oTokenEx, minter, tokenId);
}

describe('OTokenEx', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const oTokenEx = await makeOTokenEx({supportMarket: true});
      expect(await call(oTokenEx, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(oTokenEx, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers token", async () => {
      const oTokenEx = await makeOTokenEx({comptrollerOpts: {kind: 'bool'}});
      await mint(oTokenEx, root, 1);
      expect(await call(oTokenEx, 'balanceOf', [root])).toEqualNumber(1);
      await send(oTokenEx, 'transfer', [accounts[0], 0]);
      expect(await call(oTokenEx, 'balanceOf', [root])).toEqualNumber(0);
      expect(await call(oTokenEx, 'balanceOf', [accounts[0]])).toEqualNumber(1);
    });

    it("doesn't transfer when src == dst", async () => {
      const oTokenEx = await makeOTokenEx({supportMarket: true});
      await send(oTokenEx, 'harnessSetBalance', [root, 100]);
      expect(await call(oTokenEx, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(oTokenEx, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const oTokenEx = await makeOTokenEx({comptrollerOpts: {kind: 'bool'}});
      await mint(oTokenEx, root, 1);

      await send(oTokenEx.comptroller, 'setTransferAllowed', [false])
      expect(await send(oTokenEx, 'transfer', [accounts[0], 0])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(oTokenEx.comptroller, 'setTransferAllowed', [true])
      await send(oTokenEx.comptroller, 'setTransferVerify', [false])
    });
  });
});