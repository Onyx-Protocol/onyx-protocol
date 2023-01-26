const {
  etherGasCost,
  etherMantissa,
  etherUnsigned,
  sendFallback
} = require('../Utils/Ethereum');

const {
  makeOToken,
  balanceOf,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,
} = require('../Utils/Onyx');

const exchangeRate = 5;
const mintAmount = etherUnsigned(1e5);
const mintTokens = mintAmount.dividedBy(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.multipliedBy(exchangeRate);

async function preMint(oToken, minter, mintAmount, mintTokens, exchangeRate) {
  await send(oToken.comptroller, 'setMintAllowed', [true]);
  await send(oToken.comptroller, 'setMintVerify', [true]);
  await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintExplicit(oToken, minter, mintAmount) {
  return send(oToken, 'mint', [], {from: minter, value: mintAmount});
}

async function mintFallback(oToken, minter, mintAmount) {
  return sendFallback(oToken, {from: minter, value: mintAmount});
}

async function preRedeem(oToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await send(oToken.comptroller, 'setRedeemAllowed', [true]);
  await send(oToken.comptroller, 'setRedeemVerify', [true]);
  await send(oToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
  await setEtherBalance(oToken, redeemAmount);
  await send(oToken, 'harnessSetTotalSupply', [redeemTokens]);
  await setBalance(oToken, redeemer, redeemTokens);
}

async function redeemOTokens(oToken, redeemer, redeemTokens, redeemAmount) {
  return send(oToken, 'redeem', [redeemTokens], {from: redeemer});
}

async function redeemUnderlying(oToken, redeemer, redeemTokens, redeemAmount) {
  return send(oToken, 'redeemUnderlying', [redeemAmount], {from: redeemer});
}

describe('OEther', () => {
  let root, minter, redeemer, accounts;
  let oToken;

  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    oToken = await makeOToken({kind: 'oether', comptrollerOpts: {kind: 'bool'}});
    await fastForward(oToken, 1);
  });

  [mintExplicit, mintFallback].forEach((mint) => {
    describe(mint.name, () => {
      beforeEach(async () => {
        await preMint(oToken, minter, mintAmount, mintTokens, exchangeRate);
      });

      it("reverts if interest accrual fails", async () => {
        await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(mint(oToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns success from mintFresh and mints the correct number of tokens", async () => {
        const beforeBalances = await getBalances([oToken], [minter]);
        const receipt = await mint(oToken, minter, mintAmount);
        const afterBalances = await getBalances([oToken], [minter]);
        expect(receipt).toSucceed();
        expect(mintTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [oToken, 'eth', mintAmount],
          [oToken, 'tokens', mintTokens],
          [oToken, minter, 'eth', -mintAmount.plus(await etherGasCost(receipt))],
          [oToken, minter, 'tokens', mintTokens]
        ]));
      });
    });
  });

  [redeemOTokens, redeemUnderlying].forEach((redeem) => {
    describe(redeem.name, () => {
      beforeEach(async () => {
        await preRedeem(oToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("emits a redeem failure if interest accrual fails", async () => {
        await send(oToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(redeem(oToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns error from redeemFresh without emitting any extra logs", async () => {
        expect(await redeem(oToken, redeemer, redeemTokens.multipliedBy(5), redeemAmount.multipliedBy(5))).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("returns success from redeemFresh and redeems the correct amount", async () => {
        await fastForward(oToken);
        const beforeBalances = await getBalances([oToken], [redeemer]);
        const receipt = await redeem(oToken, redeemer, redeemTokens, redeemAmount);
        expect(receipt).toTokenSucceed();
        const afterBalances = await getBalances([oToken], [redeemer]);
        expect(redeemTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [oToken, 'eth', -redeemAmount],
          [oToken, 'tokens', -redeemTokens],
          [oToken, redeemer, 'eth', redeemAmount.minus(await etherGasCost(receipt))],
          [oToken, redeemer, 'tokens', -redeemTokens]
        ]));
      });
    });
  });
});
