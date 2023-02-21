import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';

interface NFTLiquidationProxyMethods {
  admin(): Callable<string>;
  pendingAdmin(): Callable<string>;
  _acceptAdmin(): Sendable<number>;
  _setPendingAdmin(pendingAdmin: string): Sendable<number>;
  _setPendingImplementation(pendingImpl: string): Sendable<number>;
  nftLiquidationImplementation(): Callable<string>;
  pendingNFTLiquidationImplementation(): Callable<string>;
}

export interface NFTLiquidationProxy extends Contract {
  methods: NFTLiquidationProxyMethods;
}
