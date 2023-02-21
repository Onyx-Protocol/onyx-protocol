import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface NFTLiquidationMethods {
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  initialize(): Sendable<void>
  _setComptroller(_comptroller): Sendable<void>
  setOEther(_oEther): Sendable<void>
  setProtocolFeeRecipient(_protocolFeeRecipient): Sendable<void>
  setProtocolFeeMantissa(_protocolFeeMantissa): Sendable<void>
  emergencyWithdraw(underlying, withdrawAmount): Sendable<void>
  emergencyWithdrawNFT(underlying, tokenId): Sendable<void>
  liquidateWithSingleRepay(borrower, oTokenCollateral, oTokenRepay, repayAmount): Sendable<void>
  liquidateWithSingleRepayV2(borrower, oTokenCollateral, oTokenRepay, repayAmount, _seizeIndexes, claimOToken): Sendable<number>
  _setPendingImplementation(string): Sendable<void>
  _acceptImplementation(): Sendable<void>
  _setPendingAdmin(newPendingAdmin): Sendable<void>
  _acceptAdmin(): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  nftLiquidationImplementation(): Callable<string>
  pendingNFTLiquidationImplementation(): Callable<string>
  comptroller(): Callable<string>
  oEther(): Callable<string>
  protocolFeeRecipient(): Callable<string>
  protocolFeeMantissa(): Callable<number>
  getSingleTokenExtraRepayAmount(borrower, oTokenCollateral, oTokenRepay, repayAmount): Callable<number>
}

export interface NFTLiquidation extends Contract {
  methods: NFTLiquidationMethods
}
