const {
  makeOToken,
} = require('../Utils/Onyx');


describe('OXcnLikeDelegate', function () {
  describe("_delegateXcnLikeTo", () => {
    it("does not delegate if not the admin", async () => {
      const [root, a1] = saddle.accounts;
      const oToken = await makeOToken({kind: 'oxcn'});
      await expect(send(oToken, '_delegateXcnLikeTo', [a1], {from: a1})).rejects.toRevert('revert only the admin may set the xcn-like delegate');
    });

    it("delegates successfully if the admin", async () => {
      const [root, a1] = saddle.accounts, amount = 1;
      const oXCN = await makeOToken({kind: 'oxcn'}), XCN = oXCN.underlying;
      const tx1 = await send(oXCN, '_delegateXcnLikeTo', [a1]);
      const tx2 = await send(XCN, 'transfer', [oXCN._address, amount]);
      await expect(await call(XCN, 'getCurrentVotes', [a1])).toEqualNumber(amount);
    });
  });
});