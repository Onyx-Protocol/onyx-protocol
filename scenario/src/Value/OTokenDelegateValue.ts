import { Event } from '../Event';
import { World } from '../World';
import { OErc20Delegate } from '../Contract/OErc20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getOTokenDelegateAddress } from '../ContractLookup';

export async function getOTokenDelegateV(world: World, event: Event): Promise<OErc20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getOTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<OErc20Delegate>(world, address.val);
}

async function oTokenDelegateAddress(world: World, oTokenDelegate: OErc20Delegate): Promise<AddressV> {
  return new AddressV(oTokenDelegate._address);
}

export function oTokenDelegateFetchers() {
  return [
    new Fetcher<{ oTokenDelegate: OErc20Delegate }, AddressV>(`
        #### Address

        * "OTokenDelegate <OTokenDelegate> Address" - Returns address of OTokenDelegate contract
          * E.g. "OTokenDelegate oDaiDelegate Address" - Returns oDaiDelegate's address
      `,
      "Address",
      [
        new Arg("oTokenDelegate", getOTokenDelegateV)
      ],
      (world, { oTokenDelegate }) => oTokenDelegateAddress(world, oTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getOTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("OTokenDelegate", oTokenDelegateFetchers(), world, event);
}
