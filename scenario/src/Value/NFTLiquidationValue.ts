import {Event} from '../Event';
import {World} from '../World';
import {NFTLiquidation} from '../Contract/NFTLiquidation';
import {OToken} from '../Contract/OToken';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getNFTLiquidation} from '../ContractLookup';
import {encodedNumber} from '../Encoding';
import {getOTokenV} from './OTokenValue';
import { encodeParameters, encodeABI } from '../Utils';

export async function getNFTLiquidationAddress(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(nftLiquidation._address);
}

async function getAdmin(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.admin().call());
}

async function getPendingAdmin(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.pendingAdmin().call());
}

async function getNFTLiquidationImplementation(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.nftLiquidationImplementation().call());
}

async function getPendingNFTLiquidationImplementation(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.pendingNFTLiquidationImplementation().call());
}

async function getComptroller(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.comptroller().call());
}

async function getOEther(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.oEther().call());
}

async function getProtocolFeeRecipient(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.protocolFeeRecipient().call());
}

async function getProtocolFeeMantissa(world: World, nftLiquidation: NFTLiquidation): Promise<AddressV> {
  return new AddressV(await nftLiquidation.methods.protocolFeeMantissa().call());
}

async function getSingleTokenExtraRepayAmount(world: World, nftLiquidation: NFTLiquidation, borrower: string, oTokenCollateral: OToken, oTokenRepay: OToken, repayAmount: NumberV): Promise<NumberV> {
  return new NumberV(await nftLiquidation.methods.getSingleTokenExtraRepayAmount(borrower, oTokenCollateral._address, oTokenRepay._address, repayAmount.encode()).call());
}


export function nftLiquidationFetchers() {
  return [
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### Address

        * "NFTLiquidation Address" - Returns address of nftLiquidation
      `,
      "Address",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getNFTLiquidationAddress(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### Admin

        * "NFTLiquidation Admin" - Returns the NFTLiquidations's admin
          * E.g. "NFTLiquidation Admin"
      `,
      "Admin",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getAdmin(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### PendingAdmin

        * "NFTLiquidation PendingAdmin" - Returns the pending admin of the NFTLiquidation
          * E.g. "NFTLiquidation PendingAdmin" - Returns NFTLiquidation's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
      ],
      (world, {nftLiquidation}) => getPendingAdmin(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### NFTLiquidationImplementation

        * "NFTLiquidation NFTLiquidationImplementation" - Returns the NFTLiquidation's nftLiquidationImplementation
          * E.g. "NFTLiquidation NFTLiquidationImplementation"
      `,
      "NFTLiquidationImplementation",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getNFTLiquidationImplementation(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### PendingNFTLiquidationImplementation

        * "NFTLiquidation PendingNFTLiquidationImplementation" - Returns the NFTLiquidation's pendingNFTLiquidationImplementation
          * E.g. "NFTLiquidation PendingNFTLiquidationImplementation"
      `,
      "PendingNFTLiquidationImplementation",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getPendingNFTLiquidationImplementation(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### Comptroller

        * "NFTLiquidation Comptroller" - Returns the NFTLiquidation's comptroller
          * E.g. "NFTLiquidation Comptroller"
      `,
      "Comptroller",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getComptroller(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### OEther

        * "NFTLiquidation OEther" - Returns the NFTLiquidation's oEther
          * E.g. "NFTLiquidation OEther"
      `,
      "OEther",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getOEther(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### ProtocolFeeRecipient

        * "NFTLiquidation ProtocolFeeRecipient" - Returns the NFTLiquidation's protocolFeeRecipient
          * E.g. "NFTLiquidation ProtocolFeeRecipient"
      `,
      "ProtocolFeeRecipient",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getProtocolFeeRecipient(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation}, AddressV>(`
        #### ProtocolFeeMantissa

        * "NFTLiquidation ProtocolFeeMantissa" - Returns the NFTLiquidation's protocolFeeMantissa
          * E.g. "NFTLiquidation ProtocolFeeMantissa"
      `,
      "ProtocolFeeMantissa",
      [new Arg("nftLiquidation", getNFTLiquidation, {implicit: true})],
      (world, {nftLiquidation}) => getProtocolFeeMantissa(world, nftLiquidation)
    ),
    new Fetcher<{nftLiquidation: NFTLiquidation, borrower: AddressV, oTokenCollateral: OToken, oTokenRepay: OToken, repayAmount: NumberV}, NumberV>(`
        #### SingleTokenExtraRepayAmount

        * "NFTLiquidation SingleTokenExtraRepayAmount" - Returns the NFTLiquidation's SingleTokenExtraRepayAmount
          * E.g. "NFTLiquidation SingleTokenExtraRepayAmount Torrey oBAYC oUSDC 0"
      `,
      "SingleTokenExtraRepayAmount",
      [
        new Arg("nftLiquidation", getNFTLiquidation, {implicit: true}),
        new Arg("borrower", getAddressV),
        new Arg("oTokenCollateral", getOTokenV),
        new Arg("oTokenRepay", getOTokenV),
        new Arg("repayAmount", getNumberV)
      ],
      (world, {nftLiquidation, borrower, oTokenCollateral, oTokenRepay, repayAmount}) => getSingleTokenExtraRepayAmount(world, nftLiquidation, borrower.val, oTokenCollateral, oTokenRepay, repayAmount)
    )
  ];
}

export async function getNFTLiquidationValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("NFTLiquidation", nftLiquidationFetchers(), world, event);
}
