import { Event } from '../Event';
import { World } from '../World';
import { NFTLiquidationProxy } from '../Contract/NFTLiquidationProxy';
import { AddressV, Value } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getNFTLiquidationProxy } from '../ContractLookup';

export async function getNFTLiquidationProxyAddress(world: World, nftLiquidationProxy: NFTLiquidationProxy): Promise<AddressV> {
  return new AddressV(nftLiquidationProxy._address);
}

async function getNFTLiquidationProxyAdmin(world: World, nftLiquidationProxy: NFTLiquidationProxy): Promise<AddressV> {
  return new AddressV(await nftLiquidationProxy.methods.admin().call());
}

async function getNFTLiquidationProxyPendingAdmin(world: World, nftLiquidationProxy: NFTLiquidationProxy): Promise<AddressV> {
  return new AddressV(await nftLiquidationProxy.methods.pendingAdmin().call());
}

async function getNFTLiquidationImplementation(world: World, nftLiquidationProxy: NFTLiquidationProxy): Promise<AddressV> {
  return new AddressV(await nftLiquidationProxy.methods.nftLiquidationImplementation().call());
}

async function getPendingNFTLiquidationImplementation(world: World, nftLiquidationProxy: NFTLiquidationProxy): Promise<AddressV> {
  return new AddressV(await nftLiquidationProxy.methods.pendingNFTLiquidationImplementation().call());
}

export function nftLiquidationProxyFetchers() {
  return [
    new Fetcher<{ nftLiquidationProxy: NFTLiquidationProxy }, AddressV>(
      `
        #### Address

        * "NFTLiquidationProxy Address" - Returns address of nftLiquidationProxy
      `,
      'Address',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true })],
      (world, { nftLiquidationProxy }) => getNFTLiquidationProxyAddress(world, nftLiquidationProxy)
    ),
    new Fetcher<{ nftLiquidationProxy: NFTLiquidationProxy }, AddressV>(
      `
        #### Admin

        * "NFTLiquidationProxy Admin" - Returns the admin of NFTLiquidationProxy contract
          * E.g. "NFTLiquidationProxy Admin" - Returns address of admin
      `,
      'Admin',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true })],
      (world, { nftLiquidationProxy }) => getNFTLiquidationProxyAdmin(world, nftLiquidationProxy)
    ),
    new Fetcher<{ nftLiquidationProxy: NFTLiquidationProxy }, AddressV>(
      `
        #### PendingAdmin

        * "NFTLiquidationProxy PendingAdmin" - Returns the pending admin of NFTLiquidationProxy contract
          * E.g. "NFTLiquidationProxy PendingAdmin" - Returns address of pendingAdmin
      `,
      'PendingAdmin',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true })],
      (world, { nftLiquidationProxy }) => getNFTLiquidationProxyPendingAdmin(world, nftLiquidationProxy)
    ),
    new Fetcher<{ nftLiquidationProxy: NFTLiquidationProxy }, AddressV>(
      `
        #### Implementation

        * "NFTLiquidationProxy Implementation" - Returns the Implementation of NFTLiquidationProxy contract
          * E.g. "NFTLiquidationProxy Implementation" - Returns address of nftLiquidationImplementation
      `,
      'Implementation',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true })],
      (world, { nftLiquidationProxy }) => getNFTLiquidationImplementation(world, nftLiquidationProxy)
    ),
    new Fetcher<{ nftLiquidationProxy: NFTLiquidationProxy }, AddressV>(
      `
        #### PendingImplementation

        * "NFTLiquidationProxy PendingImplementation" - Returns the pending implementation of NFTLiquidationProxy contract
          * E.g. "NFTLiquidationProxy PendingImplementation" - Returns address of pendingNFTLiquidationImplementation
      `,
      'PendingImplementation',
      [new Arg('nftLiquidationProxy', getNFTLiquidationProxy, { implicit: true })],
      (world, { nftLiquidationProxy }) => getPendingNFTLiquidationImplementation(world, nftLiquidationProxy)
    )
  ];
}

export async function getNFTLiquidationProxyValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>('NFTLiquidationProxy', nftLiquidationProxyFetchers(), world, event);
}
