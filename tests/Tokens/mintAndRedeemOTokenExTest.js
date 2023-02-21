const {
  makeOTokenEx,
  balanceOf,
  fastForward,
  getBalances,
  adjustBalances,
  preApproveNFT,
  quickMintNFT,
  quickRedeemNFT,
} = require('../Utils/Onyx');

const tokenId = 1;
const tokenId1 = 2;

async function preMint(oTokenEx, minter, tokenId) {
  await preApproveNFT(oTokenEx, minter, tokenId);
  await send(oTokenEx.comptroller, 'setMintAllowed', [true]);
  await send(oTokenEx.comptroller, 'setMintVerify', [true]);
  await send(oTokenEx.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oTokenEx.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(oTokenEx, 'harnessSetBalance', [minter, 0]);
}

async function mintFresh(oTokenEx, minter, tokenId) {
  return send(oTokenEx, 'harnessMintFresh', [minter, tokenId]);
}

async function preRedeem(oTokenEx, redeemer, tokenId) {
  await quickMintNFT(oTokenEx, redeemer, tokenId);
  await send(oTokenEx.comptroller, 'setRedeemAllowed', [true]);
  await send(oTokenEx.comptroller, 'setRedeemVerify', [true]);
  await send(oTokenEx.interestRateModel, 'setFailBorrowRate', [false]);
  await send(oTokenEx.underlying, 'harnessSetFailTransferToAddress', [redeemer, false]);
}

async function redeemFreshTokens(oTokenEx, redeemer, tokenIndex) {
  return send(oTokenEx, 'harnessRedeemFresh', [redeemer, tokenIndex]);
}

describe('OTokenEx', function () {
  let root, minter, redeemer, accounts;
  let oTokenEx;
  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    oTokenEx = await makeOTokenEx({comptrollerOpts: {kind: 'bool'}});
  });

  describe('mintFresh', () => {
    beforeEach(async () => {
      await preMint(oTokenEx, minter, tokenId);
    });

    it("fails if comptroller tells it to", async () => {
      await send(oTokenEx.comptroller, 'setMintAllowed', [false]);
      expect(await mintFresh(oTokenEx, minter, tokenId)).toHaveTrollReject('MINT_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await mintFresh(oTokenEx, minter, tokenId)).toSucceed();
    });

    it("fails if not fresh", async () => {
      await fastForward(oTokenEx);
      expect(await mintFresh(oTokenEx, minter, tokenId)).toHaveTokenFailure('MARKET_NOT_FRESH', 'MINT_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(oTokenEx, 'accrueInterest')).toSucceed();
      expect(await mintFresh(oTokenEx, minter, tokenId)).toSucceed();
    });

    it("fails if insufficient approval", async () => {
      expect(
        await send(oTokenEx.underlying, 'setApprovalForAll', [oTokenEx._address, false], {from: minter})
      ).toSucceed();
      await expect(mintFresh(oTokenEx, minter, tokenId)).rejects.toRevert('revert ERC721: transfer caller is not owner nor approved');
    });

    it("fails if transferring in fails", async () => {
      await send(oTokenEx.underlying, 'harnessSetFailTransferFromAddress', [minter, true]);
      await expect(mintFresh(oTokenEx, minter, tokenId)).rejects.toRevert('revert ERC721: TOKEN_TRANSFER_FAILED');
    });

    it("transfers the underlying cash, tokens, and emits Mint, Transfer events", async () => {
      const beforeBalances = await getBalances([oTokenEx], [minter]);
      const result = await mintFresh(oTokenEx, minter, tokenId);
      const afterBalances = await getBalances([oTokenEx], [minter]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Mint', {
        minter,
        mintAmount: '1',
        mintTokens: '1'
      });
      expect(result).toHaveLog('Transfer', {
        from: oTokenEx._address,
        to: minter,
        amount: '1'
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [oTokenEx, minter, 'cash', -1],
        [oTokenEx, minter, 'tokens', 1],
        [oTokenEx, 'cash', 1],
        [oTokenEx, 'tokens', 1]
      ]));
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await preMint(oTokenEx, minter, tokenId);
    });

    it("emits a mint failure if interest accrual fails", async () => {
      await send(oTokenEx.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickMintNFT(oTokenEx, minter, tokenId1)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns success from mintFresh and mints the correct number of tokens", async () => {
      expect(await quickMintNFT(oTokenEx, minter, tokenId1)).toSucceed();
      expect(await balanceOf(oTokenEx, minter)).toEqualNumber(1);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMintNFT(oTokenEx, minter, tokenId1)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "0",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });

  [redeemFreshTokens].forEach((redeemFresh) => {
    describe(redeemFresh.name, () => {
      beforeEach(async () => {
        await preRedeem(oTokenEx, redeemer, tokenId);
      });

      it("fails if comptroller tells it to", async () =>{
        await send(oTokenEx.comptroller, 'setRedeemAllowed', [false]);
        expect(await redeemFresh(oTokenEx, redeemer, 0)).toHaveTrollReject('REDEEM_COMPTROLLER_REJECTION');
      });

      it("fails if not fresh", async () => {
        await fastForward(oTokenEx);
        expect(await redeemFresh(oTokenEx, redeemer, 0)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDEEM_FRESHNESS_CHECK');
      });

      it("continues if fresh", async () => {
        await expect(await send(oTokenEx, 'accrueInterest')).toSucceed();
        expect(await redeemFresh(oTokenEx, redeemer, 0)).toSucceed();
      });

      it("fails if transferring out fails", async () => {
        await send(oTokenEx.underlying, 'harnessSetFailTransferToAddress', [redeemer, true]);
        await expect(redeemFresh(oTokenEx, redeemer, 0)).rejects.toRevert("revert ERC721: TOKEN_TRANSFER_FAILED");
      });

      it("reverts if new account balance underflows", async () => {
        await send(oTokenEx, 'harnessSetBalance', [redeemer, 0]);
        expect(await redeemFresh(oTokenEx, redeemer, 0)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED');
      });

      it("transfers the underlying cash, tokens, and emits Redeem, Transfer events", async () => {
        const beforeBalances = await getBalances([oTokenEx], [redeemer]);
        const result = await redeemFresh(oTokenEx, redeemer, 0);
        const afterBalances = await getBalances([oTokenEx], [redeemer]);
        expect(result).toSucceed();
        expect(result).toHaveLog('Redeem', {
          redeemer,
          redeemAmount: '1',
          redeemTokens: '1'
        });
        expect(result).toHaveLog('Transfer', {
          from: redeemer,
          to: oTokenEx._address,
          amount: '1'
        });
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [oTokenEx, redeemer, 'cash', 1],
          [oTokenEx, redeemer, 'tokens', -1],
          [oTokenEx, 'cash', -1],
          [oTokenEx, 'tokens', -1]
        ]));
      });
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await preRedeem(oTokenEx, redeemer, tokenId);
    });

    it("emits a redeem failure if interest accrual fails", async () => {
      await send(oTokenEx.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickRedeemNFT(oTokenEx, redeemer, 0)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns success from redeemFresh and redeems the right amount of underlying", async () => {
      expect(
        await quickRedeemNFT(oTokenEx, redeemer, 0)
      ).toSucceed();
      expect(await balanceOf(oTokenEx.underlying, redeemer)).toEqualNumber(1);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMintNFT(oTokenEx, minter, tokenId1)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "1",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });
});
