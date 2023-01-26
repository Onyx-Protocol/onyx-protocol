const {makeOToken} = require('../Utils/Onyx');

describe('OToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const oToken = await makeOToken({supportMarket: true});
      expect(await call(oToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(oToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const oToken = await makeOToken({supportMarket: true});
      await send(oToken, 'harnessSetBalance', [root, 100]);
      expect(await call(oToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(oToken, 'transfer', [accounts[0], 50]);
      expect(await call(oToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(oToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const oToken = await makeOToken({supportMarket: true});
      await send(oToken, 'harnessSetBalance', [root, 100]);
      expect(await call(oToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(oToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const oToken = await makeOToken({comptrollerOpts: {kind: 'bool'}});
      await send(oToken, 'harnessSetBalance', [root, 100]);
      expect(await call(oToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(oToken.comptroller, 'setTransferAllowed', [false])
      expect(await send(oToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(oToken.comptroller, 'setTransferAllowed', [true])
      await send(oToken.comptroller, 'setTransferVerify', [false])
      // no longer support verifyTransfer on oToken end
      // await expect(send(oToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});