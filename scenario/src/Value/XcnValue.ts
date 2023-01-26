import { Event } from '../Event';
import { World } from '../World';
import { Xcn } from '../Contract/Xcn';
import {
  getAddressV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getXcn } from '../ContractLookup';

export function xcnFetchers() {
  return [
    new Fetcher<{ xcn: Xcn }, AddressV>(`
        #### Address

        * "<Xcn> Address" - Returns the address of Xcn token
          * E.g. "Xcn Address"
      `,
      "Address",
      [
        new Arg("xcn", getXcn, { implicit: true })
      ],
      async (world, { xcn }) => new AddressV(xcn._address)
    ),

    new Fetcher<{ xcn: Xcn }, StringV>(`
        #### Name

        * "<Xcn> Name" - Returns the name of the Xcn token
          * E.g. "Xcn Name"
      `,
      "Name",
      [
        new Arg("xcn", getXcn, { implicit: true })
      ],
      async (world, { xcn }) => new StringV(await xcn.methods.name().call())
    ),

    new Fetcher<{ xcn: Xcn }, StringV>(`
        #### Symbol

        * "<Xcn> Symbol" - Returns the symbol of the Xcn token
          * E.g. "Xcn Symbol"
      `,
      "Symbol",
      [
        new Arg("xcn", getXcn, { implicit: true })
      ],
      async (world, { xcn }) => new StringV(await xcn.methods.symbol().call())
    ),

    new Fetcher<{ xcn: Xcn }, NumberV>(`
        #### Decimals

        * "<Xcn> Decimals" - Returns the number of decimals of the Xcn token
          * E.g. "Xcn Decimals"
      `,
      "Decimals",
      [
        new Arg("xcn", getXcn, { implicit: true })
      ],
      async (world, { xcn }) => new NumberV(await xcn.methods.decimals().call())
    ),

    new Fetcher<{ xcn: Xcn }, NumberV>(`
        #### TotalSupply

        * "Xcn TotalSupply" - Returns Xcn token's total supply
      `,
      "TotalSupply",
      [
        new Arg("xcn", getXcn, { implicit: true })
      ],
      async (world, { xcn }) => new NumberV(await xcn.methods.totalSupply().call())
    ),

    new Fetcher<{ xcn: Xcn, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "Xcn TokenBalance <Address>" - Returns the Xcn token balance of a given address
          * E.g. "Xcn TokenBalance Geoff" - Returns Geoff's Xcn balance
      `,
      "TokenBalance",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { xcn, address }) => new NumberV(await xcn.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ xcn: Xcn, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "Xcn Allowance owner:<Address> spender:<Address>" - Returns the Xcn allowance from owner to spender
          * E.g. "Xcn Allowance Geoff Torrey" - Returns the Xcn allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { xcn, owner, spender }) => new NumberV(await xcn.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ xcn: Xcn, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "Xcn GetCurrentVotes account:<Address>" - Returns the current Xcn votes balance for an account
          * E.g. "Xcn GetCurrentVotes Geoff" - Returns the current Xcn vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xcn, account }) => new NumberV(await xcn.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ xcn: Xcn, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "Xcn GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current Xcn votes balance at given block
          * E.g. "Xcn GetPriorVotes Geoff 5" - Returns the Xcn vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { xcn, account, blockNumber }) => new NumberV(await xcn.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ xcn: Xcn, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "Xcn GetCurrentVotesBlock account:<Address>" - Returns the current Xcn votes checkpoint block for an account
          * E.g. "Xcn GetCurrentVotesBlock Geoff" - Returns the current Xcn votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xcn, account }) => {
        const numCheckpoints = Number(await xcn.methods.numCheckpoints(account.val).call());
        const checkpoint = await xcn.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ xcn: Xcn, account: AddressV }, NumberV>(`
        #### VotesLength

        * "Xcn VotesLength account:<Address>" - Returns the Xcn vote checkpoint array length
          * E.g. "Xcn VotesLength Geoff" - Returns the Xcn vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xcn, account }) => new NumberV(await xcn.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ xcn: Xcn, account: AddressV }, ListV>(`
        #### AllVotes

        * "Xcn AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "Xcn AllVotes Geoff" - Returns the Xcn vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("xcn", getXcn, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xcn, account }) => {
        const numCheckpoints = Number(await xcn.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await xcn.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getXcnValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Xcn", xcnFetchers(), world, event);
}
