"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  etherBalance,
  etherMantissa,
  etherUnsigned,
  mergeInterface
} = require('./Ethereum');
const BigNumber = require('bignumber.js');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    return await deploy('BoolComptroller');
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller-g3') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG3');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const xcnRate = etherUnsigned(dfn(opts.xcnRate, 1e18));
    const xcnMarkets = opts.xcnMarkets || [];
    const otherMarkets = opts.otherMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address, xcnRate, xcnMarkets, otherMarkets]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = etherMantissa(1);
    const xcn = opts.xcn || await deploy('Chain');
    const xcnRate = etherUnsigned(dfn(opts.xcnRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setXcnAddress', [xcn._address]); // harness only
    await send(unitroller, 'harnessSetXcnRate', [xcnRate]);

    return Object.assign(unitroller, { priceOracle, xcn });
  }
}


async function makeLiquidationProxy(opts = {}) {
  const {
    root = saddle.account,
    kind = 'liquidationproxy'
  } = opts || {};

  if (kind == 'liquidationproxy') {
    const liquidationProxy = opts.unitroller || await deploy('NFTLiquidationProxy');
    const liquidation = await deploy('NFTLiquidation');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const liquidationIncentive = etherMantissa(1);
    
    await send(liquidationProxy, '_setPendingImplementation', [liquidation._address]);
    await send(liquidation, '_become', [liquidationProxy._address]);
    mergeInterface(liquidationProxy, liquidation);
    await send(liquidationProxy, '_setComptroller', [comptroller]);

    return Object.assign(unitroller, { priceOracle });
  }
}

async function makeOToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'oerc20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
  const decimals = etherUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'oether' ? 'oETH' : 'oOMG');
  const name = opts.name || `OToken ${symbol}`;
  const admin = opts.admin || root;

  let oToken, underlying;
  let oDelegator, oDelegatee, oDaiMaker;

  switch (kind) {
    case 'oether':
      oToken = await deploy('OEtherHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'odai':
      oDaiMaker  = await deploy('ODaiDelegateMakerHarness');
      underlying = oDaiMaker;
      oDelegatee = await deploy('ODaiDelegateHarness');
      oDelegator = await deploy('OErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          oDelegatee._address,
          encodeParameters(['address', 'address'], [oDaiMaker._address, oDaiMaker._address])
        ]
      );
      oToken = await saddle.getContractAt('ODaiDelegateHarness', oDelegator._address);
      break;
    
    case 'oxcn':
      underlying = await deploy('Chain');
      oDelegatee = await deploy('OErc20DelegateHarness');
      oDelegator = await deploy('OErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          oDelegatee._address,
          "0x0"
        ]
      );
      oToken = await saddle.getContractAt('OErc20DelegateHarness', oDelegator._address);
      break;

    case 'oerc20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      oDelegatee = await deploy('OErc20DelegateHarness');
      oDelegator = await deploy('OErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          oDelegatee._address,
          "0x0"
        ]
      );
      oToken = await saddle.getContractAt('OErc20DelegateHarness', oDelegator._address);
      break;
      
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [oToken._address]);
  }

  if (opts.addXcnMarket) {
    await send(comptroller, '_addXcnMarket', [oToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = etherMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [oToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [oToken._address, factor])).toSucceed();
  }

  return Object.assign(oToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeOTokenEx(opts = {}) {
  const {
    root = saddle.account,
    kind = 'oerc721'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = etherMantissa(1, 1);
  const decimals = etherUnsigned(dfn(opts.decimals, 0));
  const symbol = opts.symbol || 'oOMG';
  const name = opts.name || `OTokenEx ${symbol}`;
  const admin = opts.admin || root;

  let oTokenEx, underlying;
  let oDelegator, oDelegatee;

  switch (kind) {
    case 'oerc721':
    default:
      underlying = opts.underlying || await makeNFTToken(opts.underlyingOpts);
      oDelegatee = await deploy('OErc721DelegateHarness');
      oDelegator = await deploy('OErc721Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          oDelegatee._address,
          "0x0"
        ]
      );
      oTokenEx = await saddle.getContractAt('OErc721DelegateHarness', oDelegator._address);
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [oTokenEx._address]);
  }

  if (opts.underlyingPrice) {
    const price = etherMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [oTokenEx._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [oTokenEx._address, factor])).toSucceed();
  }

  return Object.assign(oTokenEx, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    const jump = etherMantissa(dfn(opts.jump, 0));
    const kink = etherMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = etherUnsigned(dfn(opts.quantity, 1e25));
    const decimals = etherUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }
}

