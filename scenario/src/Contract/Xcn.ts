import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

interface Checkpoint {
  fromBlock: number;
  votes: number;
}

export interface XcnMethods {
  name(): Callable<string>;
  symbol(): Callable<string>;
  decimals(): Callable<number>;
  totalSupply(): Callable<number>;
  balanceOf(address: string): Callable<string>;
  allowance(owner: string, spender: string): Callable<string>;
  approve(address: string, amount: encodedNumber): Sendable<number>;
  transfer(address: string, amount: encodedNumber): Sendable<boolean>;
  transferFrom(owner: string, spender: string, amount: encodedNumber): Sendable<boolean>;
  checkpoints(account: string, index: number): Callable<Checkpoint>;
  numCheckpoints(account: string): Callable<number>;
  delegate(account: string): Sendable<void>;
  getCurrentVotes(account: string): Callable<number>;
  getPriorVotes(account: string, blockNumber: encodedNumber): Callable<number>;
  setBlockNumber(blockNumber: encodedNumber): Sendable<void>;
}

export interface XcnScenarioMethods extends XcnMethods {
  transferScenario(destinations: string[], amount: encodedNumber): Sendable<boolean>;
  transferFromScenario(froms: string[], amount: encodedNumber): Sendable<boolean>;
}

export interface Xcn extends Contract {
  methods: XcnMethods;
  name: string;
}

export interface XcnScenario extends Contract {
  methods: XcnScenarioMethods;
  name: string;
}
