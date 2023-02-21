import { Event } from '../Event';
import { World } from '../World';
import { OErc721Delegate, OErc721DelegateScenario } from '../Contract/OErc721Delegate';
import { OToken } from '../Contract/OToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const OErc721DelegateContract = getContract('OErc721DelegateScenario');
const OErc721DelegateContractScenario = getContract('OErc721DelegateScenario');

export interface OTokenExDelegateData {
  invokation: Invokation<OErc721Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildOTokenExDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; oTokenExDelegate: OErc721Delegate; delegateData: OTokenExDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, OTokenExDelegateData>(
      `
        #### OErc721Delegate

        * "OErc721Delegate name:<String>"
          * E.g. "OTokenExDelegate Deploy OErc721Delegate oBAYCDelegate"
      `,
      'OErc721Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await OErc721DelegateContract.deploy<OErc721Delegate>(world, from, []),
          name: name.val,
          contract: 'OErc721Delegate',
          description: 'Standard OErc721 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, OTokenExDelegateData>(
      `
        #### OErc721DelegateScenario

        * "OErc721DelegateScenario name:<String>"
          * E.g. "OTokenExDelegate Deploy OErc721Delegate oBAYCDelegate"
      `,
      'OErc721DelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await OErc721DelegateContractScenario.deploy<OErc721DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'OErc721Delegate',
          description: 'Standard OErc721 Delegate'
        };
      }
    ),
  ];

  let delegateData = await getFetcherValue<any, OTokenExDelegateData>("DeployOTokenEx", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const oTokenExDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    oTokenExDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['OTokenExDelegate', delegateData.name],
        data: {
          address: oTokenExDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, oTokenExDelegate, delegateData };
}
