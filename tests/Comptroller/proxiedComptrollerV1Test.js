const { address, etherMantissa } = require('../Utils/Ethereum');

const { makeComptroller, makeOToken, makePriceOracle } = require('../Utils/Onyx');

describe('ComptrollerV1', function() {
  let root, accounts;
  let unitroller;
  let brains;
  let oracle;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    oracle = await makePriceOracle();
    brains = await deploy('ComptrollerG1');
    unitroller = await deploy('Unitroller');
  });

  let initializeBrains = async (priceOracle, closeFactor, maxAssets) => {
    await send(unitroller, '_setPendingImplementation', [brains._address]);
    await send(brains, '_become', [unitroller._address, priceOracle._address, closeFactor, maxAssets, false]);
    return await saddle.getContractAt('ComptrollerG1', unitroller._address);
  };

  let reinitializeBrains = async () => {
    await send(unitroller, '_setPendingImplementation', [brains._address]);
    await send(brains, '_become', [unitroller._address, address(0), 0, 0, true]);
    return await saddle.getContractAt('ComptrollerG1', unitroller._address);
  };

  describe('delegating to comptroller v1', () => {
    const closeFactor = etherMantissa(0.051);
    const maxAssets = 10;
    let unitrollerAsComptroller, oToken;

    beforeEach(async () => {
      unitrollerAsComptroller = await initializeBrains(oracle, etherMantissa(0.06), 30);
      oToken = await makeOToken({ comptroller: unitrollerAsComptroller });
    });

    describe('becoming brains sets initial state', () => {
      it('reverts if this is not the pending implementation', async () => {
        await expect(
          send(brains, '_become', [unitroller._address, oracle._address, 0, 10, false])
        ).rejects.toRevert('revert change not authorized');
      });

      it('on success it sets admin to caller of constructor', async () => {
        expect(await call(unitrollerAsComptroller, 'admin')).toEqual(root);
        expect(await call(unitrollerAsComptroller, 'pendingAdmin')).toBeAddressZero();
      });

      it('on success it sets closeFactor and maxAssets as specified', async () => {
        const comptroller = await initializeBrains(oracle, closeFactor, maxAssets);
        expect(await call(comptroller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(maxAssets);
      });

      it("on reinitialization success, it doesn't set closeFactor or maxAssets", async () => {
        let comptroller = await initializeBrains(oracle, closeFactor, maxAssets);
        expect(await call(unitroller, 'comptrollerImplementation')).toEqual(brains._address);
        expect(await call(comptroller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(maxAssets);

        // Create new brains
        brains = await deploy('ComptrollerG1');
        comptroller = await reinitializeBrains();

        expect(await call(unitroller, 'comptrollerImplementation')).toEqual(brains._address);
        expect(await call(comptroller, 'closeFactorMantissa')).toEqualNumber(closeFactor);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(maxAssets);
      });

      it('reverts on invalid closeFactor', async () => {
        await send(unitroller, '_setPendingImplementation', [brains._address]);
        await expect(
          send(brains, '_become', [unitroller._address, oracle._address, 0, maxAssets, false])
        ).rejects.toRevert('revert set close factor error');
      });

      it('allows 0 maxAssets', async () => {
        const comptroller = await initializeBrains(oracle, closeFactor, 0);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(0);
      });

      it('allows 5000 maxAssets', async () => {
        // 5000 is an arbitrary number larger than what we expect to ever actually use
        const comptroller = await initializeBrains(oracle, closeFactor, 5000);
        expect(await call(comptroller, 'maxAssets')).toEqualNumber(5000);
      });
    });

    describe('_setCollateralFactor', () => {
      const half = etherMantissa(0.5),
        one = etherMantissa(1);

      it('fails if not called by admin', async () => {
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [oToken._address, half], {
            from: accounts[1]
          })
        ).toHaveTrollFailure('UNAUTHORIZED', 'SET_COLLATERAL_FACTOR_OWNER_CHECK');
      });

      it('fails if asset is not listed', async () => {
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [oToken._address, half])
        ).toHaveTrollFailure('MARKET_NOT_LISTED', 'SET_COLLATERAL_FACTOR_NO_EXISTS');
      });

      it('fails if factor is too high', async () => {
        const oToken = await makeOToken({ supportMarket: true, comptroller: unitrollerAsComptroller });
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [oToken._address, one])
        ).toHaveTrollFailure('INVALID_COLLATERAL_FACTOR', 'SET_COLLATERAL_FACTOR_VALIDATION');
      });

      it('fails if factor is set without an underlying price', async () => {
        const oToken = await makeOToken({ supportMarket: true, comptroller: unitrollerAsComptroller });
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [oToken._address, half])
        ).toHaveTrollFailure('PRICE_ERROR', 'SET_COLLATERAL_FACTOR_WITHOUT_PRICE');
      });

      it('succeeds and sets market', async () => {
        const oToken = await makeOToken({ supportMarket: true, comptroller: unitrollerAsComptroller });
        await send(oracle, 'setUnderlyingPrice', [oToken._address, 1]);
        expect(
          await send(unitrollerAsComptroller, '_setCollateralFactor', [oToken._address, half])
        ).toHaveLog('NewCollateralFactor', {
          oToken: oToken._address,
          oldCollateralFactorMantissa: '0',
          newCollateralFactorMantissa: half.toString()
        });
      });
    });

    describe('_supportMarket', () => {
      it('fails if not called by admin', async () => {
        expect(
          await send(unitrollerAsComptroller, '_supportMarket', [oToken._address], { from: accounts[1] })
        ).toHaveTrollFailure('UNAUTHORIZED', 'SUPPORT_MARKET_OWNER_CHECK');
      });

      it('fails if asset is not a OToken', async () => {
        const notAOToken = await makePriceOracle();
        await expect(send(unitrollerAsComptroller, '_supportMarket', [notAOToken._address])).rejects.toRevert();
      });

      it('succeeds and sets market', async () => {
        const result = await send(unitrollerAsComptroller, '_supportMarket', [oToken._address]);
        expect(result).toHaveLog('MarketListed', { oToken: oToken._address });
      });

      it('cannot list a market a second time', async () => {
        const result1 = await send(unitrollerAsComptroller, '_supportMarket', [oToken._address]);
        const result2 = await send(unitrollerAsComptroller, '_supportMarket', [oToken._address]);
        expect(result1).toHaveLog('MarketListed', { oToken: oToken._address });
        expect(result2).toHaveTrollFailure('MARKET_ALREADY_LISTED', 'SUPPORT_MARKET_EXISTS');
      });

      it('can list two different markets', async () => {
        const oToken1 = await makeOToken({ comptroller: unitroller });
        const oToken2 = await makeOToken({ comptroller: unitroller });
        const result1 = await send(unitrollerAsComptroller, '_supportMarket', [oToken1._address]);
        const result2 = await send(unitrollerAsComptroller, '_supportMarket', [oToken2._address]);
        expect(result1).toHaveLog('MarketListed', { oToken: oToken1._address });
        expect(result2).toHaveLog('MarketListed', { oToken: oToken2._address });
      });
    });
  });
});
