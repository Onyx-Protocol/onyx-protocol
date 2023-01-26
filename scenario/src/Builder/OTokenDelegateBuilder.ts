import { Event } from '../Event';
import { World } from '../World';
import { OErc20Delegate, OErc20DelegateScenario } from '../Contract/OErc20Delegate';
import { OToken } from '../Contract/OToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const ODaiDelegateContract = getContract('ODaiDelegate');
const ODaiDelegateScenarioContract = getTestContract('ODaiDelegateScenario');
const OErc20DelegateContract = getContract('OErc20Delegate');
const OErc20DelegateScenarioContract = getTestContract('OErc20DelegateScenario');


export interface OTokenDelegateData {
  invokation: Invokation<OErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildOTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; oTokenDelegate: OErc20Delegate; delegateData: OTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, OTokenDelegateData>(
      `
        #### ODaiDelegate

        * "ODaiDelegate name:<String>"
          * E.g. "OTokenDelegate Deploy ODaiDelegate oDAIDelegate"
      `,
      'ODaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await ODaiDelegateContract.deploy<OErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'ODaiDelegate',
          description: 'Standard ODai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, OTokenDelegateData>(
      `
        #### ODaiDelegateScenario

        * "ODaiDelegateScenario name:<String>" - A ODaiDelegate Scenario for local testing
          * E.g. "OTokenDelegate Deploy ODaiDelegateScenario oDAIDelegate"
      `,
      'ODaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await ODaiDelegateScenarioContract.deploy<OErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'ODaiDelegateScenario',
          description: 'Scenario ODai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, OTokenDelegateData>(
      `
        #### OErc20Delegate

        * "OErc20Delegate name:<String>"
          * E.g. "OTokenDelegate Deploy OErc20Delegate oDAIDelegate"
      `,
      'OErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await OErc20DelegateContract.deploy<OErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'OErc20Delegate',
          description: 'Standard OErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, OTokenDelegateData>(
      `
        #### OErc20DelegateScenario

        * "OErc20DelegateScenario name:<String>" - A OErc20Delegate Scenario for local testing
          * E.g. "OTokenDelegate Deploy OErc20DelegateScenario oDAIDelegate"
      `,
      'OErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await OErc20DelegateScenarioContract.deploy<OErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'OErc20DelegateScenario',
          description: 'Scenario OErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, OTokenDelegateData>("DeployOToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const oTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    oTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['OTokenDelegate', delegateData.name],
        data: {
          address: oTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, oTokenDelegate, delegateData };
}
