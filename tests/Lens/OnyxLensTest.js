const {
  address,
  encodeParameters,
  etherExp,
} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeOToken,
} = require('../Utils/Onyx');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('OnyxLens', () => {
  let onyxLens;
  let acct;

  beforeEach(async () => {
    onyxLens = await deploy('OnyxLens');
    acct = accounts[0];
  });

  describe('oTokenMetadata', () => {
    it('is correct for a oErc20', async () => {
      let oErc20 = await makeOToken();
      const ss = await call(oErc20.underlying, 'decimals', [])
      expect(
        cullTuple(await call(onyxLens, 'oTokenMetadata', [oErc20._address]))
      ).toEqual(
        {
          oToken: oErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(oErc20, 'underlying', []),
          oTokenDecimals: "8",
          underlyingDecimals: "18",
          xcnSupplySpeed: "0",
          xcnBorrowSpeed: "0",
          borrowCap: "0",
          dailyBorrowXcn: "0",
          dailySupplyXcn: "0"
        }
      );
    });

    it('is correct for oEth', async () => {
      let oEth = await makeOToken({kind: 'oether'});
      expect(
        cullTuple(await call(onyxLens, 'oTokenMetadata', [oEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        oToken: oEth._address,
        oTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
        xcnSupplySpeed: "0",
        xcnBorrowSpeed: "0",
        borrowCap: "0",
        dailyBorrowXcn: "0",
        dailySupplyXcn: "0"
      });
    });
    it('is correct for oErc20 with set xcn speeds', async () => {
      let comptroller = await makeComptroller();
      let oErc20 = await makeOToken({comptroller, supportMarket: true});
      await send(comptroller, '_setXcnSpeeds', [[oErc20._address], [etherExp(0.25)], [etherExp(0.75)]]);
      expect(
        cullTuple(await call(onyxLens, 'oTokenMetadata', [oErc20._address]))
      ).toEqual(
        {
          oToken: oErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(oErc20, 'underlying', []),
          oTokenDecimals: "8",
          underlyingDecimals: "18",
          xcnSupplySpeed: "250000000000000000",
          xcnBorrowSpeed: "750000000000000000",
          borrowCap: "0",
          dailyBorrowXcn: "4320000000000000000000",
          dailySupplyXcn: "1440000000000000000000"
        }
      );
    });
  });

  describe('oTokenMetadataAll', () => {
    it('is correct for a oErc20 and oEther', async () => {
      let oErc20 = await makeOToken();
      let oEth = await makeOToken({kind: 'oether'});
      expect(
        (await call(onyxLens, 'oTokenMetadataAll', [[oErc20._address, oEth._address]])).map(cullTuple)
      ).toEqual([
        {
          oToken: oErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(oErc20, 'underlying', []),
          oTokenDecimals: "8",
          underlyingDecimals: "18",
          xcnSupplySpeed: "0",
          xcnBorrowSpeed: "0",
          borrowCap: "0",
          dailyBorrowXcn: "0",
          dailySupplyXcn: "0"
        },
        {
          borrowRatePerBlock: "0",
          oToken: oEth._address,
          oTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
          xcnSupplySpeed: "0",
          xcnBorrowSpeed: "0",
          borrowCap: "0",
          dailyBorrowXcn: "0",
          dailySupplyXcn: "0"
        }
      ]);
    });
  });

  describe('oTokenBalances', () => {
    it('is correct for oERC20', async () => {
      let oErc20 = await makeOToken();
      expect(
        cullTuple(await call(onyxLens, 'oTokenBalances', [oErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          oToken: oErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for oETH', async () => {
      let oEth = await makeOToken({kind: 'oether'});
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(onyxLens, 'oTokenBalances', [oEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          oToken: oEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      );
    });
  });

  describe('oTokenBalancesAll', () => {
    it('is correct for oEth and oErc20', async () => {
      let oErc20 = await makeOToken();
      let oEth = await makeOToken({kind: 'oether'});
      let ethBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(onyxLens, 'oTokenBalancesAll', [[oErc20._address, oEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          oToken: oErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          oToken: oEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      ]);
    })
  });

  describe('oTokenUnderlyingPrice', () => {
    it('gets correct price for oErc20', async () => {
      let oErc20 = await makeOToken();
      expect(
        cullTuple(await call(onyxLens, 'oTokenUnderlyingPrice', [oErc20._address]))
      ).toEqual(
        {
          oToken: oErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for oEth', async () => {
      let oEth = await makeOToken({kind: 'oether'});
      expect(
        cullTuple(await call(onyxLens, 'oTokenUnderlyingPrice', [oEth._address]))
      ).toEqual(
        {
          oToken: oEth._address,
          underlyingPrice: "0",
        }
      );
    });
  });

  describe('oTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let oErc20 = await makeOToken();
      let oEth = await makeOToken({kind: 'oether'});
      expect(
        (await call(onyxLens, 'oTokenUnderlyingPriceAll', [[oErc20._address, oEth._address]])).map(cullTuple)
      ).toEqual([
        {
          oToken: oErc20._address,
          underlyingPrice: "0",
        },
        {
          oToken: oEth._address,
          underlyingPrice: "0",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(onyxLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });
});
