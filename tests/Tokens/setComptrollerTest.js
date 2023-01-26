const {
  makeComptroller,
  makeOToken
} = require('../Utils/Onyx');

describe('OToken', function () {
  let root, accounts;
  let oToken, oldComptroller, newComptroller;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    oToken = await makeOToken();
    oldComptroller = oToken.comptroller;
    newComptroller = await makeComptroller();
    expect(newComptroller._address).not.toEqual(oldComptroller._address);
  });

  describe('_setComptroller', () => {
    it("should fail if called by non-admin", async () => {
      expect(
        await send(oToken, '_setComptroller', [newComptroller._address], { from: accounts[0] })
      ).toHaveTokenFailure('UNAUTHORIZED', 'SET_COMPTROLLER_OWNER_CHECK');
      expect(await call(oToken, 'comptroller')).toEqual(oldComptroller._address);
    });

    it("reverts if passed a contract that doesn't implement isComptroller", async () => {
      await expect(send(oToken, '_setComptroller', [oToken.underlying._address])).rejects.toRevert("revert");
      expect(await call(oToken, 'comptroller')).toEqual(oldComptroller._address);
    });

    it("reverts if passed a contract that implements isComptroller as false", async () => {
      // extremely unlikely to occur, of course, but let's be exhaustive
      const badComptroller = await makeComptroller({ kind: 'false-marker' });
      await expect(send(oToken, '_setComptroller', [badComptroller._address])).rejects.toRevert("revert marker method returned false");
      expect(await call(oToken, 'comptroller')).toEqual(oldComptroller._address);
    });

    it("updates comptroller and emits log on success", async () => {
      const result = await send(oToken, '_setComptroller', [newComptroller._address]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewComptroller', {
        oldComptroller: oldComptroller._address,
        newComptroller: newComptroller._address
      });
      expect(await call(oToken, 'comptroller')).toEqual(newComptroller._address);
    });
  });
});