async function makeNFTToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc721'
  } = opts || {};

  if (kind == 'erc721') {
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc721 ${symbol}`;
    return await deploy('ERC721Harness', [name, symbol]);
  }
}

async function balanceOf(token, account) {
  return etherUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return etherUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(oToken, account) {
  const { principal, interestIndex } = await call(oToken, 'harnessAccountBorrows', [account]);
  return { principal: etherUnsigned(principal), interestIndex: etherUnsigned(interestIndex) };
}

async function totalBorrows(oToken) {
  return etherUnsigned(await call(oToken, 'totalBorrows'));
}

async function totalReserves(oToken) {
  return etherUnsigned(await call(oToken, 'totalReserves'));
}

async function enterMarkets(oTokens, from) {
  return await send(oTokens[0].comptroller, 'enterMarkets', [oTokens.map(c => c._address)], { from });
}

async function fastForward(oToken, blocks = 5) {
  return await send(oToken, 'harnessFastForward', [blocks]);
}

async function setBalance(oToken, account, balance) {
  return await send(oToken, 'harnessSetBalance', [account, balance]);
}

async function setEtherBalance(oEther, balance) {
  const current = await etherBalance(oEther._address);
  const root = saddle.account;
  expect(await send(oEther, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(oEther, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(oTokens, accounts) {
  const balances = {};
  for (let oToken of oTokens) {
    const oBalances = balances[oToken._address] = {};
    for (let account of accounts) {
      oBalances[account] = {
        eth: await etherBalance(account),
        cash: oToken.underlying && await balanceOf(oToken.underlying, account),
        tokens: await balanceOf(oToken, account),
        borrows: (await borrowSnapshot(oToken, account)).principal
      };
    }
    oBalances[oToken._address] = {
      eth: await etherBalance(oToken._address),
      cash: oToken.underlying && await balanceOf(oToken.underlying, oToken._address),
      tokens: await totalSupply(oToken),
      borrows: await totalBorrows(oToken),
      reserves: await totalReserves(oToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let oToken, account, key, diff;
    if (delta.length == 4) {
      ([oToken, account, key, diff] = delta);
    } else {
      ([oToken, key, diff] = delta);
      account = oToken._address;
    }
    balances[oToken._address][account][key] = new BigNumber(balances[oToken._address][account][key]).plus(diff);
  }
  return balances;
}


async function preApprove(oToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(oToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(oToken.underlying, 'approve', [oToken._address, amount], { from });
}

async function preApproveNFT(oToken, from, tokenId, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(oToken.underlying, 'harnessMint', [from, tokenId], { from })).toSucceed();
  }

  return send(oToken.underlying, 'harnessSetApprovalForAll', [from, oToken._address, true], { from });
}

async function quickMint(oToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(oToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(oToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(oToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(oToken, 'mint', [mintAmount], { from: minter });
}

async function quickMintNFT(oToken, minter, tokenId, opts = {}) {
  // make sure to accrue interest
  await fastForward(oToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApproveNFT(oToken, minter, tokenId, opts)).toSucceed();
  }

  return send(oToken, 'mint', [tokenId], { from: minter });
}

async function quickBorrow(oToken, minter, borrowAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(oToken, 1);

  if (dfn(opts.exchangeRate))
    expect(await send(oToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();

  return send(oToken, 'borrow', [borrowAmount], { from: minter });
}


async function preSupply(oToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(oToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(oToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(oToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(oToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(oToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(oToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(oToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemNFT(oToken, redeemer, redeemTokenIndex) {
  await fastForward(oToken, 1);

  return send(oToken, 'redeem', [redeemTokenIndex], { from: redeemer });
}

async function quickRedeemUnderlying(oToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(oToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(oToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(oToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(oToken, price) {
  return send(oToken.comptroller.priceOracle, 'setUnderlyingPrice', [oToken._address, etherMantissa(price)]);
}

async function setBorrowRate(oToken, rate) {
  return send(oToken.interestRateModel, 'setBorrowRate', [etherMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(etherUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(etherUnsigned));
}

async function pretendBorrow(oToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(oToken, 'harnessSetTotalBorrows', [etherUnsigned(principalRaw)]);
  await send(oToken, 'harnessSetAccountBorrows', [borrower, etherUnsigned(principalRaw), etherMantissa(accountIndex)]);
  await send(oToken, 'harnessSetBorrowIndex', [etherMantissa(marketIndex)]);
  await send(oToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(oToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeOToken,
  makeOTokenEx,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,
  makeNFTToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,

  preApprove,
  preApproveNFT,
  quickMint,
  quickMintNFT,
  quickBorrow,

  preSupply,
  quickRedeem,
  quickRedeemNFT,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow
};
