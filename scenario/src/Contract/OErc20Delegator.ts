import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { OTokenMethods } from './OToken';
import { encodedNumber } from '../Encoding';

interface OErc20DelegatorMethods extends OTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface OErc20DelegatorScenarioMethods extends OErc20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface OErc20Delegator extends Contract {
  methods: OErc20DelegatorMethods;
  name: string;
}

export interface OErc20DelegatorScenario extends Contract {
  methods: OErc20DelegatorMethods;
  name: string;
}
