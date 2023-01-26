import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { OTokenMethods, OTokenScenarioMethods } from './OToken';

interface OErc20DelegateMethods extends OTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface OErc20DelegateScenarioMethods extends OTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface OErc20Delegate extends Contract {
  methods: OErc20DelegateMethods;
  name: string;
}

export interface OErc20DelegateScenario extends Contract {
  methods: OErc20DelegateScenarioMethods;
  name: string;
}
