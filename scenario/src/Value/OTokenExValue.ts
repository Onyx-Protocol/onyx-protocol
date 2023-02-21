import { Event } from '../Event';
import { World } from '../World';
import { OTokenEx } from '../Contract/OTokenEx';
import { OErc721Delegator } from '../Contract/OErc721Delegator';
import { Erc721 } from '../Contract/Erc721';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  NumberV,
  Value,
  StringV
} from '../Value';
import { getWorldContractByAddress, getOTokenExAddress } from '../ContractLookup';

export async function getOTokenExV(world: World, event: Event): Promise<OTokenEx> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getOTokenExAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<OTokenEx>(world, address.val);
}

export async function getOErc721DelegatorV(world: World, event: Event): Promise<OErc721Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getOTokenExAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<OErc721Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, oTokenEx: OTokenEx): Promise<AddressV> {
  return new AddressV(await oTokenEx.methods.interestRateModel().call());
}

async function oTokenExAddress(world: World, oTokenEx: OTokenEx): Promise<AddressV> {
  return new AddressV(oTokenEx._address);
}

async function getOTokenExAdmin(world: World, oTokenEx: OTokenEx): Promise<AddressV> {
  return new AddressV(await oTokenEx.methods.admin().call());
}

async function getOTokenPendingAdmin(world: World, oTokenEx: OTokenEx): Promise<AddressV> {
  return new AddressV(await oTokenEx.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, oTokenEx: OTokenEx, user: string): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, oTokenEx: OTokenEx, user): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, oTokenEx: OTokenEx, user): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.totalReserves().call());
}

async function getComptroller(world: World, oTokenEx: OTokenEx): Promise<AddressV> {
  return new AddressV(await oTokenEx.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.getCash().call());
}

async function getInterestRate(world: World, oTokenEx: OTokenEx): Promise<NumberV> {
  return new NumberV(await oTokenEx.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, oTokenEx: OTokenEx): Promise<AddressV> {
  return new AddressV(await (oTokenEx as OErc721Delegator).methods.implementation().call());
}

export function oTokenExFetchers() {
  return [
    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### Address

        * "OToken <OToken> Address" - Returns address of OToken contract
          * E.g. "OToken oZRX Address" - Returns oZRX's address
      `,
      "Address",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => oTokenExAddress(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### InterestRateModel

        * "OToken <OToken> InterestRateModel" - Returns the interest rate model of OToken contract
          * E.g. "OToken oZRX InterestRateModel" - Returns oZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getInterestRateModel(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### Admin

        * "OToken <OToken> Admin" - Returns the admin of OToken contract
          * E.g. "OToken oZRX Admin" - Returns oZRX's admin
      `,
      "Admin",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getOTokenExAdmin(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### PendingAdmin

        * "OToken <OToken> PendingAdmin" - Returns the pending admin of OToken contract
          * E.g. "OToken oZRX PendingAdmin" - Returns oZRX's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getOTokenPendingAdmin(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### Underlying

        * "OToken <OToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "OToken oZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("oToken", getOTokenExV)
      ],
      async (world, { oTokenEx }) => new AddressV(await oTokenEx.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "OToken <OToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "OToken oZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("oToken", getOTokenExV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { oTokenEx, address }) => balanceOfUnderlying(world, oTokenEx, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "OToken <OToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "OToken oZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("oToken", getOTokenExV),
        new Arg("address", getAddressV)
      ],
      (world, { oTokenEx, address }) => getBorrowBalance(world, oTokenEx, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "OToken <OToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "OToken oZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("oToken", getOTokenExV),
        new Arg("address", getAddressV)
      ],
      (world, { oTokenEx, address }) => getBorrowBalanceStored(world, oTokenEx, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### TotalBorrows

        * "OToken <OToken> TotalBorrows" - Returns the oToken's total borrow balance
          * E.g. "OToken oZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getTotalBorrows(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### TotalBorrowsCurrent

        * "OToken <OToken> TotalBorrowsCurrent" - Returns the oToken's total borrow balance with interest
          * E.g. "OToken oZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getTotalBorrowsCurrent(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### Reserves

        * "OToken <OToken> Reserves" - Returns the oToken's total reserves
          * E.g. "OToken oZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getTotalReserves(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### ReserveFactor

        * "OToken <OToken> ReserveFactor" - Returns reserve factor of OToken contract
          * E.g. "OToken oZRX ReserveFactor" - Returns oZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getReserveFactor(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### Comptroller

        * "OToken <OToken> Comptroller" - Returns the oToken's comptroller
          * E.g. "OToken oZRX Comptroller"
      `,
      "Comptroller",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getComptroller(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### ExchangeRateStored

        * "OToken <OToken> ExchangeRateStored" - Returns the oToken's exchange rate (based on balances stored)
          * E.g. "OToken oZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getExchangeRateStored(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### ExchangeRate

        * "OToken <OToken> ExchangeRate" - Returns the oToken's current exchange rate
          * E.g. "OToken oZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getExchangeRate(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### Cash

        * "OToken <OToken> Cash" - Returns the oToken's current cash
          * E.g. "OToken oZRX Cash"
      `,
      "Cash",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getCash(world, oTokenEx),
      { namePos: 1 }
    ),

    new Fetcher<{ oTokenEx: OTokenEx }, NumberV>(`
        #### InterestRate

        * "OToken <OToken> InterestRate" - Returns the oToken's current interest rate
          * E.g. "OToken oZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getInterestRate(world, oTokenEx),
      {namePos: 1}
    ),
    new Fetcher<{oTokenEx: OTokenEx, signature: StringV}, NumberV>(`
        #### CallNum

        * "OToken <OToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "OToken oZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("oToken", getOTokenExV),
        new Arg("signature", getStringV),
      ],
      async (world, {oTokenEx, signature}) => {
        const res = await world.web3.eth.call({
            to: oTokenEx._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ oTokenEx: OTokenEx }, AddressV>(`
        #### Implementation

        * "OToken <OToken> Implementation" - Returns the oToken's current implementation
          * E.g. "OToken oDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("oToken", getOTokenExV)
      ],
      (world, { oTokenEx }) => getImplementation(world, oTokenEx),
      { namePos: 1 }
    )
  ];
}

export async function getOTokenExValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("oTokenEx", oTokenExFetchers(), world, event);
}
