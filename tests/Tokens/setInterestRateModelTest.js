const {both} = require('../Utils/Ethereum');
const {
  fastForward,
  makeOToken,
  makeInterestRateModel
} = require('../Utils/Onyx');

describe('OToken', function () {
  let root, accounts;
  let newModel;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    newModel = await makeInterestRateModel();
  });

  describe("_setInterestRateModelFresh", () => {
    let oToken, oldModel;
    beforeEach(async () => {
      oToken = await makeOToken();
      oldModel = oToken.interestRateModel;
      expect(oldModel._address).not.toEqual(newModel._address);
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(oToken, 'harnessSetInterestRateModelFresh', [newModel._address], {from: accounts[0]})
      ).toHaveTokenFailure('UNAUTHORIZED', 'SET_INTEREST_RATE_MODEL_OWNER_CHECK');
      expect(await call(oToken, 'interestRateModel')).toEqual(oldModel._address);
    });

    it("fails if market not fresh", async () => {
      expect(await send(oToken, 'harnessFastForward', [5])).toSucceed();
      expect(
        await send(oToken, 'harnessSetInterestRateModelFresh', [newModel._address])
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'SET_INTEREST_RATE_MODEL_FRESH_CHECK');
      expect(await call(oToken, 'interestRateModel')).toEqual(oldModel._address);
    });

    it("reverts if passed a contract that doesn't implement isInterestRateModel", async () => {
      await expect(
        send(oToken, 'harnessSetInterestRateModelFresh', [oToken.underlying._address])
      ).rejects.toRevert();
      expect(await call(oToken, 'interestRateModel')).toEqual(oldModel._address);
    });

    it("reverts if passed a contract that implements isInterestRateModel as false", async () => {
      // extremely unlikely to occur, of course, but let's be exhaustive
      const badModel = await makeInterestRateModel({kind: 'false-marker'});
      await expect(send(oToken, 'harnessSetInterestRateModelFresh', [badModel._address])).rejects.toRevert("revert marker method returned false");
      expect(await call(oToken, 'interestRateModel')).toEqual(oldModel._address);
    });

    it("accepts new valid interest rate model", async () => {
      expect(
        await send(oToken, 'harnessSetInterestRateModelFresh', [newModel._address])
      ).toSucceed();
      expect(await call(oToken, 'interestRateModel')).toEqual(newModel._address);
    });

    it("emits expected log when accepting a new valid interest rate model", async () => {
      const result = await send(oToken, 'harnessSetInterestRateModelFresh', [newModel._address]);
      expect(result).toSucceed();
      expect(result).toHaveLog('NewMarketInterestRateModel', {
        oldInterestRateModel: oldModel._address,
        newInterestRateModel: newModel._address,
      });
      expect(await call(oToken, 'interestRateModel')).toEqual(newModel._address);
    });
  });

  describe("_setInterestRateModel", () => {
    let oToken;
    beforeEach(async () => {
      oToken = await makeOToken();
    });

    beforeEach(async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
    });

    it("emits a set market interest rate model failure if interest accrual fails", async () => {
      await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
      await fastForward(oToken, 1);
      await expect(send(oToken, '_setInterestRateModel', [newModel._address])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from _setInterestRateModelFresh without emitting any extra logs", async () => {
      const {reply, receipt} = await both(oToken, '_setInterestRateModel', [newModel._address], {from: accounts[0]});
      expect(reply).toHaveTokenError('UNAUTHORIZED');
      expect(receipt).toHaveTokenFailure('UNAUTHORIZED', 'SET_INTEREST_RATE_MODEL_OWNER_CHECK');
    });

    it("reports success when _setInterestRateModelFresh succeeds", async () => {
      const {reply, receipt} = await both(oToken, '_setInterestRateModel', [newModel._address]);
      expect(reply).toEqualNumber(0);
      expect(receipt).toSucceed();
      expect(await call(oToken, 'interestRateModel')).toEqual(newModel._address);
    });
  });
});
