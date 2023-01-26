import {Event} from '../Event';
import {addAction, World} from '../World';
import {PriceOracleProxy} from '../Contract/PriceOracleProxy';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';
import {getAddressV} from '../CoreValue';
import {AddressV} from '../Value';

const PriceOracleProxyContract = getContract("PriceOracleProxy");

export interface PriceOracleProxyData {
  invokation?: Invokation<PriceOracleProxy>,
  contract?: PriceOracleProxy,
  description: string,
  address?: string,
  oETH: string,
  oUSDC: string,
  oDAI: string
}

export async function buildPriceOracleProxy(world: World, from: string, event: Event): Promise<{world: World, priceOracleProxy: PriceOracleProxy, invokation: Invokation<PriceOracleProxy>}> {
  const fetchers = [
    new Fetcher<{guardian: AddressV, priceOracle: AddressV, oETH: AddressV, oUSDC: AddressV, oSAI: AddressV, oDAI: AddressV, oUSDT: AddressV}, PriceOracleProxyData>(`
        #### Price Oracle Proxy

        * "Deploy <Guardian:Address> <PriceOracle:Address> <oETH:Address> <oUSDC:Address> <oSAI:Address> <oDAI:Address> <oUSDT:Address>" - The Price Oracle which proxies to a backing oracle
        * E.g. "PriceOracleProxy Deploy Admin (PriceOracle Address) oETH oUSDC oSAI oDAI oUSDT"
      `,
      "PriceOracleProxy",
      [
        new Arg("guardian", getAddressV),
        new Arg("priceOracle", getAddressV),
        new Arg("oETH", getAddressV),
        new Arg("oUSDC", getAddressV),
        new Arg("oSAI", getAddressV),
        new Arg("oDAI", getAddressV),
        new Arg("oUSDT", getAddressV)
      ],
      async (world, {guardian, priceOracle, oETH, oUSDC, oSAI, oDAI, oUSDT}) => {
        return {
          invokation: await PriceOracleProxyContract.deploy<PriceOracleProxy>(world, from, [guardian.val, priceOracle.val, oETH.val, oUSDC.val, oSAI.val, oDAI.val, oUSDT.val]),
          description: "Price Oracle Proxy",
          oETH: oETH.val,
          oUSDC: oUSDC.val,
          oSAI: oSAI.val,
          oDAI: oDAI.val,
          oUSDT: oUSDT.val
        };
      },
      {catchall: true}
    )
  ];

  let priceOracleProxyData = await getFetcherValue<any, PriceOracleProxyData>("DeployPriceOracleProxy", fetchers, world, event);
  let invokation = priceOracleProxyData.invokation!;
  delete priceOracleProxyData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const priceOracleProxy = invokation.value!;
  priceOracleProxyData.address = priceOracleProxy._address;

  world = await storeAndSaveContract(
    world,
    priceOracleProxy,
    'PriceOracleProxy',
    invokation,
    [
      { index: ['PriceOracleProxy'], data: priceOracleProxyData }
    ]
  );

  return {world, priceOracleProxy, invokation};
}
