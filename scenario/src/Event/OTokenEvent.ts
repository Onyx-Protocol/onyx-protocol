import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { OToken, OTokenScenario } from '../Contract/OToken';
import { OErc20Delegate } from '../Contract/OErc20Delegate'
import { OErc20Delegator } from '../Contract/OErc20Delegator'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { getContract } from '../Contract';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { OTokenErrorReporter } from '../ErrorReporter';
import { getComptroller, getOTokenData } from '../ContractLookup';
import { getExpMantissa } from '../Encoding';
import { buildOToken } from '../Builder/OTokenBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ComptrollerValue';
import { encodedNumber } from '../Encoding';
import { getOTokenV, getOErc20DelegatorV } from '../Value/OTokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genOToken(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, oToken, tokenData } = await buildOToken(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added oToken ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${oToken._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, oToken: OToken): Promise<World> {
  let invokation = await invoke(world, oToken.methods.accrueInterest(), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, oToken: OToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, oToken.methods.mint(amount.encode()), from, OTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, oToken.methods.mint(), from, OTokenErrorReporter);
  }

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} mints ${showAmount}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, oToken: OToken, tokens: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.redeem(tokens.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} redeems ${tokens.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, oToken: OToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.redeemUnderlying(amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function borrow(world: World, from: string, oToken: OToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.borrow(amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repayBorrow(world: World, from: string, oToken: OToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, oToken.methods.repayBorrow(amount.encode()), from, OTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, oToken.methods.repayBorrow(), from, OTokenErrorReporter);
  }

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}

async function repayBorrowBehalf(world: World, from: string, behalf: string, oToken: OToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, oToken.methods.repayBorrowBehalf(behalf, amount.encode()), from, OTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, oToken.methods.repayBorrowBehalf(behalf), from, OTokenErrorReporter);
  }

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow on behalf of ${describeUser(world, behalf)}`,
    invokation
  );

  return world;
}

async function liquidateBorrow(world: World, from: string, oToken: OToken, borrower: string, collateral: OToken, repayAmount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (repayAmount instanceof NumberV) {
    showAmount = repayAmount.show();
    invokation = await invoke(world, oToken.methods.liquidateBorrow(borrower, repayAmount.encode(), collateral._address), from, OTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, oToken.methods.liquidateBorrow(borrower, collateral._address), from, OTokenErrorReporter);
  }

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function seize(world: World, from: string, oToken: OToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.seize(liquidator, borrower, seizeTokens.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} initiates seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function evilSeize(world: World, from: string, oToken: OToken, treasure: OToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.evilSeize(treasure._address, liquidator, borrower, seizeTokens.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} initiates illegal seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, oToken: OToken, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setPendingAdmin(newPendingAdmin), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, oToken: OToken): Promise<World> {
  let invokation = await invoke(world, oToken.methods._acceptAdmin(), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function addReserves(world: World, from: string, oToken: OToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods._addReserves(amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} adds to reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function reduceReserves(world: World, from: string, oToken: OToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods._reduceReserves(amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function setReserveFactor(world: World, from: string, oToken: OToken, reserveFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setReserveFactor(reserveFactor.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} sets reserve factor to ${reserveFactor.show()}`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, oToken: OToken, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setInterestRateModel(interestRateModel), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${oToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setComptroller(world: World, from: string, oToken: OToken, comptroller: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setComptroller(comptroller), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Set comptroller for ${oToken.name} to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function sweepToken(world: World, from: string, oToken: OToken, token: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods.sweepToken(token), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Swept ERC-20 at ${token} to admin`,
    invokation
  );

  return world;
}

async function becomeImplementation(
  world: World,
  from: string,
  oToken: OToken,
  becomeImplementationData: string
): Promise<World> {

  const oErc20Delegate = getContract('OErc20Delegate');
  const oErc20DelegateContract = await oErc20Delegate.at<OErc20Delegate>(world, oToken._address);

  let invokation = await invoke(
    world,
    oErc20DelegateContract.methods._becomeImplementation(becomeImplementationData),
    from,
    OTokenErrorReporter
  );

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(
      world,
      from
    )} initiates _becomeImplementation with data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function resignImplementation(
  world: World,
  from: string,
  oToken: OToken,
): Promise<World> {

  const oErc20Delegate = getContract('OErc20Delegate');
  const oErc20DelegateContract = await oErc20Delegate.at<OErc20Delegate>(world, oToken._address);

  let invokation = await invoke(
    world,
    oErc20DelegateContract.methods._resignImplementation(),
    from,
    OTokenErrorReporter
  );

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(
      world,
      from
    )} initiates _resignImplementation.`,
    invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  oToken: OErc20Delegator,
  implementation: string,
  allowResign: boolean,
  becomeImplementationData: string
): Promise<World> {
  let invokation = await invoke(
    world,
    oToken.methods._setImplementation(
      implementation,
      allowResign,
      becomeImplementationData
    ),
    from,
    OTokenErrorReporter
  );

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(
      world,
      from
    )} initiates setImplementation with implementation:${implementation} allowResign:${allowResign} data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function donate(world: World, from: string, oToken: OToken): Promise<World> {
  let invokation = await invoke(world, oToken.methods.donate(), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${oToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function setOTokenMock(world: World, from: string, oToken: OTokenScenario, mock: string, value: NumberV): Promise<World> {
  let mockMethod: (number) => Sendable<void>;

  switch (mock.toLowerCase()) {
    case "totalborrows":
      mockMethod = oToken.methods.setTotalBorrows;
      break;
    case "totalreserves":
      mockMethod = oToken.methods.setTotalReserves;
      break;
    default:
      throw new Error(`Mock "${mock}" not defined for oToken`);
  }

  let invokation = await invoke(world, mockMethod(value.encode()), from);

  world = addAction(
    world,
    `Mocked ${mock}=${value.show()} for ${oToken.name}`,
    invokation
  );

  return world;
}

async function verifyOToken(world: World, oToken: OToken, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, oToken._address);
  }

  return world;
}

async function printMinters(world: World, oToken: OToken): Promise<World> {
  let events = await getPastEvents(world, oToken, oToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printBorrowers(world: World, oToken: OToken): Promise<World> {
  let events = await getPastEvents(world, oToken, oToken.name, 'Borrow');
  let addresses = events.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Borrowers:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printLiquidity(world: World, oToken: OToken): Promise<World> {
  let mintEvents = await getPastEvents(world, oToken, oToken.name, 'Mint');
  let mintAddresses = mintEvents.map((event) => event.returnValues['minter']);
  let borrowEvents = await getPastEvents(world, oToken, oToken.name, 'Borrow');
  let borrowAddresses = borrowEvents.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(mintAddresses.concat(borrowAddresses))];
  let comptroller = await getComptroller(world);

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

export function oTokenCommands() {
  return [
    new Command<{ oTokenParams: EventV }>(`
        #### Deploy

        * "OToken Deploy ...oTokenParams" - Generates a new OToken
          * E.g. "OToken oZRX Deploy"
      `,
      "Deploy",
      [new Arg("oTokenParams", getEventV, { variadic: true })],
      (world, from, { oTokenParams }) => genOToken(world, from, oTokenParams.val)
    ),
    new View<{ oTokenArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "OToken <oToken> Verify apiKey:<String>" - Verifies OToken in Etherscan
          * E.g. "OToken oZRX Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("oTokenArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { oTokenArg, apiKey }) => {
        let [oToken, name, data] = await getOTokenData(world, oTokenArg.val);

        return await verifyOToken(world, oToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken }>(`
        #### AccrueInterest

        * "OToken <oToken> AccrueInterest" - Accrues interest for given token
          * E.g. "OToken oZRX AccrueInterest"
      `,
      "AccrueInterest",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, from, { oToken }) => accrueInterest(world, from, oToken),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, amount: NumberV | NothingV }>(`
        #### Mint

        * "OToken <oToken> Mint amount:<Number>" - Mints the given amount of oToken as specified user
          * E.g. "OToken oZRX Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("oToken", getOTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { oToken, amount }) => mint(world, from, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, tokens: NumberV }>(`
        #### Redeem

        * "OToken <oToken> Redeem tokens:<Number>" - Redeems the given amount of oTokens as specified user
          * E.g. "OToken oZRX Redeem 1.0e9"
      `,
      "Redeem",
      [
        new Arg("oToken", getOTokenV),
        new Arg("tokens", getNumberV)
      ],
      (world, from, { oToken, tokens }) => redeem(world, from, oToken, tokens),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, amount: NumberV }>(`
        #### RedeemUnderlying

        * "OToken <oToken> RedeemUnderlying amount:<Number>" - Redeems the given amount of underlying as specified user
          * E.g. "OToken oZRX RedeemUnderlying 1.0e18"
      `,
      "RedeemUnderlying",
      [
        new Arg("oToken", getOTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { oToken, amount }) => redeemUnderlying(world, from, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, amount: NumberV }>(`
        #### Borrow

        * "OToken <oToken> Borrow amount:<Number>" - Borrows the given amount of this oToken as specified user
          * E.g. "OToken oZRX Borrow 1.0e18"
      `,
      "Borrow",
      [
        new Arg("oToken", getOTokenV),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { oToken, amount }) => borrow(world, from, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, amount: NumberV | NothingV }>(`
        #### RepayBorrow

        * "OToken <oToken> RepayBorrow underlyingAmount:<Number>" - Repays borrow in the given underlying amount as specified user
          * E.g. "OToken oZRX RepayBorrow 1.0e18"
      `,
      "RepayBorrow",
      [
        new Arg("oToken", getOTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { oToken, amount }) => repayBorrow(world, from, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, behalf: AddressV, amount: NumberV | NothingV }>(`
        #### RepayBorrowBehalf

        * "OToken <oToken> RepayBorrowBehalf behalf:<User> underlyingAmount:<Number>" - Repays borrow in the given underlying amount on behalf of another user
          * E.g. "OToken oZRX RepayBorrowBehalf Geoff 1.0e18"
      `,
      "RepayBorrowBehalf",
      [
        new Arg("oToken", getOTokenV),
        new Arg("behalf", getAddressV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { oToken, behalf, amount }) => repayBorrowBehalf(world, from, behalf.val, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ borrower: AddressV, oToken: OToken, collateral: OToken, repayAmount: NumberV | NothingV }>(`
        #### Liquidate

        * "OToken <oToken> Liquidate borrower:<User> oTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "OToken oZRX Liquidate Geoff oBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("oToken", getOTokenV),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getOTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { borrower, oToken, collateral, repayAmount }) => liquidateBorrow(world, from, oToken, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### Seize

        * "OToken <oToken> Seize liquidator:<User> borrower:<User> seizeTokens:<Number>" - Seizes a given number of tokens from a user (to be called from other OToken)
          * E.g. "OToken oZRX Seize Geoff Torrey 1.0e18"
      `,
      "Seize",
      [
        new Arg("oToken", getOTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { oToken, liquidator, borrower, seizeTokens }) => seize(world, from, oToken, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, treasure: OToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### EvilSeize

        * "OToken <oToken> EvilSeize treasure:<Token> liquidator:<User> borrower:<User> seizeTokens:<Number>" - Improperly seizes a given number of tokens from a user
          * E.g. "OToken cEVL EvilSeize oZRX Geoff Torrey 1.0e18"
      `,
      "EvilSeize",
      [
        new Arg("oToken", getOTokenV),
        new Arg("treasure", getOTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { oToken, treasure, liquidator, borrower, seizeTokens }) => evilSeize(world, from, oToken, treasure, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, amount: NumberV }>(`
        #### ReduceReserves

        * "OToken <oToken> ReduceReserves amount:<Number>" - Reduces the reserves of the oToken
          * E.g. "OToken oZRX ReduceReserves 1.0e18"
      `,
      "ReduceReserves",
      [
        new Arg("oToken", getOTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { oToken, amount }) => reduceReserves(world, from, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, amount: NumberV }>(`
    #### AddReserves

    * "OToken <oToken> AddReserves amount:<Number>" - Adds reserves to the oToken
      * E.g. "OToken oZRX AddReserves 1.0e18"
  `,
      "AddReserves",
      [
        new Arg("oToken", getOTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { oToken, amount }) => addReserves(world, from, oToken, amount),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, newPendingAdmin: AddressV }>(`
        #### SetPendingAdmin

        * "OToken <oToken> SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the oToken
          * E.g. "OToken oZRX SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("oToken", getOTokenV),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, { oToken, newPendingAdmin }) => setPendingAdmin(world, from, oToken, newPendingAdmin.val),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken }>(`
        #### AcceptAdmin

        * "OToken <oToken> AcceptAdmin" - Accepts admin for the oToken
          * E.g. "From Geoff (OToken oZRX AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, from, { oToken }) => acceptAdmin(world, from, oToken),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, reserveFactor: NumberV }>(`
        #### SetReserveFactor

        * "OToken <oToken> SetReserveFactor reserveFactor:<Number>" - Sets the reserve factor for the oToken
          * E.g. "OToken oZRX SetReserveFactor 0.1"
      `,
      "SetReserveFactor",
      [
        new Arg("oToken", getOTokenV),
        new Arg("reserveFactor", getExpNumberV)
      ],
      (world, from, { oToken, reserveFactor }) => setReserveFactor(world, from, oToken, reserveFactor),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, interestRateModel: AddressV }>(`
        #### SetInterestRateModel

        * "OToken <oToken> SetInterestRateModel interestRateModel:<Contract>" - Sets the interest rate model for the given oToken
          * E.g. "OToken oZRX SetInterestRateModel (FixedRate 1.5)"
      `,
      "SetInterestRateModel",
      [
        new Arg("oToken", getOTokenV),
        new Arg("interestRateModel", getAddressV)
      ],
      (world, from, { oToken, interestRateModel }) => setInterestRateModel(world, from, oToken, interestRateModel.val),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, token: AddressV }>(`
        #### SweepToken

        * "OToken <oToken> SweepToken erc20Token:<Contract>" - Sweeps the given erc-20 token from the contract
          * E.g. "OToken oZRX SweepToken BAT"
      `,
      "SweepToken",
      [
        new Arg("oToken", getOTokenV),
        new Arg("token", getAddressV)
      ],
      (world, from, { oToken, token }) => sweepToken(world, from, oToken, token.val),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, comptroller: AddressV }>(`
        #### SetComptroller

        * "OToken <oToken> SetComptroller comptroller:<Contract>" - Sets the comptroller for the given oToken
          * E.g. "OToken oZRX SetComptroller Comptroller"
      `,
      "SetComptroller",
      [
        new Arg("oToken", getOTokenV),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, { oToken, comptroller }) => setComptroller(world, from, oToken, comptroller.val),
      { namePos: 1 }
    ),
    new Command<{
      oToken: OToken;
      becomeImplementationData: StringV;
    }>(
      `
        #### BecomeImplementation

        * "OToken <oToken> BecomeImplementation becomeImplementationData:<String>"
          * E.g. "OToken oDAI BecomeImplementation "0x01234anyByTeS56789""
      `,
      'BecomeImplementation',
      [
        new Arg('oToken', getOTokenV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { oToken, becomeImplementationData }) =>
        becomeImplementation(
          world,
          from,
          oToken,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{oToken: OToken;}>(
      `
        #### ResignImplementation

        * "OToken <oToken> ResignImplementation"
          * E.g. "OToken oDAI ResignImplementation"
      `,
      'ResignImplementation',
      [new Arg('oToken', getOTokenV)],
      (world, from, { oToken }) =>
        resignImplementation(
          world,
          from,
          oToken
        ),
      { namePos: 1 }
    ),
    new Command<{
      oToken: OErc20Delegator;
      implementation: AddressV;
      allowResign: BoolV;
      becomeImplementationData: StringV;
    }>(
      `
        #### SetImplementation

        * "OToken <oToken> SetImplementation implementation:<Address> allowResign:<Bool> becomeImplementationData:<String>"
          * E.g. "OToken oDAI SetImplementation (OToken oDAIDelegate Address) True "0x01234anyByTeS56789"
      `,
      'SetImplementation',
      [
        new Arg('oToken', getOErc20DelegatorV),
        new Arg('implementation', getAddressV),
        new Arg('allowResign', getBoolV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { oToken, implementation, allowResign, becomeImplementationData }) =>
        setImplementation(
          world,
          from,
          oToken,
          implementation.val,
          allowResign.val,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken }>(`
        #### Donate

        * "OToken <oToken> Donate" - Calls the donate (payable no-op) function
          * E.g. "(Trx Value 5.0e18 (OToken oETH Donate))"
      `,
      "Donate",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, from, { oToken }) => donate(world, from, oToken),
      { namePos: 1 }
    ),
    new Command<{ oToken: OToken, variable: StringV, value: NumberV }>(`
        #### Mock

        * "OToken <oToken> Mock variable:<String> value:<Number>" - Mocks a given value on oToken. Note: value must be a supported mock and this will only work on a "OTokenScenario" contract.
          * E.g. "OToken oZRX Mock totalBorrows 5.0e18"
          * E.g. "OToken oZRX Mock totalReserves 0.5e18"
      `,
      "Mock",
      [
        new Arg("oToken", getOTokenV),
        new Arg("variable", getStringV),
        new Arg("value", getNumberV),
      ],
      (world, from, { oToken, variable, value }) => setOTokenMock(world, from, <OTokenScenario>oToken, variable.val, value),
      { namePos: 1 }
    ),
    new View<{ oToken: OToken }>(`
        #### Minters

        * "OToken <oToken> Minters" - Print address of all minters
      `,
      "Minters",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => printMinters(world, oToken),
      { namePos: 1 }
    ),
    new View<{ oToken: OToken }>(`
        #### Borrowers

        * "OToken <oToken> Borrowers" - Print address of all borrowers
      `,
      "Borrowers",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => printBorrowers(world, oToken),
      { namePos: 1 }
    ),
    new View<{ oToken: OToken }>(`
        #### Liquidity

        * "OToken <oToken> Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("oToken", getOTokenV)
      ],
      (world, { oToken }) => printLiquidity(world, oToken),
      { namePos: 1 }
    ),
    new View<{ oToken: OToken, input: StringV }>(`
        #### Decode

        * "Decode <oToken> input:<String>" - Prints information about a call to a oToken contract
      `,
      "Decode",
      [
        new Arg("oToken", getOTokenV),
        new Arg("input", getStringV)

      ],
      (world, { oToken, input }) => decodeCall(world, oToken, input.val),
      { namePos: 1 }
    )
  ];
}

export async function processOTokenEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("OToken", oTokenCommands(), world, event, from);
}
