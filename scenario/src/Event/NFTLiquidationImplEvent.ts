import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { NFTLiquidationImpl } from '../Contract/NFTLiquidationImpl';
import { NFTLiquidationProxy } from '../Contract/NFTLiquidationProxy';
import { invoke } from '../Invokation';
import { getAddressV, getArrayV, getEventV, getExpNumberV, getNumberV, getStringV, getCoreValue } from '../CoreValue';
import { ArrayV, AddressV, EventV, NumberV, StringV } from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { buildNFTLiquidationImpl } from '../Builder/NFTLiquidationImplBuilder';
import { getNFTLiquidationImpl, getNFTLiquidationImplData, getNFTLiquidationProxy } from '../ContractLookup';
import { verify } from '../Verify';
import { mergeContractABI } from '../Networks';
import { encodedNumber } from '../Encoding';
import { encodeABI } from '../Utils';

async function genNFTLiquidationImpl(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, nftLiquidationImpl, nftLiquidationImplData } = await buildNFTLiquidationImpl(
    world,
    from,
    params
  );
  world = nextWorld;

  world = addAction(
    world,
    `Added NFTLiquidation Implementation (${nftLiquidationImplData.description}) at address ${nftLiquidationImpl._address}`,
    nftLiquidationImplData.invokation
  );

  return world;
}

async function mergeABI(
  world: World,
  from: string,
  nftLiquidationImpl: NFTLiquidationImpl,
  nftLiquidationProxy: NFTLiquidationProxy
): Promise<World> {
  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'NFTLiquidation', nftLiquidationProxy, nftLiquidationProxy.name, nftLiquidationImpl.name);
  }

  return world;
}

async function become(
  world: World,
  from: string,
  nftLiquidationImpl: NFTLiquidationImpl,
  nftLiquidationProxy: NFTLiquidationProxy
): Promise<World> {
  let invokation = await invoke(
    world,
    nftLiquidationImpl.methods._become(nftLiquidationProxy._address),
    from
  );

  if (!world.dryRun) {
    // Skip this specifically on dry runs since it's likely to crash due to a number of reasons
    world = await mergeContractABI(world, 'NFTLiquidation', nftLiquidationProxy, nftLiquidationProxy.name, nftLiquidationImpl.name);
  }

  world = addAction(world, `Become ${nftLiquidationProxy._address}'s NFTLiquidation Impl`, invokation);

  return world;
}

async function verifyNFTLiquidationImpl(
  world: World,
  nftLiquidationImpl: NFTLiquidationImpl,
  name: string,
  contract: string,
  apiKey: string
): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, nftLiquidationImpl._address);
  }

  return world;
}

export function nftLiquidationImplCommands() {
  return [
    new Command<{ nftLiquidationImplParams: EventV }>(
      `
        #### Deploy

        * "NFTLiquidationImpl Deploy ...nftLiquidationImplParams" - Generates a new NFTLiquidation Implementation
          * E.g. "NFTLiquidationImpl Deploy MyScen Scenario"
      `,
      'Deploy',
      [new Arg('nftLiquidationImplParams', getEventV, { variadic: true })],
      (world, from, { nftLiquidationImplParams }) => genNFTLiquidationImpl(world, from, nftLiquidationImplParams.val)
    ),
    new View<{ nftLiquidationImplArg: StringV; apiKey: StringV }>(
      `
        #### Verify

        * "NFTLiquidationImpl <Impl> Verify apiKey:<String>" - Verifies NFTLiquidation Implementation in Etherscan
          * E.g. "NFTLiquidationImpl Verify "myApiKey"
      `,
      'Verify',
      [new Arg('nftLiquidationImplArg', getStringV), new Arg('apiKey', getStringV)],
      async (world, { nftLiquidationImplArg, apiKey }) => {
        let [nftLiquidationImpl, name, data] = await getNFTLiquidationImplData(world, nftLiquidationImplArg.val);

        return await verifyNFTLiquidationImpl(world, nftLiquidationImpl, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{
      nftLiquidationProxy: NFTLiquidationProxy;
      nftLiquidationImpl: NFTLiquidationImpl;
    }>(
      `
        #### Become

        * "NFTLiquidationImpl <Impl> Become <Rate> <XcnMarkets> <OtherMarkets>" - Become the nftLiquidation, if possible.
          * E.g. "NFTLiquidationImpl MyImpl Become 0.1e18 [oDAI, oETH, oUSDC]
      `,
      'Become',
      [
        new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true }),
        new Arg('nftLiquidationImpl', getNFTLiquidationImpl)
      ],
      (world, from, { nftLiquidationProxy, nftLiquidationImpl }) => {
        return become(world, from, nftLiquidationImpl, nftLiquidationProxy)
      },
      { namePos: 1 }
    ),

    new Command<{
      nftLiquidationProxy: NFTLiquidationProxy;
      nftLiquidationImpl: NFTLiquidationImpl;
    }>(
      `
        #### MergeABI

        * "NFTLiquidationImpl <Impl> MergeABI" - Merges the ABI, as if it was a become.
          * E.g. "NFTLiquidationImpl MyImpl MergeABI
      `,
      'MergeABI',
      [
        new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true }),
        new Arg('nftLiquidationImpl', getNFTLiquidationImpl)
      ],
      (world, from, { nftLiquidationProxy, nftLiquidationImpl }) => mergeABI(world, from, nftLiquidationImpl, nftLiquidationProxy),
      { namePos: 1 }
    ),
  ];
}

export async function processNFTLiquidationImplEvent(
  world: World,
  event: Event,
  from: string | null
): Promise<World> {
  return await processCommandEvent<any>('NFTLiquidationImpl', nftLiquidationImplCommands(), world, event, from);
}
