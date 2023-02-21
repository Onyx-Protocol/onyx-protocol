const {
  makeComptroller,
  makeOToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint,
  quickBorrow,
  enterMarkets
} = require('../Utils/Onyx');
const {
  etherExp,
  etherDouble,
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const xcnRate = etherUnsigned(1e18);

const xcnInitialIndex = 1e36;

async function xcnAccrued(comptroller, user) {
  return etherUnsigned(await call(comptroller, 'xcnAccrued', [user]));
}

async function xcnBalance(comptroller, user) {
  return etherUnsigned(await call(comptroller.xcn, 'balanceOf', [user]))
}

async function totalXcnAccrued(comptroller, user) {
  return (await xcnAccrued(comptroller, user)).plus(await xcnBalance(comptroller, user));
}

describe('Flywheel upgrade', () => {
  describe('becomes the comptroller', () => {
    it('adds the xcn markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let xcnMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeOToken({comptroller: unitroller, supportMarket: true});
      }));
      xcnMarkets = xcnMarkets.map(c => c._address);
      unitroller = await makeComptroller({kind: 'unitroller-g3', unitroller, xcnMarkets});
      expect(await call(unitroller, 'getXcnMarkets')).toEqual(xcnMarkets);
    });

    it('adds the other markets', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g2'});
      let allMarkets = await Promise.all([1, 2, 3].map(async _ => {
        return makeOToken({comptroller: unitroller, supportMarket: true});
      }));
      allMarkets = allMarkets.map(c => c._address);
      unitroller = await makeComptroller({
        kind: 'unitroller-g3',
        unitroller,
        xcnMarkets: allMarkets.slice(0, 1),
        otherMarkets: allMarkets.slice(1)
      });
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets);
      expect(await call(unitroller, 'getXcnMarkets')).toEqual(allMarkets.slice(0, 1));
    });

    it('_supportMarket() adds to all markets, and only once', async () => {
      let root = saddle.accounts[0];
      let unitroller = await makeComptroller({kind: 'unitroller-g3'});
      let allMarkets = [];
      for (let _ of Array(10)) {
        allMarkets.push(await makeOToken({comptroller: unitroller, supportMarket: true}));
      }
      expect(await call(unitroller, 'getAllMarkets')).toEqual(allMarkets.map(c => c._address));
      expect(
        makeComptroller({
          kind: 'unitroller-g3',
          unitroller,
          otherMarkets: [allMarkets[0]._address]
        })
      ).rejects.toRevert('revert market already added');
    });
  });
});

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, cLOW, oREP, oZRX, oEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    cLOW = await makeOToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    oREP = await makeOToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    oZRX = await makeOToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    oEVIL = await makeOToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
    cUSD = await makeOToken({comptroller, supportMarket: true, underlyingPrice: 1, collateralFactor: 0.5, interestRateModelOpts});
  });

  describe('_grantXcn()', () => {
    beforeEach(async () => {
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
    });

    it('should award xcn if called by admin', async () => {
      const tx = await send(comptroller, '_grantXcn', [a1, 100]);
      expect(tx).toHaveLog('XcnGranted', {
        recipient: a1,
        amount: 100
      });
    });

    it('should revert if not called by admin', async () => {
      await expect(
        send(comptroller, '_grantXcn', [a1, 100], {from: a1})
      ).rejects.toRevert('revert only admin can grant xcn');
    });

    it('should revert if insufficient xcn', async () => {
      await expect(
        send(comptroller, '_grantXcn', [a1, etherUnsigned(1e20)])
      ).rejects.toRevert('revert insufficient xcn for grant');
    });
  });

  describe('getXcnMarkets()', () => {
    it('should return the xcn markets', async () => {
      for (let mkt of [cLOW, oREP, oZRX]) {
        await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      expect(await call(comptroller, 'getXcnMarkets')).toEqual(
        [cLOW, oREP, oZRX].map((c) => c._address)
      );
    });
  });

  describe('_setXcnSpeeds()', () => {
    it('should update market index when calling setXcnSpeed', async () => {
      const mkt = oREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);

      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(1)], [etherExp(0.5)]]);

      const {index, block} = await call(comptroller, 'xcnSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a xcn market if called by admin', async () => {
      for (let mkt of [cLOW, oREP, oZRX]) {
        await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      const tx = await send(comptroller, '_setXcnSpeeds', [[cLOW._address], [0], [0]]);
      expect(await call(comptroller, 'getXcnMarkets')).toEqual(
        [oREP, oZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('XcnBorrowSpeedUpdated', {
        oToken: cLOW._address,
        newSpeed: 0
      });
      expect(tx).toHaveLog('XcnSupplySpeedUpdated', {
        oToken: cLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a xcn market from middle of array', async () => {
      for (let mkt of [cLOW, oREP, oZRX]) {
        await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      await send(comptroller, '_setXcnSpeeds', [[oREP._address], [0], [0]]);
      expect(await call(comptroller, 'getXcnMarkets')).toEqual(
        [cLOW, oZRX].map((c) => c._address)
      );
    });

    it('should not drop a xcn market unless called by admin', async () => {
      for (let mkt of [cLOW, oREP, oZRX]) {
        await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      }
      await expect(
        send(comptroller, '_setXcnSpeeds', [[cLOW._address], [0], [etherExp(0.5)]], {from: a1})
      ).rejects.toRevert('revert only admin can set xcn speed');
    });

    it('should not add non-listed markets', async () => {
      const oBAT = await makeOToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddXcnMarkets', [[oBAT._address]])
      ).rejects.toRevert('revert xcn market is not listed');

      const markets = await call(comptroller, 'getXcnMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateXcnBorrowIndex()', () => {
    it('should calculate xcn borrower index correctly', async () => {
      const mkt = oREP;
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [etherUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateXcnBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        xcnAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + xcnAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'xcnBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update xcnBorrowState index if oToken not in XCN markets', async () => {
      const mkt = await makeOToken({
        comptroller: comptroller,
        supportMarket: true,
        addXcnMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateXcnBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'xcnBorrowState', [mkt._address]);
      expect(index).toEqualNumber(xcnInitialIndex);
      expect(block).toEqualNumber(100);
      const supplySpeed = await call(comptroller, 'xcnSupplySpeeds', [mkt._address]);
      expect(supplySpeed).toEqualNumber(0);
      const borrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [mkt._address]);
      expect(borrowSpeed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = oREP;
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessUpdateXcnBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'xcnBorrowState', [mkt._address]);
      expect(index).toEqualNumber(xcnInitialIndex);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if xcn speed is 0', async () => {
      const mkt = oREP;
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0)], [etherExp(0)]]);
      await send(comptroller, 'harnessUpdateXcnBorrowIndex', [
        mkt._address,
        etherExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'xcnBorrowState', [mkt._address]);
      expect(index).toEqualNumber(xcnInitialIndex);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateXcnSupplyIndex()', () => {
    it('should calculate xcn supplier index correctly', async () => {
      const mkt = oREP;
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateXcnSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        xcnAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += xcnAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'xcnSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-XCN markets', async () => {
      const mkt = await makeOToken({
        comptroller: comptroller,
        supportMarket: true,
        addXcnMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateXcnSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'xcnSupplyState', [mkt._address]);
      expect(index).toEqualNumber(xcnInitialIndex);
      expect(block).toEqualNumber(100);
      const supplySpeed = await call(comptroller, 'xcnSupplySpeeds', [mkt._address]);
      expect(supplySpeed).toEqualNumber(0);
      const borrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [mkt._address]);
      expect(borrowSpeed).toEqualNumber(0);
      // otoken could have no xcn speed or xcn supplier state if not in xcn markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = oREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [etherUnsigned(10e18)]);
      await send(comptroller, '_setXcnSpeeds', [[mkt._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessUpdateXcnSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'xcnSupplyState', [mkt._address]);
      expect(index).toEqualNumber(xcnInitialIndex);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const compRemaining = xcnRate.multipliedBy(100)
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshXcnSpeeds');

      await quickMint(cLOW, a2, etherUnsigned(10e18));
      await quickMint(cLOW, a3, etherUnsigned(15e18));

      const a2Accrued0 = await totalXcnAccrued(comptroller, a2);
      const a3Accrued0 = await totalXcnAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(cLOW, a2);
      const a3Balance0 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(cLOW, 'transfer', [a2, a3Balance0.minus(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalXcnAccrued(comptroller, a2);
      const a3Accrued1 = await totalXcnAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(cLOW, a2);
      const a3Balance1 = await balanceOf(cLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateXcnSupplyIndex', [cLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(cLOW, 'transfer', [a3, a2Balance1.minus(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalXcnAccrued(comptroller, a2);
      const a3Accrued2 = await totalXcnAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.minus(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.minus(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(200000);
      expect(txT1.gasUsed).toBeGreaterThan(140000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerXcn()', () => {

    it('should update borrow index checkpoint but not xcnAccrued for first time user', async () => {
      const mkt = oREP;
      await send(comptroller, "setXcnBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setXcnBorrowerIndex", [mkt._address, root, etherUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerXcn", [mkt._address, root, etherExp(1.1)]);
      expect(await call(comptroller, "xcnAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "xcnBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer xcn and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = oREP;
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e18), etherExp(1)]);
      await send(comptroller, "setXcnBorrowState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setXcnBorrowerIndex", [mkt._address, a1, etherDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 xcnBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 XCN
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerXcn", [mkt._address, a1, etherUnsigned(1.1e18)]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerXcn', {
        oToken: mkt._address,
        borrower: a1,
        xcnDelta: etherUnsigned(25e18).toFixed(),
        xcnBorrowIndex: etherDouble(6).toFixed()
      });
    });

    it('should not transfer xcn automatically', async () => {
      const mkt = oREP;
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, etherUnsigned(5.5e17), etherExp(1)]);
      await send(comptroller, "setXcnBorrowState", [mkt._address, etherDouble(1.0019), 10]);
      await send(comptroller, "setXcnBorrowerIndex", [mkt._address, a1, etherDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < xcnClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerXcn", [mkt._address, a1, etherExp(1.1)]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-XCN market', async () => {
      const mkt = await makeOToken({
        comptroller: comptroller,
        supportMarket: true,
        addXcnMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerXcn", [mkt._address, a1, etherExp(1.1)]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'xcnBorrowerIndex', [mkt._address, a1])).toEqualNumber(xcnInitialIndex);
    });
  });

  describe('distributeSupplierXcn()', () => {
    it('should transfer xcn and update supply index correctly for first time user', async () => {
      const mkt = oREP;
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setXcnSupplyState", [mkt._address, etherDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 xcnSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 XCN:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierXcn", [mkt._address, a1]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierXcn', {
        oToken: mkt._address,
        supplier: a1,
        xcnDelta: etherUnsigned(25e18).toFixed(),
        xcnSupplyIndex: etherDouble(6).toFixed()
      });
    });

    it('should update xcn accrued and supply index for repeat user', async () => {
      const mkt = oREP;
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e18)]);
      await send(comptroller, "setXcnSupplyState", [mkt._address, etherDouble(6), 10]);
      await send(comptroller, "setXcnSupplierIndex", [mkt._address, a1, etherDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

      await send(comptroller, "harnessDistributeAllSupplierXcn", [mkt._address, a1]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when xcnAccrued below threshold', async () => {
      const mkt = oREP;
      await send(comptroller.xcn, 'transfer', [comptroller._address, etherUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, etherUnsigned(5e17)]);
      await send(comptroller, "setXcnSupplyState", [mkt._address, etherDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierXcn", [mkt._address, a1]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-XCN market', async () => {
      const mkt = await makeOToken({
        comptroller: comptroller,
        supportMarket: true,
        addXcnMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierXcn", [mkt._address, a1]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'xcnBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferXcn', () => {
    it('should transfer xcn accrued when amount is above threshold', async () => {
      const compRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const xcnBalancePre = await xcnBalance(comptroller, a1);
      const tx0 = await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      const tx1 = await send(comptroller, 'setXcnAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferXcn', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await xcnAccrued(comptroller, a1);
      const xcnBalancePost = await xcnBalance(comptroller, a1);
      expect(xcnBalancePre).toEqualNumber(0);
      expect(xcnBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when xcn accrued is below threshold', async () => {
      const compRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const xcnBalancePre = await call(comptroller.xcn, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      const tx1 = await send(comptroller, 'setXcnAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferXcn', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await xcnAccrued(comptroller, a1);
      const xcnBalancePost = await xcnBalance(comptroller, a1);
      expect(xcnBalancePre).toEqualNumber(0);
      expect(xcnBalancePost).toEqualNumber(0);
    });

    it('should not transfer xcn if xcn accrued is greater than xcn remaining', async () => {
      const compRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const xcnBalancePre = await xcnBalance(comptroller, a1);
      const tx0 = await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      const tx1 = await send(comptroller, 'setXcnAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferXcn', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await xcnAccrued(comptroller, a1);
      const xcnBalancePost = await xcnBalance(comptroller, a1);
      expect(xcnBalancePre).toEqualNumber(0);
      expect(xcnBalancePost).toEqualNumber(0);
    });
  });

  describe('claimXcn', () => {
    it('should accrue xcn and then transfer xcn accrued', async () => {
      const compRemaining = xcnRate.multipliedBy(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, '_setXcnSpeeds', [[cLOW._address], [etherExp(0.5)], [etherExp(0.5)]]);
      await send(comptroller, 'harnessRefreshXcnSpeeds');
      const supplySpeed = await call(comptroller, 'xcnSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [cLOW._address]);
      const a2AccruedPre = await xcnAccrued(comptroller, a2);
      const xcnBalancePre = await xcnBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimXcn', [a2]);
      const a2AccruedPost = await xcnAccrued(comptroller, a2);
      const xcnBalancePost = await xcnBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(500000);
      expect(supplySpeed).toEqualNumber(xcnRate);
      expect(borrowSpeed).toEqualNumber(xcnRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(xcnBalancePre).toEqualNumber(0);
      expect(xcnBalancePost).toEqualNumber(xcnRate.multipliedBy(deltaBlocks).minus(1)); // index is 8333...
    });

    it('should accrue xcn and then transfer xcn accrued in a single market', async () => {
      const compRemaining = xcnRate.multipliedBy(100), mintAmount = etherUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshXcnSpeeds');
      const supplySpeed = await call(comptroller, 'xcnSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [cLOW._address]);
      const a2AccruedPre = await xcnAccrued(comptroller, a2);
      const xcnBalancePre = await xcnBalance(comptroller, a2);
      await quickMint(cLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimXcn', [a2, [cLOW._address]]);
      const a2AccruedPost = await xcnAccrued(comptroller, a2);
      const xcnBalancePost = await xcnBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(170000);
      expect(supplySpeed).toEqualNumber(xcnRate);
      expect(borrowSpeed).toEqualNumber(xcnRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(xcnBalancePre).toEqualNumber(0);
      expect(xcnBalancePost).toEqualNumber(xcnRate.multipliedBy(deltaBlocks).minus(1)); // index is 8333...
    });

    it('should claim when xcn accrued is below threshold', async () => {
      const compRemaining = etherExp(1), accruedAmt = etherUnsigned(0.0009e18)
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      await send(comptroller, 'setXcnAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimXcn', [a1, [cLOW._address]]);
      expect(await xcnAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xcnBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeOToken({comptroller});
      await expect(
        send(comptroller, 'claimXcn', [a1, [cNOT._address]])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('claimXcn batch', () => {
    it('should revert when claiming xcn from non-listed market', async () => {
      const compRemaining = xcnRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessRefreshXcnSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimXcn', [claimAccts, [cLOW._address, oEVIL._address], true, true])).rejects.toRevert('revert market must be listed');
    });

    it('should claim the expected amount when holders and otokens arg is duplicated', async () => {
      const compRemaining = xcnRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshXcnSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimXcn', [[...claimAccts, ...claimAccts], [cLOW._address, cLOW._address], false, true]);
      // xcn distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'xcnSupplierIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await xcnBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims xcn for multiple suppliers only', async () => {
      const compRemaining = xcnRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10);
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(cLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(cLOW.underlying, 'approve', [cLOW._address, mintAmount], { from });
        send(cLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(cLOW, root, 1, 1, etherExp(10));
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshXcnSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimXcn', [claimAccts, [cLOW._address], false, true]);
      // xcn distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'xcnSupplierIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(1.125));
        expect(await xcnBalance(comptroller, acct)).toEqualNumber(etherExp(1.25));
      }
    });

    it('claims xcn for multiple borrowers only, primes uninitiated', async () => {
      const compRemaining = xcnRate.multipliedBy(100), deltaBlocks = 10, mintAmount = etherExp(10), borrowAmt = etherExp(1), borrowIdx = etherExp(1)
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(cLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(cLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      await send(comptroller, 'harnessRefreshXcnSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimXcn', [claimAccts, [cLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'xcnBorrowerIndex', [cLOW._address, acct])).toEqualNumber(etherDouble(2.25));
        expect(await call(comptroller, 'xcnSupplierIndex', [cLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeOToken({comptroller});
      await expect(
        send(comptroller, 'claimXcn', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert market must be listed');
    });
  });

  describe('harnessRefreshXcnSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshXcnSpeeds');
      const supplySpeed = await call(comptroller, 'xcnSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [cLOW._address]);
      expect(supplySpeed).toEqualNumber(0);
      expect(borrowSpeed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshXcnSpeeds');
      const supplySpeed = await call(comptroller, 'xcnSupplySpeeds', [cLOW._address]);
      const borrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [cLOW._address]);
      expect(supplySpeed).toEqualNumber(xcnRate);
      expect(borrowSpeed).toEqualNumber(xcnRate);
      expect(tx).toHaveLog(['XcnBorrowSpeedUpdated', 0], {
        oToken: cLOW._address,
        newSpeed: borrowSpeed
      });
      expect(tx).toHaveLog(['XcnSupplySpeedUpdated', 0], {
        oToken: cLOW._address,
        newSpeed: supplySpeed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(cLOW, a1, 1, 1, 100);
      await pretendBorrow(oZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address, oZRX._address]]);
      await send(comptroller, 'harnessRefreshXcnSpeeds');
      const supplySpeed1 = await call(comptroller, 'xcnSupplySpeeds', [cLOW._address]);
      const borrowSpeed1 = await call(comptroller, 'xcnBorrowSpeeds', [cLOW._address]);
      const supplySpeed2 = await call(comptroller, 'xcnSupplySpeeds', [oREP._address]);
      const borrowSpeed2 = await call(comptroller, 'xcnBorrowSpeeds', [oREP._address]);
      const supplySpeed3 = await call(comptroller, 'xcnSupplySpeeds', [oZRX._address]);
      const borrowSpeed3 = await call(comptroller, 'xcnBorrowSpeeds', [oZRX._address]);
      expect(supplySpeed1).toEqualNumber(xcnRate.dividedBy(4));
      expect(borrowSpeed1).toEqualNumber(xcnRate.dividedBy(4));
      expect(supplySpeed2).toEqualNumber(0);
      expect(borrowSpeed2).toEqualNumber(0);
      expect(supplySpeed3).toEqualNumber(xcnRate.dividedBy(4).multipliedBy(3));
      expect(borrowSpeed3).toEqualNumber(xcnRate.dividedBy(4).multipliedBy(3));
    });
  });

  describe('harnessSetXcnSpeeds', () => {
    it('should correctly set differing XCN supply and borrow speeds', async () => {
      const desiredXcnSupplySpeed = 3;
      const desiredXcnBorrowSpeed = 20;
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address]]);
      const tx = await send(comptroller, '_setXcnSpeeds', [[cLOW._address], [desiredXcnSupplySpeed], [desiredXcnBorrowSpeed]]);
      expect(tx).toHaveLog(['XcnBorrowSpeedUpdated', 0], {
        oToken: cLOW._address,
        newSpeed: desiredXcnBorrowSpeed
      });
      expect(tx).toHaveLog(['XcnSupplySpeedUpdated', 0], {
        oToken: cLOW._address,
        newSpeed: desiredXcnSupplySpeed
      });
      const currentXcnSupplySpeed = await call(comptroller, 'xcnSupplySpeeds', [cLOW._address]);
      const currentXcnBorrowSpeed = await call(comptroller, 'xcnBorrowSpeeds', [cLOW._address]);
      expect(currentXcnSupplySpeed).toEqualNumber(desiredXcnSupplySpeed);
      expect(currentXcnBorrowSpeed).toEqualNumber(desiredXcnBorrowSpeed);
    });

    it('should correctly get differing XCN supply and borrow speeds for 4 assets', async () => {
      const oBAT = await makeOToken({ comptroller, supportMarket: true });
      const oDAI = await makeOToken({ comptroller, supportMarket: true });

      const borrowSpeed1 = 5;
      const supplySpeed1 = 10;

      const borrowSpeed2 = 0;
      const supplySpeed2 = 100;

      const borrowSpeed3 = 0;
      const supplySpeed3 = 0;

      const borrowSpeed4 = 13;
      const supplySpeed4 = 0;

      await send(comptroller, 'harnessAddXcnMarkets', [[oREP._address, oZRX._address, oBAT._address, oDAI._address]]);
      await send(comptroller, '_setXcnSpeeds', [[oREP._address, oZRX._address, oBAT._address, oDAI._address], [supplySpeed1, supplySpeed2, supplySpeed3, supplySpeed4], [borrowSpeed1, borrowSpeed2, borrowSpeed3, borrowSpeed4]]);

      const currentSupplySpeed1 = await call(comptroller, 'xcnSupplySpeeds', [oREP._address]);
      const currentBorrowSpeed1 = await call(comptroller, 'xcnBorrowSpeeds', [oREP._address]);
      const currentSupplySpeed2 = await call(comptroller, 'xcnSupplySpeeds', [oZRX._address]);
      const currentBorrowSpeed2 = await call(comptroller, 'xcnBorrowSpeeds', [oZRX._address]);
      const currentSupplySpeed3 = await call(comptroller, 'xcnSupplySpeeds', [oBAT._address]);
      const currentBorrowSpeed3 = await call(comptroller, 'xcnBorrowSpeeds', [oBAT._address]);
      const currentSupplySpeed4 = await call(comptroller, 'xcnSupplySpeeds', [oDAI._address]);
      const currentBorrowSpeed4 = await call(comptroller, 'xcnBorrowSpeeds', [oDAI._address]);

      expect(currentSupplySpeed1).toEqualNumber(supplySpeed1);
      expect(currentBorrowSpeed1).toEqualNumber(borrowSpeed1);
      expect(currentSupplySpeed2).toEqualNumber(supplySpeed2);
      expect(currentBorrowSpeed2).toEqualNumber(borrowSpeed2);
      expect(currentSupplySpeed3).toEqualNumber(supplySpeed3);
      expect(currentBorrowSpeed3).toEqualNumber(borrowSpeed3);
      expect(currentSupplySpeed4).toEqualNumber(supplySpeed4);
      expect(currentBorrowSpeed4).toEqualNumber(borrowSpeed4);
    });

    const checkAccrualsBorrowAndSupply = async (xcnSupplySpeed, xcnBorrowSpeed) => {
      const mintAmount = etherUnsigned(1000e18), borrowAmount = etherUnsigned(1e18), borrowCollateralAmount = etherUnsigned(1000e18), compRemaining = xcnRate.multipliedBy(100), deltaBlocks = 10;

      // Transfer XCN to the comptroller
      await send(comptroller.xcn, 'transfer', [comptroller._address, compRemaining], {from: root});

      // Setup comptroller
      await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address, cUSD._address]]);

      // Set xcn speeds to 0 while we setup
      await send(comptroller, '_setXcnSpeeds', [[cLOW._address, cUSD._address], [0, 0], [0, 0]]);

      // a2 - supply
      await quickMint(cLOW, a2, mintAmount); // a2 is the supplier

      // a1 - borrow (with supplied collateral)
      await quickMint(cUSD, a1, borrowCollateralAmount);
      await enterMarkets([cUSD], a1);
      await quickBorrow(cLOW, a1, borrowAmount); // a1 is the borrower

      // Initialize xcn speeds
      await send(comptroller, '_setXcnSpeeds', [[cLOW._address], [xcnSupplySpeed], [xcnBorrowSpeed]]);

      // Get initial XCN balances
      const a1TotalXcnPre = await totalXcnAccrued(comptroller, a1);
      const a2TotalXcnPre = await totalXcnAccrued(comptroller, a2);

      // Start off with no XCN accrued and no XCN balance
      expect(a1TotalXcnPre).toEqualNumber(0);
      expect(a2TotalXcnPre).toEqualNumber(0);

      // Fast forward blocks
      await fastForward(comptroller, deltaBlocks);

      // Accrue XCN
      await send(comptroller, 'claimXcn', [[a1, a2], [cLOW._address], true, true]);

      // Get accrued XCN balances
      const a1TotalXcnPost = await totalXcnAccrued(comptroller, a1);
      const a2TotalXcnPost = await totalXcnAccrued(comptroller, a2);

      // check accrual for borrow
      expect(a1TotalXcnPost).toEqualNumber(Number(xcnBorrowSpeed) > 0 ? xcnBorrowSpeed.multipliedBy(deltaBlocks).minus(1) : 0);

      // check accrual for supply
      expect(a2TotalXcnPost).toEqualNumber(Number(xcnSupplySpeed) > 0 ? xcnSupplySpeed.multipliedBy(deltaBlocks) : 0);
    };

    it('should accrue xcn correctly with only supply-side rewards', async () => {
      await checkAccrualsBorrowAndSupply(/* supply speed */ etherExp(0.5), /* borrow speed */ 0);
    });

    it('should accrue xcn correctly with only borrow-side rewards', async () => {
      await checkAccrualsBorrowAndSupply(/* supply speed */ 0, /* borrow speed */ etherExp(0.5));
    });
  });

  describe('harnessAddXcnMarkets', () => {
    it('should correctly add a xcn market if called by admin', async () => {
      const oBAT = await makeOToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddXcnMarkets', [[cLOW._address, oREP._address, oZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddXcnMarkets', [[oBAT._address]]);
      const markets = await call(comptroller, 'getXcnMarkets');
      expect(markets).toEqual([cLOW, oREP, oZRX, oBAT].map((c) => c._address));
      expect(tx2).toHaveLog('XcnBorrowSpeedUpdated', {
        oToken: oBAT._address,
        newSpeed: 1
      });
      expect(tx2).toHaveLog('XcnSupplySpeedUpdated', {
        oToken: oBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = cLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = etherUnsigned(1.5e36);

      await send(comptroller, "harnessAddXcnMarkets", [[mkt]]);
      await send(comptroller, "setXcnSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setXcnBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setXcnSpeeds", [[mkt], [0], [0]]);
      await send(comptroller, "harnessAddXcnMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'xcnSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toFixed());

      const borrowState = await call(comptroller, 'xcnBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toFixed());
    });
  });
});
