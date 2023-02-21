import {Event} from '../Event';
import {addAction, World} from '../World';
import {Erc721} from '../Contract/Erc721';
import {invoke} from '../Invokation';
import {buildErc721} from '../Builder/Erc721Builder';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getNumberV,
  getStringV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV} from '../Value';
import {getErc721V} from '../Value/Erc721Value';
import {verify} from '../Verify';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {OTokenErrorReporter} from '../ErrorReporter';
import {encodedNumber} from '../Encoding';
import {getErc721Data} from '../ContractLookup';

async function genToken(world: World, from: string, params: Event): Promise<World> {
  let {world: newWorld, erc721, tokenData} = await buildErc721(world, from, params);
  world = newWorld;

  world = addAction(
    world,
    `Added ERC-20 token ${tokenData.symbol} (${tokenData.description}) at address ${erc721._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyErc721(world: World, erc721: Erc721, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, erc721._address);
  }

  return world;
}

async function approve(world: World, from: string, erc721: Erc721, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, erc721.methods.approve(address, amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Approved ${erc721.name} ERC-20 token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function setApprovalForAll(world: World, from: string, erc721: Erc721, to: string, approved: boolean): Promise<World> {
  let invokation = await invoke(world, erc721.methods.setApprovalForAll(to, approved), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Approved ${erc721.name} ERC-721 token`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, erc721: Erc721, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, erc721.methods.transferFrom(owner, spender, amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} ERC-20 tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function harnessMint(world: World, from: string, erc721: Erc721, to: string, tokenId: NumberV): Promise<World> {
  let invokation = await invoke(world, erc721.methods.harnessMint(to, tokenId.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `"Minted ${tokenId.show()} to ${to}`,
    invokation
  );

  return world;
}

async function harnessSetFailTransferFromAddress(world: World, from: string, erc721: Erc721, src: string, _fail: boolean): Promise<World> {
  let invokation = await invoke(world, erc721.methods.harnessSetFailTransferFromAddress(src, _fail), from, OTokenErrorReporter);

  world = addAction(
    world,
    `"Make ${src} fail to transfer from`,
    invokation
  );

  return world;
}

async function harnessSetFailTransferToAddress(world: World, to: string, erc721: Erc721, src: string, _fail: boolean): Promise<World> {
  let invokation = await invoke(world, erc721.methods.harnessSetFailTransferToAddress(src, _fail), to, OTokenErrorReporter);

  world = addAction(
    world,
    `"Make ${src} fail to transfer to`,
    invokation
  );

  return world;
}

export function erc721Commands() {
  return [
    new Command<{erc721Params: EventV}>(`
        #### Deploy

        * "Erc721 Deploy ...erc721Params" - Generates a new ERC-20 token by name
          * E.g. "Erc721 Deploy BAYC ..."
      `,
      "Deploy",
      [new Arg("erc721Params", getEventV, {variadic: true})],
      (world, from, {erc721Params}) => genToken(world, from, erc721Params.val)
    ),

    new View<{erc721Arg: StringV, apiKey: StringV}>(`
        #### Verify

        * "Erc721 <erc721> Verify apiKey:<String>" - Verifies Erc721 in Etherscan
          * E.g. "Erc721 BAYC Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("erc721Arg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, {erc721Arg, apiKey}) => {
        let [erc721, name, data] = await getErc721Data(world, erc721Arg.val);

        return await verifyErc721(world, erc721, name, data.get('contract')!, apiKey.val);
      },
      {namePos: 1}
    ),

    new Command<{erc721: Erc721, spender: AddressV, amount: NumberV}>(`
        #### Approve

        * "Erc721 <Erc721> Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "Erc721 BAYC Approve oBAYC 1.0e18"
      `,
      "Approve",
      [
        new Arg("erc721", getErc721V),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, {erc721, spender, amount}) => {
        return approve(world, from, erc721, spender.val, amount)
      },
      {namePos: 1}
    ),

    new Command<{erc721: Erc721, to: AddressV, isApproved: BoolV}>(`
        #### ApprovalForAll

        * "Erc721 <Erc721> ApprovalForAll to:<Address> <IsApproved>" - Adds an allowance between user and address
          * E.g. "Erc721 BAYC ApprovalForAll oBAYC 1.0e18"
      `,
      "ApprovalForAll",
      [
        new Arg("erc721", getErc721V),
        new Arg("to", getAddressV),
        new Arg("isApproved", getBoolV)
      ],
      (world, from, {erc721, to, isApproved}) => {
        return setApprovalForAll(world, from, erc721, to.val, isApproved.val)
      },
      {namePos: 1}
    ),

    new Command<{erc721: Erc721, recipient: AddressV, tokenId: NumberV}>(`
        #### Faucet

        * "Erc721 <Erc721> Faucet recipient:<User> <TokenId>" - Adds an arbitrary balance to given user
          * E.g. "Erc721 BAYC Faucet Geoff 1"
      `,
      "Faucet",
      [
        new Arg("erc721", getErc721V),
        new Arg("recipient", getAddressV),
        new Arg("tokenId", getNumberV)
      ],
      (world, from, {erc721, recipient, tokenId}) => {
        return harnessMint(world, from, erc721, recipient.val, tokenId)
      },
      {namePos: 1}
    ),
    new Command<{erc721: Erc721, owner: AddressV, spender: AddressV, amount: NumberV}>(`
        #### TransferFrom

        * "Erc721 <Erc721> TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "Erc721 BAYC TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("erc721", getErc721V),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, {erc721, owner, spender, amount}) => transferFrom(world, from, erc721, owner.val, spender.val, amount),
      {namePos: 1}
    ),
    new Command<{erc721: Erc721, src: AddressV, fail: BoolV}>(`
        #### harnessSetFailTransferFromAddress

        * "Erc721 <Erc721> harnessSetFailTransferFromAddress src:<User> <Fail>" - Make address fail to transfer from
          * E.g. "Erc721 BAYC harnessSetFailTransferFromAddress Geoff true"
      `,
      "harnessSetFailTransferFromAddress",
      [
        new Arg("erc721", getErc721V),
        new Arg("src", getAddressV),
        new Arg("fail", getBoolV)
      ],
      (world, from, {erc721, src, fail}) => harnessSetFailTransferFromAddress(world, from, erc721, src.val, fail.val),
      {namePos: 1}
    ),
    new Command<{erc721: Erc721, dst: AddressV, fail: BoolV}>(`
        #### harnessSetFailTransferToAddress

        * "Erc721 <Erc721> harnessSetFailTransferToAddress dst:<User> <Fail>" - Make address fail to transfer to
          * E.g. "Erc721 BAYC harnessSetFailTransferToAddress Geoff true"
      `,
      "harnessSetFailTransferToAddress",
      [
        new Arg("erc721", getErc721V),
        new Arg("dst", getAddressV),
        new Arg("fail", getBoolV)
      ],
      (world, from, {erc721, dst, fail}) => harnessSetFailTransferToAddress(world, from, erc721, dst.val, fail.val),
      {namePos: 1}
    )
  ];
}

export async function processErc721Event(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("Erc721", erc721Commands(), world, event, from);
}
