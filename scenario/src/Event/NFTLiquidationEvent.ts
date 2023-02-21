import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {NFTLiquidation} from '../Contract/NFTLiquidation';
import {NFTLiquidationImpl} from '../Contract/NFTLiquidationImpl';
import {OToken} from '../Contract/OToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildNFTLiquidationImpl} from '../Builder/NFTLiquidationImplBuilder';
import {getNFTLiquidation, getNFTLiquidationImpl} from '../ContractLookup';
import {getOTokenV} from '../Value/OTokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";
import { Comptroller } from '../Contract/Comptroller';

async function genNFTLiquidation(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, nftLiquidationImpl: nftLiquidation, nftLiquidationImplData: nftLiquidationData} = await buildNFTLiquidationImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added NFTLiquidation (${nftLiquidationData.description}) at address ${nftLiquidation._address}`,
    nftLiquidationData.invokation
  );

  return world;
};

async function initialize(world: World, from: string, nftLiquidation: NFTLiquidation): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods.initialize(), from);

  world = addAction(
    world,
    `NFTLiquidation: ${describeUser(world, from)} initialized`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, nftLiquidation: NFTLiquidation, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods._setPendingAdmin(newPendingAdmin), from);

  world = addAction(
    world,
    `NFTLiquidation: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, nftLiquidation: NFTLiquidation): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods._acceptAdmin(), from);

  world = addAction(
    world,
    `NFTLiquidation: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function fastForward(world: World, from: string, nftLiquidation: NFTLiquidation, blocks: NumberV): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods.fastForward(blocks.encode()), from);

  world = addAction(
    world,
    `Fast forward ${blocks.show()} blocks to #${invokation.value}`,
    invokation
  );

  return world;
}

async function sendAny(world: World, from:string, nftLiquidation: NFTLiquidation, signature: string, callArgs: string[]): Promise<World> {
  const fnData = encodeABI(world, signature, callArgs);
  await world.web3.eth.sendTransaction({
      to: nftLiquidation._address,
      data: fnData,
      from: from
    })
  return world;
}

async function _setComptroller(world: World, from: string, nftLiquidation: NFTLiquidation, comptroller: string): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods._setComptroller(comptroller), from);

  world = addAction(
    world,
    `Set comptroller to ${comptroller}`,
    invokation
  );

  return world;
}

async function setOEther(world: World, from: string, nftLiquidation: NFTLiquidation, oEther: string): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods.setOEther(oEther), from);

  world = addAction(
    world,
    `Set oEther to ${oEther}`,
    invokation
  );

  return world;
}

async function liquidateWithSingleRepay(world: World, from: string, nftLiquidation: NFTLiquidation, borrower: string, oTokenCollateral: OToken, oTokenRepay: OToken, repayAmount: NumberV): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods.liquidateWithSingleRepay(borrower, oTokenCollateral._address, oTokenRepay._address, repayAmount.encode()), from);

  world = addAction(
    world,
    `liquidateWithSingleRepay with ${borrower}, ${oTokenCollateral.name}, ${oTokenRepay.name}, ${repayAmount.show()}`,
    invokation
  );

  return world;
}

async function liquidateWithSingleRepayV2(world: World, from: string, nftLiquidation: NFTLiquidation, borrower: string, oTokenCollateral: OToken, oTokenRepay: OToken, repayAmount: NumberV, _seizeIndexes: NumberV[], claimOToken: boolean): Promise<World> {
  let invokation = await invoke(world, nftLiquidation.methods.liquidateWithSingleRepayV2(borrower, oTokenCollateral._address, oTokenRepay._address, repayAmount.encode(), _seizeIndexes.map(index => index.encode()), claimOToken), from);

  world = addAction(
    world,
    `liquidateWithSingleRepay with ${borrower}, ${oTokenCollateral.name}, ${oTokenRepay.name}, ${repayAmount}, ${_seizeIndexes.map(index => index.show())},${claimOToken} `,
    invokation
  );

  return world;
}

