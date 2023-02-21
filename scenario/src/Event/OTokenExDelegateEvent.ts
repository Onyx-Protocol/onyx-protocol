import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { OToken, OTokenScenario } from '../Contract/OToken';
import { OErc721Delegate } from '../Contract/OErc721Delegate'
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
import { getOTokenExDelegateData } from '../ContractLookup';
import { buildOTokenExDelegate } from '../Builder/OTokenExDelegateBuilder';
import { verify } from '../Verify';

async function genOTokenExDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, oTokenExDelegate, delegateData } = await buildOTokenExDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added oToken ${delegateData.name} (${delegateData.contract}) at address ${oTokenExDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifyOTokenExDelegate(world: World, oTokenExDelegate: OErc721Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, oTokenExDelegate._address);
  }

  return world;
}

export function oTokenExDelegateCommands() {
  return [
    new Command<{ oTokenExDelegateParams: EventV }>(`
        #### Deploy

        * "OTokenExDelegate Deploy ...oTokenExDelegateParams" - Generates a new OTokenExDelegate
          * E.g. "OTokenExDelegate Deploy ODaiDelegate oDAIDelegate"
      `,
      "Deploy",
      [new Arg("oTokenExDelegateParams", getEventV, { variadic: true })],
      (world, from, { oTokenExDelegateParams }) => genOTokenExDelegate(world, from, oTokenExDelegateParams.val)
    ),
    new View<{ oTokenExDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "OTokenExDelegate <oTokenExDelegate> Verify apiKey:<String>" - Verifies OTokenExDelegate in Etherscan
          * E.g. "OTokenExDelegate oDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("oTokenExDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { oTokenExDelegateArg, apiKey }) => {
        let [oToken, name, data] = await getOTokenExDelegateData(world, oTokenExDelegateArg.val);

        return await verifyOTokenExDelegate(world, oToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processOTokenExDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("OTokenExDelegate", oTokenExDelegateCommands(), world, event, from);
}
