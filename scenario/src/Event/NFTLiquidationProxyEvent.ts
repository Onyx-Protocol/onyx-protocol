import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { NFTLiquidationProxy } from '../Contract/NFTLiquidationProxy';
import { NFTLiquidationImpl } from '../Contract/NFTLiquidationImpl';
import { invoke } from '../Invokation';
import { getEventV, getStringV, getAddressV } from '../CoreValue';
import { EventV, StringV, AddressV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { buildNFTLiquidationProxy } from '../Builder/NFTLiquidationProxyBuilder';
import { getNFTLiquidationImpl, getNFTLiquidationProxy } from '../ContractLookup';
import { verify } from '../Verify';

async function genNFTLiquidationProxy(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, nftLiquidationProxy, nftLiquidationProxyData } = await buildNFTLiquidationProxy(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added NFTLiquidationProxy (${nftLiquidationProxyData.description}) at address ${nftLiquidationProxy._address}`,
    nftLiquidationProxyData.invokation
  );

  return world;
}

async function verifyNFTLiquidationProxy(world: World, nftLiquidationProxy: NFTLiquidationProxy, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, 'NFTLiquidationProxy', 'NFTLiquidationProxy', nftLiquidationProxy._address);
  }

  return world;
}

async function acceptAdmin(world: World, from: string, nftLiquidationProxy: NFTLiquidationProxy): Promise<World> {
  let invokation = await invoke(world, nftLiquidationProxy.methods._acceptAdmin(), from);

  world = addAction(world, `Accept admin as ${from}`, invokation);

  return world;
}

async function setPendingAdmin(
  world: World,
  from: string,
  nftLiquidationProxy: NFTLiquidationProxy,
  pendingAdmin: string
): Promise<World> {
  let invokation = await invoke(
    world,
    nftLiquidationProxy.methods._setPendingAdmin(pendingAdmin),
    from
  );

  world = addAction(world, `Set pending admin to ${pendingAdmin}`, invokation);

  return world;
}

async function setPendingImpl(
  world: World,
  from: string,
  nftLiquidationProxy: NFTLiquidationProxy,
  nftLiquidationImpl: NFTLiquidationImpl
): Promise<World> {
  let invokation = await invoke(
    world,
    nftLiquidationProxy.methods._setPendingImplementation(nftLiquidationImpl._address),
    from
  );

  world = addAction(world, `Set pending nftLiquidation impl to ${nftLiquidationImpl.name}`, invokation);

  return world;
}

export function nftLiquidationProxyCommands() {
  return [
    new Command<{ nftLiquidationProxyParams: EventV }>(
      `
        #### Deploy

        * "NFTLiquidationProxy Deploy ...nftLiquidationProxyParams" - Generates a new NFTLiquidationProxy
          * E.g. "NFTLiquidationProxy Deploy"
      `,
      'Deploy',
      [new Arg('nftLiquidationProxyParams', getEventV, { variadic: true })],
      (world, from, { nftLiquidationProxyParams }) => genNFTLiquidationProxy(world, from, nftLiquidationProxyParams.val)
    ),
    new View<{ nftLiquidationProxy: NFTLiquidationProxy; apiKey: StringV }>(
      `
        #### Verify

        * "NFTLiquidationProxy Verify apiKey:<String>" - Verifies NFTLiquidationProxy in Etherscan
          * E.g. "NFTLiquidationProxy Verify "myApiKey"
      `,
      'Verify',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true }), new Arg('apiKey', getStringV)],
      (world, { nftLiquidationProxy, apiKey }) => verifyNFTLiquidationProxy(world, nftLiquidationProxy, apiKey.val)
    ),
    new Command<{ nftLiquidationProxy: NFTLiquidationProxy; pendingAdmin: AddressV }>(
      `
        #### AcceptAdmin

        * "AcceptAdmin" - Accept admin for this nftLiquidationProxy
          * E.g. "NFTLiquidationProxy AcceptAdmin"
      `,
      'AcceptAdmin',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true })],
      (world, from, { nftLiquidationProxy }) => acceptAdmin(world, from, nftLiquidationProxy)
    ),
    new Command<{ nftLiquidationProxy: NFTLiquidationProxy; pendingAdmin: AddressV }>(
      `
        #### SetPendingAdmin

        * "SetPendingAdmin admin:<Admin>" - Sets the pending admin for this nftLiquidationProxy
          * E.g. "NFTLiquidationProxy SetPendingAdmin Jared"
      `,
      'SetPendingAdmin',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true }), new Arg('pendingAdmin', getAddressV)],
      (world, from, { nftLiquidationProxy, pendingAdmin }) =>
        setPendingAdmin(world, from, nftLiquidationProxy, pendingAdmin.val)
    ),
    new Command<{ nftLiquidationProxy: NFTLiquidationProxy; nftLiquidationImpl: NFTLiquidationImpl }>(
      `
        #### SetPendingImpl

        * "SetPendingImpl impl:<Impl>" - Sets the pending nftLiquidation implementation for this nftLiquidationProxy
          * E.g. "NFTLiquidationProxy SetPendingImpl MyScenImpl" - Sets the current nftLiquidation implementation to MyScenImpl
      `,
      'SetPendingImpl',
      [
        new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true }),
        new Arg('nftLiquidationImpl', getNFTLiquidationImpl)
      ],
      (world, from, { nftLiquidationProxy, nftLiquidationImpl }) =>
        setPendingImpl(world, from, nftLiquidationProxy, nftLiquidationImpl)
    )
  ];
}

export async function processNFTLiquidationProxyEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('NFTLiquidationProxy', nftLiquidationProxyCommands(), world, event, from);
}
