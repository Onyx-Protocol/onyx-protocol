import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface Erc721Methods {
  name(): Callable<string>
  symbol(): Callable<string>
  totalSupply(): Callable<number>
  balanceOf(string): Callable<string>
  getApproved(tokenId: encodedNumber): Callable<string>
  isApprovedForAll(owner: string, operator: string): Callable<boolean>
  approve(address: string, tokenId: encodedNumber): Sendable<void>
  setApprovalForAll(address: string, approved: boolean): Sendable<void>
  transferFrom(from: string, to: string, tokenId: encodedNumber): Sendable<void>
  harnessMint(to: string, tokenId: encodedNumber): Sendable<void>
  harnessSetFailTransferFromAddress(src: string, _fail: boolean): Sendable<void>
  harnessSetFailTransferToAddress(dst: string, _fail: boolean): Sendable<void>
}

export interface Erc721 extends Contract {
  methods: Erc721Methods
  name: string
}

interface Erc721HarnessMethods extends Erc721Methods {}

export interface Erc721Harness extends Contract {
  methods: Erc721HarnessMethods
  name: string
}
