import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { OTokenEx } from '../Contract/OTokenEx';
import { OErc721Delegate } from '../Contract/OErc721Delegate'
import { OErc721Delegator } from '../Contract/OErc721Delegator'
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
import { buildOTokenEx } from '../Builder/OTokenExBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ComptrollerValue';
import { encodedNumber } from '../Encoding';
import { getOTokenV, getOErc20DelegatorV } from '../Value/OTokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genOTokenEx(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, oTokenEx, tokenData } = await buildOTokenEx(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added oTokenEx ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${oTokenEx._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, oTokenEx: OTokenEx): Promise<World> {
  let invokation = await invoke(world, oTokenEx.methods.accrueInterest(), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OTokenEx ${oTokenEx.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, oToken: OTokenEx, tokenId: NumberV): Promise<World> {
  let invokation;
  let showTokenId;

  showTokenId = tokenId.show();
  invokation = await invoke(world, oToken.methods.mint(tokenId.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OTokenEx ${oToken.name}: ${describeUser(world, from)} mints ${showTokenId}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, oToken: OTokenEx, tokenIndex: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.redeem(tokenIndex.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OTokenEx ${oToken.name}: ${describeUser(world, from)} redeems ${tokenIndex.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, oToken: OTokenEx, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, oToken.methods.redeemUnderlying(amount.encode()), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OTokenEx ${oToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, oToken: OTokenEx, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setPendingAdmin(newPendingAdmin), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OTokenEx ${oToken.name}: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, oToken: OTokenEx): Promise<World> {
  let invokation = await invoke(world, oToken.methods._acceptAdmin(), from, OTokenErrorReporter);

  world = addAction(
    world,
    `OToken ${oToken.name}: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, oToken: OTokenEx, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setInterestRateModel(interestRateModel), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${oToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setComptroller(world: World, from: string, oToken: OTokenEx, comptroller: string): Promise<World> {
  let invokation = await invoke(world, oToken.methods._setComptroller(comptroller), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Set comptroller for ${oToken.name} to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function sweepToken(world: World, from: string, oToken: OTokenEx, token: string): Promise<World> {
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
  oToken: OTokenEx,
  becomeImplementationData: string
): Promise<World> {

  const oErc20Delegate = getContract('OErc20Delegate');
  const oErc20DelegateContract = await oErc20Delegate.at<OErc721Delegate>(world, oToken._address);

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
  oToken: OTokenEx,
): Promise<World> {

  const oErc20Delegate = getContract('OErc20Delegate');
  const oErc20DelegateContract = await oErc20Delegate.at<OErc721Delegate>(world, oToken._address);

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
  oToken: OErc721Delegator,
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

async function donate(world: World, from: string, oToken: OTokenEx): Promise<World> {
  let invokation = await invoke(world, oToken.methods.donate(), from, OTokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${oToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function verifyOToken(world: World, oToken: OTokenEx, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, oToken._address);
  }

  return world;
}

async function printMinters(world: World, oToken: OTokenEx): Promise<World> {
  let events = await getPastEvents(world, oToken, oToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

export function oTokenExCommands() {
  return [
    new Command<{ oTokenParams: EventV }>(`
        #### Deploy

        * "OTokenEx Deploy ...oTokenParams" - Generates a new OToken
          * E.g. "OTokenEx oBAYC Deploy"
      `,
      "Deploy",
      [new Arg("oTokenParams", getEventV, { variadic: true })],
      (world, from, { oTokenParams }) => genOTokenEx(world, from, oTokenParams.val)
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
    new Command<{ oToken: OTokenEx }>(`
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
    new Command<{ oToken: OTokenEx, amount: NumberV }>(`
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
    new Command<{ oToken: OTokenEx, tokens: NumberV }>(`
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
    new Command<{ oToken: OTokenEx, amount: NumberV }>(`
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
    new Command<{ oToken: OTokenEx, newPendingAdmin: AddressV }>(`
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
    new Command<{ oToken: OTokenEx }>(`
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
    new Command<{ oToken: OTokenEx, interestRateModel: AddressV }>(`
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
    new Command<{ oToken: OTokenEx, token: AddressV }>(`
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
    new Command<{ oToken: OTokenEx, comptroller: AddressV }>(`
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
      oToken: OTokenEx;
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
    new Command<{oToken: OTokenEx;}>(
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
      oToken: OErc721Delegator;
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
    new Command<{ oToken: OTokenEx }>(`
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
    new View<{ oToken: OTokenEx }>(`
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
    new View<{ oToken: OTokenEx, input: StringV }>(`
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

export async function processOTokenExEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("OTokenEx", oTokenExCommands(), world, event, from);
}
