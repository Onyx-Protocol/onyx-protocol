const {
  etherUnsigned,
  etherMantissa,
  etherExp,
} = require('./Utils/Ethereum');

const {
  makeComptroller,
  makeOToken,
  preApprove,
  preSupply,
  quickRedeem,
} = require('./Utils/Onyx');

async function xcnBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.xcn, 'balanceOf', [user]))
}

async function xcnAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'xcnAccrued', [user]));
}

async function fastForwardPatch(patch, comptroller, blocks) {
  if (patch == 'unitroller') {
    return await send(comptroller, 'harnessFastForward', [blocks]);
  } else {
    return await send(comptroller, 'fastForward', [blocks]);
  }
}

const fs = require('fs');
const util = require('util');
const diffStringsUnified = require('jest-diff').default;


async function preRedeem(
  oToken,
  redeemer,
  redeemTokens,
  redeemAmount,
  exchangeRate
) {
  await preSupply(oToken, redeemer, redeemTokens);
  await send(oToken.underlying, 'harnessSetBalance', [
    oToken._address,
    redeemAmount
  ]);
}

const sortOpcodes = (opcodesMap) => {
  return Object.values(opcodesMap)
    .map(elem => [elem.fee, elem.name])
    .sort((a, b) => b[0] - a[0]);
};

const getGasCostFile = name => {
  try {
    const jsonString = fs.readFileSync(name);
    return JSON.parse(jsonString);
  } catch (err) {
    console.log(err);
    return {};
  }
};

const recordGasCost = (totalFee, key, filename, opcodes = {}) => {
  let fileObj = getGasCostFile(filename);
  const newCost = {fee: totalFee, opcodes: opcodes};
  console.log(diffStringsUnified(fileObj[key], newCost));
  fileObj[key] = newCost;
  fs.writeFileSync(filename, JSON.stringify(fileObj, null, ' '), 'utf-8');
};

async function mint(oToken, minter, mintAmount, exchangeRate) {
  expect(await preApprove(oToken, minter, mintAmount, {})).toSucceed();
  return send(oToken, 'mint', [mintAmount], { from: minter });
}

async function claimXcn(comptroller, holder) {
  return send(comptroller, 'claimXcn', [holder], { from: holder });
}

/// GAS PROFILER: saves a digest of the gas prices of common OToken operations
/// transiently fails, not sure why

describe('Gas report', () => {
  let root, minter, redeemer, accounts, oToken;
  const exchangeRate = 50e3;
  const preMintAmount = etherUnsigned(30e4);
  const mintAmount = etherUnsigned(10e4);
  const mintTokens = mintAmount.div(exchangeRate);
  const redeemTokens = etherUnsigned(10e3);
  const redeemAmount = redeemTokens.multipliedBy(exchangeRate);
  const filename = './gasCosts.json';

  describe('OToken', () => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      oToken = await makeOToken({
        comptrollerOpts: { kind: 'bool'}, 
        interestRateModelOpts: { kind: 'white-paper'},
        exchangeRate
      });
    });

    it('first mint', async () => {
      await send(oToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(oToken, 'harnessSetBlockNumber', [41]);

      const trxReceipt = await mint(oToken, minter, mintAmount, exchangeRate);
      recordGasCost(trxReceipt.gasUsed, 'first mint', filename);
    });

    it('second mint', async () => {
      await mint(oToken, minter, mintAmount, exchangeRate);

      await send(oToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(oToken, 'harnessSetBlockNumber', [41]);

      const mint2Receipt = await mint(oToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['AccrueInterest', 'Transfer', 'Mint']);

      console.log(mint2Receipt.gasUsed);
      const opcodeCount = {};

      await saddle.trace(mint2Receipt, {
        execLog: log => {
          if (log.lastLog != undefined) {
            const key = `${log.op} @ ${log.gasCost}`;
            opcodeCount[key] = (opcodeCount[key] || 0) + 1;
          }
        }
      });

      recordGasCost(mint2Receipt.gasUsed, 'second mint', filename, opcodeCount);
    });

    it('second mint, no interest accrued', async () => {
      await mint(oToken, minter, mintAmount, exchangeRate);

      await send(oToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(oToken, 'harnessSetBlockNumber', [40]);

      const mint2Receipt = await mint(oToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['Transfer', 'Mint']);
      recordGasCost(mint2Receipt.gasUsed, 'second mint, no interest accrued', filename);

      // console.log("NO ACCRUED");
      // const opcodeCount = {};
      // await saddle.trace(mint2Receipt, {
      //   execLog: log => {
      //     opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
      //   }
      // });
      // console.log(getOpcodeDigest(opcodeCount));
    });

    it('redeem', async () => {
      await preRedeem(oToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      const trxReceipt = await quickRedeem(oToken, redeemer, redeemTokens);
      recordGasCost(trxReceipt.gasUsed, 'redeem', filename);
    });

    it.skip('print mint opcode list', async () => {
      await preMint(oToken, minter, mintAmount, mintTokens, exchangeRate);
      const trxReceipt = await quickMint(oToken, minter, mintAmount);
      const opcodeCount = {};
      await saddle.trace(trxReceipt, {
        execLog: log => {
          opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
        }
      });
      console.log(getOpcodeDigest(opcodeCount));
    });
  });

  describe.each([
    ['unitroller']
  ])('Xcn claims %s', (patch) => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      comptroller = await makeComptroller({ kind: patch });
      let interestRateModelOpts = {borrowRate: 0.000001};
      oToken = await makeOToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
      if (patch == 'unitroller') {
        await send(comptroller, '_setXcnSpeeds', [[oToken._address], [etherExp(0.05)], [etherExp(0.05)]]);
      } else {
        await send(comptroller, '_addXcnMarkets', [[oToken].map(c => c._address)]);
        await send(comptroller, 'setXcnSpeed', [oToken._address, etherExp(0.05)]);
      }
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
    });

    it(`${patch} second mint with xcn accrued`, async () => {
      await mint(oToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('Xcn balance before mint', (await xcnBalance(comptroller, minter)).toString());
      console.log('Xcn accrued before mint', (await xcnAccrued(comptroller, minter)).toString());
      const mint2Receipt = await mint(oToken, minter, mintAmount, exchangeRate);
      console.log('Xcn balance after mint', (await xcnBalance(comptroller, minter)).toString());
      console.log('Xcn accrued after mint', (await xcnAccrued(comptroller, minter)).toString());
      recordGasCost(mint2Receipt.gasUsed, `${patch} second mint with xcn accrued`, filename);
    });

    it(`${patch} claim xcn`, async () => {
      await mint(oToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('Xcn balance before claim', (await xcnBalance(comptroller, minter)).toString());
      console.log('Xcn accrued before claim', (await xcnAccrued(comptroller, minter)).toString());
      const claimReceipt = await claimXcn(comptroller, minter);
      console.log('Xcn balance after claim', (await xcnBalance(comptroller, minter)).toString());
      console.log('Xcn accrued after claim', (await xcnAccrued(comptroller, minter)).toString());
      recordGasCost(claimReceipt.gasUsed, `${patch} claim xcn`, filename);
    });
  });
});
