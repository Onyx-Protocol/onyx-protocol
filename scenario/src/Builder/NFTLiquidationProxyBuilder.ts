import {Event} from '../Event';
import {addAction, World} from '../World';
import {NFTLiquidationProxy} from '../Contract/NFTLiquidationProxy';
import {Invokation} from '../Invokation';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract} from '../Contract';

const NFTLiquidationProxyContract = getContract("NFTLiquidationProxy");

export interface NFTLiquidationProxyData {
  invokation: Invokation<NFTLiquidationProxy>,
  description: string,
  address?: string
}

export async function buildNFTLiquidationProxy(world: World, from: string, event: Event): Promise<{world: World, nftLiquidationProxy: NFTLiquidationProxy, nftLiquidationProxyData: NFTLiquidationProxyData}> {
  const fetchers = [
    new Fetcher<{}, NFTLiquidationProxyData>(`
        #### NFTLiquidationProxy

        * "" - The Upgradable NFTLiquidation
          * E.g. "NFTLiquidationProxy Deploy"
      `,
      "NFTLiquidationProxy",
      [],
      async (world, {}) => {
        return {
          invokation: await NFTLiquidationProxyContract.deploy<NFTLiquidationProxy>(world, from, []),
          description: "NFTLiquidationProxy"
        };
      },
      {catchall: true}
    )
  ];

  let nftLiquidationProxyData = await getFetcherValue<any, NFTLiquidationProxyData>("DeployNFTLiquidationProxy", fetchers, world, event);
  let invokation = nftLiquidationProxyData.invokation;
  delete nftLiquidationProxyData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const nftLiquidationProxy = invokation.value!;
  nftLiquidationProxyData.address = nftLiquidationProxy._address;

  world = await storeAndSaveContract(
    world,
    nftLiquidationProxy,
    'NFTLiquidationProxy',
    invokation,
    [
      { index: ['NFTLiquidationProxy'], data: nftLiquidationProxyData }
    ]
  );

  return {world, nftLiquidationProxy, nftLiquidationProxyData};
}
