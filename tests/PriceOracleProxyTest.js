const BigNumber = require('bignumber.js');

const {
  address,
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makeOToken,
  makePriceOracle,
} = require('./Utils/Onyx');

describe('PriceOracleProxy', () => {
  let root, accounts;
  let oracle, backingOracle, oEth, oUsdc, oSai, oDai, oUsdt, cOther;
  let daiOracleKey = address(2);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    oEth = await makeOToken({kind: "oether", comptrollerOpts: {kind: "v1-no-proxy"}, supportMarket: true});
    oUsdc = await makeOToken({comptroller: oEth.comptroller, supportMarket: true});
    oSai = await makeOToken({comptroller: oEth.comptroller, supportMarket: true});
    oDai = await makeOToken({comptroller: oEth.comptroller, supportMarket: true});
    oUsdt = await makeOToken({comptroller: oEth.comptroller, supportMarket: true});
    cOther = await makeOToken({comptroller: oEth.comptroller, supportMarket: true});

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxy',
      [
        root,
        backingOracle._address,
        oEth._address,
        oUsdc._address,
        oSai._address,
        oDai._address,
        oUsdt._address
      ]
     );
  });

  describe("constructor", () => {
    it("sets address of guardian", async () => {
      let configuredGuardian = await call(oracle, "guardian");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of v1 oracle", async () => {
      let configuredOracle = await call(oracle, "v1PriceOracle");
      expect(configuredOracle).toEqual(backingOracle._address);
    });

    it("sets address of oEth", async () => {
      let configuredOEther = await call(oracle, "oEthAddress");
      expect(configuredOEther).toEqual(oEth._address);
    });

    it("sets address of oUSDC", async () => {
      let configuredCUSD = await call(oracle, "oUsdcAddress");
      expect(configuredCUSD).toEqual(oUsdc._address);
    });

    it("sets address of oSAI", async () => {
      let configuredOSAI = await call(oracle, "oSaiAddress");
      expect(configuredOSAI).toEqual(oSai._address);
    });

    it("sets address of oDAI", async () => {
      let configuredODAI = await call(oracle, "oDaiAddress");
      expect(configuredODAI).toEqual(oDai._address);
    });

    it("sets address of oUSDT", async () => {
      let configuredOUSDT = await call(oracle, "oUsdtAddress");
      expect(configuredOUSDT).toEqual(oUsdt._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setAndVerifyBackingPrice = async (oToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [oToken._address, etherMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [oToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);;
    };

    it("always returns 1e18 for oEth", async () => {
      await readAndVerifyProxyPrice(oEth, 1);
    });

    it("uses address(1) for USDC and address(2) for odai", async () => {
      await send(backingOracle, "setDirectPrice", [address(1), etherMantissa(5e12)]);
      await send(backingOracle, "setDirectPrice", [address(2), etherMantissa(8)]);
      await readAndVerifyProxyPrice(oDai, 8);
      await readAndVerifyProxyPrice(oUsdc, 5e12);
      await readAndVerifyProxyPrice(oUsdt, 5e12);
    });

    it("proxies for whitelisted tokens", async () => {
      await setAndVerifyBackingPrice(cOther, 11);
      await readAndVerifyProxyPrice(cOther, 11);

      await setAndVerifyBackingPrice(cOther, 37);
      await readAndVerifyProxyPrice(cOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makeOToken({comptroller: oEth.comptroller});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });

    it("correctly handle setting SAI price", async () => {
      await send(backingOracle, "setDirectPrice", [daiOracleKey, etherMantissa(0.01)]);

      await readAndVerifyProxyPrice(oDai, 0.01);
      await readAndVerifyProxyPrice(oSai, 0.01);

      await send(oracle, "setSaiPrice", [etherMantissa(0.05)]);

      await readAndVerifyProxyPrice(oDai, 0.01);
      await readAndVerifyProxyPrice(oSai, 0.05);

      await expect(send(oracle, "setSaiPrice", [1])).rejects.toRevert("revert SAI price may only be set once");
    });

    it("only guardian may set the sai price", async () => {
      await expect(send(oracle, "setSaiPrice", [1], {from: accounts[0]})).rejects.toRevert("revert only guardian may set the SAI price");
    });

    it("sai price must be bounded", async () => {
      await expect(send(oracle, "setSaiPrice", [etherMantissa(10)])).rejects.toRevert("revert SAI price must be < 0.1 ETH");
    });
});
});
