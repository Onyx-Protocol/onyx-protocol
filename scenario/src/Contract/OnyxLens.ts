import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface OnyxLensMethods {
  oTokenBalances(oToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  oTokenBalancesAll(oTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  oTokenMetadata(oToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number]>;
  oTokenMetadataAll(oTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number][]>;
  oTokenUnderlyingPrice(oToken: string): Sendable<[string,number]>;
  oTokenUnderlyingPriceAll(oTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(comptroller: string, account: string): Sendable<[string[],number,number]>;
}

export interface OnyxLens extends Contract {
  methods: OnyxLensMethods;
  name: string;
}
