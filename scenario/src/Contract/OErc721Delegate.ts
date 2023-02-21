import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { OTokenExMethods } from './OTokenEx';

interface OErc721DelegateMethods extends OTokenExMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface OErc721Delegate extends Contract {
  methods: OErc721DelegateMethods;
  name: string;
}

export interface OErc721DelegateScenario extends Contract {
  methods: OErc721DelegateMethods;
  name: string;
}