export function nftLiquidationCommands() {
  return [
    new Command<{nftLiquidationParams: EventV}>(`
        #### Deploy

        * "NFTLiquidation Deploy ...nftLiquidationParams" - Generates a new NFTLiquidation (not as Impl)
          * E.g. "NFTLiquidation Deploy YesNo"
      `,
      "Deploy",
      [new Arg("nftLiquidationParams", getEventV, {variadic: true})],
      (world, from, {nftLiquidationParams}) => genNFTLiquidation(world, from, nftLiquidationParams.val)
    ),
    new Command<{nftLiquidation: NFTLiquidation}>(`
        #### Initialize

        * "NFTLiquidation Initialize" - Accepts admin for the NFTLiquidation
          * E.g. "From Geoff (NFTLiquidation Initialize)"
      `,
      "Initialize",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
      ],
      (world, from, {nftLiquidation}) => initialize(world, from, nftLiquidation)
    ),
    new Command<{nftLiquidation: NFTLiquidation, newPendingAdmin: AddressV}>(`
        #### SetPendingAdmin

        * "NFTLiquidation SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the NFTLiquidation
          * E.g. "NFTLiquidation SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, {nftLiquidation, newPendingAdmin}) => setPendingAdmin(world, from, nftLiquidation, newPendingAdmin.val)
    ),
    new Command<{nftLiquidation: NFTLiquidation}>(`
        #### AcceptAdmin

        * "NFTLiquidation AcceptAdmin" - Accepts admin for the NFTLiquidation
          * E.g. "From Geoff (NFTLiquidation AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
      ],
      (world, from, {nftLiquidation}) => acceptAdmin(world, from, nftLiquidation)
    ),
    new Command<{nftLiquidation: NFTLiquidation, blocks: NumberV, _keyword: StringV}>(`
        #### FastForward

        * "FastForward n:<Number> Blocks" - Moves the block number forward "n" blocks. Note: in "OTokenScenario" and "NFTLiquidationScenario" the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
          * E.g. "NFTLiquidation FastForward 5 Blocks" - Move block number forward 5 blocks.
      `,
      "FastForward",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("blocks", getNumberV),
        new Arg("_keyword", getStringV)
      ],
      (world, from, {nftLiquidation, blocks}) => fastForward(world, from, nftLiquidation, blocks)
    ),
    new View<{nftLiquidation: NFTLiquidation, input: StringV}>(`
        #### Decode

        * "Decode input:<String>" - Prints information about a call to a NFTLiquidation contract
      `,
      "Decode",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("input", getStringV)

      ],
      (world, {nftLiquidation, input}) => decodeCall(world, nftLiquidation, input.val)
    ),

    new Command<{nftLiquidation: NFTLiquidation, signature: StringV, callArgs: StringV[]}>(`
      #### Send
      * NFTLiquidation Send functionSignature:<String> callArgs[] - Sends any transaction to nftLiquidation
      * E.g: NFTLiquidation Send "setXcnAddress(address)" (Address XCN)
      `,
      "Send",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      (world, from, {nftLiquidation, signature, callArgs}) => sendAny(world, from, nftLiquidation, signature.val, rawValues(callArgs))
    ),
    new Command<{nftLiquidation: NFTLiquidation, comptroller: AddressV}>(`
      #### SetComptroller

      * "NFTLiquidation SetComptroller <comptroller>" - Sets Comptroller
      * E.g. "NFTLiquidation SetComptroller 0x00
      `,
      "SetComptroller",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, {nftLiquidation, comptroller}) => _setComptroller(world, from, nftLiquidation, comptroller.val)
    ),
    new Command<{nftLiquidation: NFTLiquidation, oEther: AddressV}>(`
      #### SetOEther

      * "NFTLiquidation SetOEther <oEther>" - Sets OEther
      * E.g. "NFTLiquidation SetOEther 0x00
      `,
      "SetOEther",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("oEther", getAddressV)
      ],
      (world, from, {nftLiquidation, oEther}) => setOEther(world, from, nftLiquidation, oEther.val)
    ),
    new Command<{nftLiquidation: NFTLiquidation, borrower: AddressV, oTokenCollateral: OToken, oTokenRepay: OToken, repayAmount: NumberV}>(`
      #### LiquidateWithSingleRepay

      * "NFTLiquidation LiquidateWithSingleRepay <comptroller>" - Sets Comptroller
      * E.g. "NFTLiquidation LiquidateWithSingleRepay Torrey oBAYC oZRX 1234
      `,
      "LiquidateWithSingleRepay",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("borrower", getAddressV),
        new Arg("oTokenCollateral", getOTokenV),
        new Arg("oTokenRepay", getOTokenV),
        new Arg("repayAmount", getNumberV)
      ],
      (world, from, {nftLiquidation, borrower, oTokenCollateral, oTokenRepay, repayAmount}) => liquidateWithSingleRepay(world, from, nftLiquidation, borrower.val, oTokenCollateral, oTokenRepay, repayAmount)
    ),
    new Command<{nftLiquidation: NFTLiquidation, borrower: AddressV, oTokenCollateral: OToken, oTokenRepay: OToken, repayAmount: NumberV, _seizeIndexes: NumberV[], claimOToken: BoolV}>(`
      #### LiquidateWithSingleRepayV2

      * "NFTLiquidation LiquidateWithSingleRepayV2 <comptroller>" - Sets Comptroller
      * E.g. "NFTLiquidation LiquidateWithSingleRepayV2 0x00 oBAYC oZRX 1234 (1,2) True
      `,
      "LiquidateWithSingleRepayV2",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("borrower", getAddressV),
        new Arg("oTokenCollateral", getOTokenV),
        new Arg("oTokenRepay", getOTokenV),
        new Arg("repayAmount", getNumberV),
        new Arg("_seizeIndexes", getNumberV, {mapped: true}),
        new Arg("claimOToken", getBoolV)
      ],
      (world, from, {nftLiquidation, borrower, oTokenCollateral, oTokenRepay, repayAmount, _seizeIndexes, claimOToken}) => liquidateWithSingleRepayV2(world, from, nftLiquidation, borrower.val, oTokenCollateral, oTokenRepay, repayAmount, _seizeIndexes, claimOToken.val)
    ),
  ];
}

export async function processNFTLiquidationEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("NFTLiquidation", nftLiquidationCommands(), world, event, from);
}
