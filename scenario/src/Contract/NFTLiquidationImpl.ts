import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { encodedNumber } from '../Encoding';

interface NFTLiquidationImplMethods {
  _become(
    nftLiquidation: string
  ): Sendable<string>;

}

export interface NFTLiquidationImpl extends Contract {
  methods: NFTLiquidationImplMethods;
}
