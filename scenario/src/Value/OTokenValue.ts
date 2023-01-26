import { Event } from '../Event';
import { World } from '../World';
import { OToken } from '../Contract/OToken';
import { OErc20Delegator } from '../Contract/OErc20Delegator';
import { Erc20 } from '../Contract/Erc20';
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
import { getWorldContractByAddress, getOTokenAddress } from '../ContractLookup';

export async function getOTokenV(world: World, event: Event): Promise<OToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getOTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<OToken>(world, address.val);
}

export async function getOErc20DelegatorV(world: World, event: Event): Promise<OErc20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getOTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<OErc20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, oToken: OToken): Promise<AddressV> {
  return new AddressV(await oToken.methods.interestRateModel().call());
}

async function oTokenAddress(world: World, oToken: OToken): Promise<AddressV> {
  return new AddressV(oToken._address);
}

async function getOTokenAdmin(world: World, oToken: OToken): Promise<AddressV> {
  return new AddressV(await oToken.methods.admin().call());
}

async function getOTokenPendingAdmin(world: World, oToken: OToken): Promise<AddressV> {
  return new AddressV(await oToken.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, oToken: OToken, user: string): Promise<NumberV> {
  return new NumberV(await oToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, oToken: OToken, user): Promise<NumberV> {
  return new NumberV(await oToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, oToken: OToken, user): Promise<NumberV> {
  return new NumberV(await oToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.totalReserves().call());
}

async function getComptroller(world: World, oToken: OToken): Promise<AddressV> {
  return new AddressV(await oToken.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.getCash().call());
}

async function getInterestRate(world: World, oToken: OToken): Promise<NumberV> {
  return new NumberV(await oToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, oToken: OToken): Promise<AddressV> {
  return new AddressV(await (oToken as OErc20Delegator).methods.implementation().call());
}

export function oTokenFetchers() {
  return [
    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### Address

        * "OToken <OToken> Address" - Returns address of OToken contract
          * E.g. "OToken oZRX Address" - Returns oZRX's address
      `,
      "Address",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => oTokenAddress(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### InterestRateModel

        * "OToken <OToken> InterestRateModel" - Returns the interest rate model of OToken contract
          * E.g. "OToken oZRX InterestRateModel" - Returns oZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getInterestRateModel(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### Admin

        * "OToken <OToken> Admin" - Returns the admin of OToken contract
          * E.g. "OToken oZRX Admin" - Returns oZRX's admin
      `,
      "Admin",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getOTokenAdmin(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### PendingAdmin

        * "OToken <OToken> PendingAdmin" - Returns the pending admin of OToken contract
          * E.g. "OToken oZRX PendingAdmin" - Returns oZRX's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getOTokenPendingAdmin(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### Underlying

        * "OToken <OToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "OToken oZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("oToken", getOTokenV)
      ],
      async (world, { oToken }) => new AddressV(await oToken.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "OToken <OToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "OToken oZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("oToken", getOTokenV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { oToken, address }) => balanceOfUnderlying(world, oToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "OToken <OToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "OToken oZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("oToken", getOTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { oToken, address }) => getBorrowBalance(world, oToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "OToken <OToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "OToken oZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("oToken", getOTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { oToken, address }) => getBorrowBalanceStored(world, oToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### TotalBorrows

        * "OToken <OToken> TotalBorrows" - Returns the oToken's total borrow balance
          * E.g. "OToken oZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getTotalBorrows(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### TotalBorrowsCurrent

        * "OToken <OToken> TotalBorrowsCurrent" - Returns the oToken's total borrow balance with interest
          * E.g. "OToken oZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getTotalBorrowsCurrent(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### Reserves

        * "OToken <OToken> Reserves" - Returns the oToken's total reserves
          * E.g. "OToken oZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getTotalReserves(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### ReserveFactor

        * "OToken <OToken> ReserveFactor" - Returns reserve factor of OToken contract
          * E.g. "OToken oZRX ReserveFactor" - Returns oZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getReserveFactor(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### Comptroller

        * "OToken <OToken> Comptroller" - Returns the oToken's comptroller
          * E.g. "OToken oZRX Comptroller"
      `,
      "Comptroller",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getComptroller(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### ExchangeRateStored

        * "OToken <OToken> ExchangeRateStored" - Returns the oToken's exchange rate (based on balances stored)
          * E.g. "OToken oZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getExchangeRateStored(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### ExchangeRate

        * "OToken <OToken> ExchangeRate" - Returns the oToken's current exchange rate
          * E.g. "OToken oZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getExchangeRate(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### Cash

        * "OToken <OToken> Cash" - Returns the oToken's current cash
          * E.g. "OToken oZRX Cash"
      `,
      "Cash",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getCash(world, oToken),
      { namePos: 1 }
    ),

    new Fetcher<{ oToken: OToken }, NumberV>(`
        #### InterestRate

        * "OToken <OToken> InterestRate" - Returns the oToken's current interest rate
          * E.g. "OToken oZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, {oToken}) => getInterestRate(world, oToken),
      {namePos: 1}
    ),
    new Fetcher<{oToken: OToken, signature: StringV}, NumberV>(`
        #### CallNum

        * "OToken <OToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "OToken oZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("oToken", getOTokenV),
        new Arg("signature", getStringV),
      ],
      async (world, {oToken, signature}) => {
        const res = await world.web3.eth.call({
            to: oToken._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ oToken: OToken }, AddressV>(`
        #### Implementation

        * "OToken <OToken> Implementation" - Returns the oToken's current implementation
          * E.g. "OToken oDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => getImplementation(world, oToken),
      { namePos: 1 }
    )
  ];
}

export async function getOTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("oToken", oTokenFetchers(), world, event);
}
