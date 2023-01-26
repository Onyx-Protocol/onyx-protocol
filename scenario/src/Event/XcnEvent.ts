import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { Xcn, XcnScenario } from '../Contract/Xcn';
import { buildXcn } from '../Builder/XcnBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getXcn } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genXcn(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, xcn, tokenData } = await buildXcn(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed Xcn (${xcn.name}) to address ${xcn._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyXcn(world: World, xcn: Xcn, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, xcn._address);
  }

  return world;
}

async function approve(world: World, from: string, xcn: Xcn, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xcn.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved Xcn token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, xcn: Xcn, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xcn.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Xcn tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, xcn: Xcn, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xcn.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} Xcn tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, xcn: XcnScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xcn.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Xcn tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, xcn: XcnScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xcn.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} Xcn tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, xcn: Xcn, account: string): Promise<World> {
  let invokation = await invoke(world, xcn.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  xcn: Xcn,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set Xcn blockNumber to ${blockNumber.show()}`,
    await invoke(world, xcn.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function xcnCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new Xcn token
          * E.g. "Xcn Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genXcn(world, from, params.val)
    ),

    new View<{ xcn: Xcn, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<Xcn> Verify apiKey:<String> contractName:<String>=Xcn" - Verifies Xcn token in Etherscan
          * E.g. "Xcn Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("Xcn") })
      ],
      async (world, { xcn, apiKey, contractName }) => {
        return await verifyXcn(world, xcn, apiKey.val, xcn.name, contractName.val)
      }
    ),

    new Command<{ xcn: Xcn, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "Xcn Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "Xcn Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xcn, spender, amount }) => {
        return approve(world, from, xcn, spender.val, amount)
      }
    ),

    new Command<{ xcn: Xcn, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "Xcn Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "Xcn Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xcn, recipient, amount }) => transfer(world, from, xcn, recipient.val, amount)
    ),

    new Command<{ xcn: Xcn, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "Xcn TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "Xcn TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xcn, owner, spender, amount }) => transferFrom(world, from, xcn, owner.val, spender.val, amount)
    ),

    new Command<{ xcn: XcnScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "Xcn TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "Xcn TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xcn, recipients, amount }) => transferScenario(world, from, xcn, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ xcn: XcnScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "Xcn TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "Xcn TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xcn, froms, amount }) => transferFromScenario(world, from, xcn, froms.map(_from => _from.val), amount)
    ),

    new Command<{ xcn: Xcn, account: AddressV }>(`
        #### Delegate

        * "Xcn Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "Xcn Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { xcn, account }) => delegate(world, from, xcn, account.val)
    ),
    new Command<{ xcn: Xcn, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the Xcn Harness
      * E.g. "Xcn SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('xcn', getXcn, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { xcn, blockNumber }) => setBlockNumber(world, from, xcn, blockNumber)
      )
  ];
}

export async function processXcnEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Xcn", xcnCommands(), world, event, from);
}
