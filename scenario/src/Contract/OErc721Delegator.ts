import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { OTokenExMethods } from './OTokenEx';
import { encodedNumber } from '../Encoding';

interface OErc721DelegatorMethods extends OTokenExMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

export interface OErc721Delegator extends Contract {
  methods: OErc721DelegatorMethods;
  name: string;
}

export interface OErc721DelegatorScenario extends Contract {
  methods: OErc721DelegatorMethods;
  name: string;
}
