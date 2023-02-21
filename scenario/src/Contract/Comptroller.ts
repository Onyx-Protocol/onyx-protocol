import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface ComptrollerMethods {
  getAccountLiquidity(string): Callable<{0: number, 1: number, 2: number}>
  getHypotheticalAccountLiquidity(account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Callable<{0: number, 1: number, 2: number}>
  membershipLength(string): Callable<string>
  checkMembership(user: string, oToken: string): Callable<string>
  getAssetsIn(string): Callable<string[]>
  admin(): Callable<string>
  oracle(): Callable<string>
  maxAssets(): Callable<number>
  liquidationIncentiveMantissa(): Callable<number>
  closeFactorMantissa(): Callable<number>
  getBlockNumber(): Callable<number>
  collateralFactor(string): Callable<string>
  markets(string): Callable<{0: boolean, 1: number, 2?: boolean}>
  _setMintPaused(bool): Sendable<number>
  _setMaxAssets(encodedNumber): Sendable<number>
  _setLiquidationIncentive(encodedNumber): Sendable<number>
  _supportMarket(string): Sendable<number>
  _setPriceOracle(string): Sendable<number>
  _setCollateralFactor(string, encodedNumber): Sendable<number>
  _setCloseFactor(encodedNumber): Sendable<number>
  enterMarkets(markets: string[]): Sendable<number>
  exitMarket(market: string): Sendable<number>
  fastForward(encodedNumber): Sendable<number>
  _setPendingImplementation(string): Sendable<number>
  comptrollerImplementation(): Callable<string>
  unlist(string): Sendable<void>
  admin(): Callable<string>
  pendingAdmin(): Callable<string>
  _setPendingAdmin(string): Sendable<number>
  _acceptAdmin(): Sendable<number>
  _setPauseGuardian(string): Sendable<number>
  pauseGuardian(): Callable<string>
  _setMintPaused(market: string, string): Sendable<number>
  _setBorrowPaused(market: string, string): Sendable<number>
  _setTransferPaused(string): Sendable<number>
  _setSeizePaused(string): Sendable<number>
  _mintGuardianPaused(): Callable<boolean>
  _borrowGuardianPaused(): Callable<boolean>
  transferGuardianPaused(): Callable<boolean>
  seizeGuardianPaused(): Callable<boolean>
  mintGuardianPaused(market: string): Callable<boolean>
  borrowGuardianPaused(market: string): Callable<boolean>
  _addXcnMarkets(markets: string[]): Sendable<void>
  _dropXcnMarket(market: string): Sendable<void>
  getXcnMarkets(): Callable<string[]>
  refreshXcnSpeeds(): Sendable<void>
  xcnRate(): Callable<number>
  xcnSupplyState(string): Callable<string>
  xcnBorrowState(string): Callable<string>
  xcnAccrued(string): Callable<string>
  compReceivable(string): Callable<string>
  xcnSupplierIndex(market: string, account: string): Callable<string>
  xcnBorrowerIndex(market: string, account: string): Callable<string>
  xcnSpeeds(string): Callable<string>
  xcnSupplySpeeds(string): Callable<string>
  xcnBorrowSpeeds(string): Callable<string>
  claimXcn(holder: string): Sendable<void>
  claimXcn(holder: string, oTokens: string[]): Sendable<void>
  updateContributorRewards(account: string): Sendable<void>
  _grantXcn(account: string, encodedNumber): Sendable<void>
  _setXcnRate(encodedNumber): Sendable<void>
  _setXcnSpeed(oTokens: string, encodedNumber): Sendable<void>
  _setXcnSpeeds(oTokens: string[], supplySpeeds: encodedNumber[], borrowSpeeds: encodedNumber[]): Sendable<void>
  supplyCaps(string): Callable<string>
  _setMarketCaps(oTokens:string[], supplyCaps:encodedNumber[], borrowCaps:encodedNumber[]): Sendable<void>
  _setMarketCapGuardian(string): Sendable<void>
  marketCapGuardian(): Callable<string>
  borrowCaps(string): Callable<string>
  isDeprecated(oToken: string): Callable<string>
  setLiquidationProxyAddress(liquidationProxyAddress_:string): Sendable<void>
  getLiquidationProxyAddress(): Callable<string>
}

export interface Comptroller extends Contract {
  methods: ComptrollerMethods
}
