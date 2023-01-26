import { Event } from '../Event';
import { World, addAction } from '../World';
import { Xcn, XcnScenario } from '../Contract/Xcn';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const XcnContract = getContract('Xcn');
const XcnScenarioContract = getContract('XcnScenario');

export interface TokenData {
  invokation: Invokation<Xcn>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildXcn(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; xcn: Xcn; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "Xcn Deploy Scenario account:<Address>" - Deploys Scenario Xcn Token
        * E.g. "Xcn Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await XcnScenarioContract.deploy<XcnScenario>(world, from, [account.val]),
          contract: 'XcnScenario',
          symbol: 'COMP',
          name: 'Xcnound Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Xcn

      * "Xcn Deploy account:<Address>" - Deploys Xcn Token
        * E.g. "Xcn Deploy Geoff"
    `,
      'Xcn',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await XcnScenarioContract.deploy<XcnScenario>(world, from, [account.val]),
            contract: 'XcnScenario',
            symbol: 'COMP',
            name: 'Xcnound Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await XcnContract.deploy<Xcn>(world, from, [account.val]),
            contract: 'Xcn',
            symbol: 'COMP',
            name: 'Xcnound Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployXcn", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const xcn = invokation.value!;
  tokenData.address = xcn._address;

  world = await storeAndSaveContract(
    world,
    xcn,
    'Xcn',
    invokation,
    [
      { index: ['Xcn'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, xcn, tokenData };
}
