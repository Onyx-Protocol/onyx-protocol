import {Event} from '../Event';
import {World} from '../World';
import {NFTLiquidationImpl} from '../Contract/NFTLiquidationImpl';
import {
  getAddressV
} from '../CoreValue';
import {
  AddressV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getNFTLiquidationImpl} from '../ContractLookup';

export async function getNFTLiquidationImplAddress(world: World, nftLiquidationImpl: NFTLiquidationImpl): Promise<AddressV> {
  return new AddressV(nftLiquidationImpl._address);
}

export function nftLiquidationImplFetchers() {
  return [
    new Fetcher<{nftLiquidationImpl: NFTLiquidationImpl}, AddressV>(`
        #### Address

        * "NFTLiquidationImpl Address" - Returns address of nftLiquidation implementation
      `,
      "Address",
      [new Arg("nftLiquidationImpl", getNFTLiquidationImpl)],
      (world, {nftLiquidationImpl}) => getNFTLiquidationImplAddress(world, nftLiquidationImpl),
      {namePos: 1}
    )
  ];
}

export async function getNFTLiquidationImplValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("NFTLiquidationImpl", nftLiquidationImplFetchers(), world, event);
}
