import { Event } from '../Event';
import { addAction, World } from '../World';
import { NFTLiquidationImpl } from '../Contract/NFTLiquidationImpl';
import { Invokation, invoke } from '../Invokation';
import { getAddressV, getExpNumberV, getNumberV, getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const NFTLiquidationContract = getContract('NFTLiquidation');
const NFTLiquidationScenarioContract = getTestContract('NFTLiquidationScenario');

export interface NFTLiquidationImplData {
  invokation: Invokation<NFTLiquidationImpl>;
  name: string;
  contract: string;
  description: string;
}

export async function buildNFTLiquidationImpl(
  world: World,
  from: string,
  event: Event
): Promise<{ world: World; nftLiquidationImpl: NFTLiquidationImpl; nftLiquidationImplData: NFTLiquidationImplData }> {
  const fetchers = [
    new Fetcher<{ name: StringV }, NFTLiquidationImplData>(
      `
        #### Scenario

        * "Scenario name:<String>" - The NFTLiquidation Scenario for local testing
          * E.g. "NFTLiquidationImpl Deploy Scenario MyScen"
      `,
      'Scenario',
      [new Arg('name', getStringV)],
      async (world, { name }) => ({
        invokation: await NFTLiquidationScenarioContract.deploy<NFTLiquidationImpl>(world, from, []),
        name: name.val,
        contract: 'NFTLiquidationScenario',
        description: 'Scenario NFTLiquidation Impl'
      })
    ),

    new Fetcher<{ name: StringV }, NFTLiquidationImplData>(
      `
        #### Standard

        * "Standard name:<String>" - The standard NFTLiquidation contract
          * E.g. "NFTLiquidation Deploy Standard MyStandard"
      `,
      'Standard',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        return {
          invokation: await NFTLiquidationContract.deploy<NFTLiquidationImpl>(world, from, []),
          name: name.val,
          contract: 'NFTLiquidation',
          description: 'Standard NFTLiquidation Impl'
        };
      }
    ),

    new Fetcher<{ name: StringV }, NFTLiquidationImplData>(
      `
        #### Default

        * "name:<String>" - The standard NFTLiquidation contract
          * E.g. "NFTLiquidationImpl Deploy MyDefault"
      `,
      'Default',
      [new Arg('name', getStringV)],
      async (world, { name }) => {
        if (world.isLocalNetwork()) {
          // Note: we're going to use the scenario contract as the standard deployment on local networks
          return {
            invokation: await NFTLiquidationScenarioContract.deploy<NFTLiquidationImpl>(world, from, []),
            name: name.val,
            contract: 'NFTLiquidationScenario',
            description: 'Scenario NFTLiquidation Impl'
          };
        } else {
          return {
            invokation: await NFTLiquidationContract.deploy<NFTLiquidationImpl>(world, from, []),
            name: name.val,
            contract: 'NFTLiquidation',
            description: 'Standard NFTLiquidation Impl'
          };
        }
      },
      { catchall: true }
    )
  ];

  let nftLiquidationImplData = await getFetcherValue<any, NFTLiquidationImplData>(
    'DeployNFTLiquidationImpl',
    fetchers,
    world,
    event
  );
  let invokation = nftLiquidationImplData.invokation;
  delete nftLiquidationImplData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const nftLiquidationImpl = invokation.value!;

  world = await storeAndSaveContract(world, nftLiquidationImpl, nftLiquidationImplData.name, invokation, [
    {
      index: ['NFTLiquidation', nftLiquidationImplData.name],
      data: {
        address: nftLiquidationImpl._address,
        contract: nftLiquidationImplData.contract,
        description: nftLiquidationImplData.description
      }
    }
  ]);

  return { world, nftLiquidationImpl, nftLiquidationImplData };
}
