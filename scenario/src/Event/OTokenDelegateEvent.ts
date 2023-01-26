import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { OToken, OTokenScenario } from '../Contract/OToken';
import { OErc20Delegate } from '../Contract/OErc20Delegate'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getOTokenDelegateData } from '../ContractLookup';
import { buildOTokenDelegate } from '../Builder/OTokenDelegateBuilder';
import { verify } from '../Verify';

async function genOTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, oTokenDelegate, delegateData } = await buildOTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added oToken ${delegateData.name} (${delegateData.contract}) at address ${oTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifyOTokenDelegate(world: World, oTokenDelegate: OErc20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, oTokenDelegate._address);
  }

  return world;
}

export function oTokenDelegateCommands() {
  return [
    new Command<{ oTokenDelegateParams: EventV }>(`
        #### Deploy

        * "OTokenDelegate Deploy ...oTokenDelegateParams" - Generates a new OTokenDelegate
          * E.g. "OTokenDelegate Deploy ODaiDelegate oDAIDelegate"
      `,
      "Deploy",
      [new Arg("oTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { oTokenDelegateParams }) => genOTokenDelegate(world, from, oTokenDelegateParams.val)
    ),
    new View<{ oTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "OTokenDelegate <oTokenDelegate> Verify apiKey:<String>" - Verifies OTokenDelegate in Etherscan
          * E.g. "OTokenDelegate oDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("oTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { oTokenDelegateArg, apiKey }) => {
        let [oToken, name, data] = await getOTokenDelegateData(world, oTokenDelegateArg.val);

        return await verifyOTokenDelegate(world, oToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processOTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("OTokenDelegate", oTokenDelegateCommands(), world, event, from);
}
