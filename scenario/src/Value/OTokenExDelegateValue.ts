import { Event } from '../Event';
import { World } from '../World';
import { OErc721Delegate } from '../Contract/OErc721Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getOTokenExDelegateAddress } from '../ContractLookup';

export async function getOTokenExDelegateV(world: World, event: Event): Promise<OErc721Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getOTokenExDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<OErc721Delegate>(world, address.val);
}

async function oTokenDelegateAddress(world: World, oTokenDelegate: OErc721Delegate): Promise<AddressV> {
  return new AddressV(oTokenDelegate._address);
}

export function oTokenExDelegateFetchers() {
  return [
    new Fetcher<{ oTokenDelegate: OErc721Delegate }, AddressV>(`
        #### Address

        * "OTokenDelegate <OTokenDelegate> Address" - Returns address of OTokenDelegate contract
          * E.g. "OTokenDelegate oDaiDelegate Address" - Returns oDaiDelegate's address
      `,
      "Address",
      [
        new Arg("oTokenDelegate", getOTokenExDelegateV)
      ],
      (world, { oTokenDelegate }) => oTokenDelegateAddress(world, oTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getOTokenExDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("OTokenDelegate", oTokenExDelegateFetchers(), world, event);
}
