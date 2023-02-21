import {Event} from '../Event';
import {World} from '../World';
import {Erc721} from '../Contract/Erc721';
import {getErc721Address, getWorldContractByAddress} from '../ContractLookup';
import {
  getAddressV,
  getCoreValue,
  mapValue,
} from '../CoreValue';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {
  AddressV,
  NumberV,
  Value,
  StringV
} from '../Value';

export async function getErc721Name(world: World, erc721: Erc721): Promise<StringV> {
  return new StringV(await erc721.methods.name().call());
}

export async function getErc721Symbol(world: World, erc721: Erc721): Promise<StringV> {
  return new StringV(await erc721.methods.symbol().call());
}

async function getTotalSupply(world: World, erc721: Erc721): Promise<NumberV> {
  return new NumberV(await erc721.methods.totalSupply().call());
}

async function getTokenBalance(world: World, erc721: Erc721, address: string): Promise<NumberV> {
  return new NumberV(await erc721.methods.balanceOf(address).call());
}

export async function getErc721V(world: World, event: Event): Promise<Erc721> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getErc721Address(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<Erc721>(world, address.val);
}

export function erc721Fetchers() {
  return [
    new Fetcher<{erc721: Erc721}, AddressV>(`
        #### Address

        * "Erc721 <Erc721> Address" - Returns address of ERC-721 contract
          * E.g. "Erc721 BAYC Address" - Returns BAYC's address
      `,
      "Address",
      [
        new Arg("erc721", getErc721V)
      ],
      async (world, {erc721}) => new AddressV(erc721._address),
      {namePos: 1}
    ),
    new Fetcher<{erc721: Erc721}, StringV>(`
        #### Name

        * "Erc721 <Erc721> Name" - Returns name of ERC-20 contract
          * E.g. "Erc721 ZRX Name" - Returns ZRX's name
      `,
      "Name",
      [
        new Arg("erc721", getErc721V)
      ],
      (world, {erc721}) => getErc721Name(world, erc721),
      {namePos: 1}
    ),
    new Fetcher<{erc721: Erc721}, StringV>(`
        #### Symbol

        * "Erc721 <Erc721> Symbol" - Returns symbol of ERC-20 contract
          * E.g. "Erc721 ZRX Symbol" - Returns ZRX's symbol
      `,
      "Symbol",
      [
        new Arg("erc721", getErc721V)
      ],
      (world, {erc721}) => getErc721Symbol(world, erc721),
      {namePos: 1}
    ),
    new Fetcher<{erc721: Erc721}, NumberV>(`
        #### TotalSupply

        * "Erc721 <Erc721> TotalSupply" - Returns the ERC-20 token's total supply
          * E.g. "Erc721 ZRX TotalSupply"
          * E.g. "Erc721 oZRX TotalSupply"
      `,
      "TotalSupply",
      [
        new Arg("erc721", getErc721V)
      ],
      (world, {erc721}) => getTotalSupply(world, erc721),
      {namePos: 1}
    ),
    new Fetcher<{erc721: Erc721, address: AddressV}, NumberV>(`
        #### TokenBalance

        * "Erc721 <Erc721> TokenBalance <Address>" - Returns the ERC-20 token balance of a given address
          * E.g. "Erc721 ZRX TokenBalance Geoff" - Returns a user's ZRX balance
          * E.g. "Erc721 oZRX TokenBalance Geoff" - Returns a user's oZRX balance
          * E.g. "Erc721 ZRX TokenBalance oZRX" - Returns oZRX's ZRX balance
      `,
      "TokenBalance",
      [
        new Arg("erc721", getErc721V),
        new Arg("address", getAddressV)
      ],
      (world, {erc721, address}) => getTokenBalance(world, erc721, address.val),
      {namePos: 1}
    ),
  ];
}

export async function getErc721Value(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Erc721", erc721Fetchers(), world, event);
}
