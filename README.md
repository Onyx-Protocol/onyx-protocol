Onyx Protocol
=================

The Onyx Protocol is an Ethereum smart contract for supplying or borrowing assets. Through the oToken contracts, accounts on the blockchain *supply* capital (Ether or ERC-20 tokens) to receive oTokens or *borrow* assets from the protocol (holding other assets as collateral). The Onyx oToken contracts track these balances and algorithmically set interest rates for borrowers.

Contracts
=========

We detail a few of the core contracts in the Onyx protocol.

<dl>
  <dt>OToken, OErc20 and OEther</dt>
  <dd>The Onyx oTokens, which are self-contained borrowing and lending contracts. OToken contains the core logic and OErc20 and OEther add public interfaces for Erc20 tokens and ether, respectively. Each OToken is assigned an interest rate and risk model (see InterestRateModel and Comptroller sections), and allows accounts to *mint* (supply capital), *redeem* (withdraw capital), *borrow* and *repay a borrow*. Each OToken is an ERC-20 compliant token where balances represent ownership of the market.</dd>
</dl>

<dl>
  <dt>Comptroller</dt>
  <dd>The risk model contract, which validates permissible user actions and disallows actions if they do not fit certain risk parameters. For instance, the Comptroller enforces that each borrowing user must maintain a sufficient collateral balance across all oTokens.</dd>
  <ul>
  <em>Updating the Comptroller</em>
  <li>Follow the existing naming schema (ControllerGX)</li>
  <li>Update the scenario runner in scenario/src/Builder/ComptrollerImplBuilder.ts</li>
  <li>Create unit tests and fork simulations as necessary</li>
  <li>Call <code>npx saddle deploy Comptroller -n mainnet</code> to deploy to mainnet and generate new ABI</li>
  <ul>
    <li>The ABI can also be generated by deploying to mainnet in a fork simulation</li>
  </ul>
  <li>Call <code>node script/comptroller-abi</code> to merge the new Comptroller ABI with the Unitroller ABI</li>
  <li>Ensure that commit contains new generated Comptroller ABI</li>
  </ul>
</dl>

<dl>
  <dt>InterestRateModel</dt>
  <dd>Contracts which define interest rate models. These models algorithmically determine interest rates based on the current utilization of a given market (that is, how much of the supplied assets are liquid versus borrowed).</dd>
</dl>

<dl>
  <dt>Careful Math</dt>
  <dd>Library for safe math operations.</dd>
</dl>

<dl>
  <dt>ErrorReporter</dt>
  <dd>Library for tracking error codes and failure conditions.</dd>
</dl>

<dl>
  <dt>Exponential</dt>
  <dd>Library for handling fixed-point decimal numbers.</dd>
</dl>

<dl>
  <dt>SafeToken</dt>
  <dd>Library for safely handling Erc20 interaction.</dd>
</dl>

<dl>
  <dt>WhitePaperInterestRateModel</dt>
  <dd>Initial interest rate model, as defined in the Whitepaper. This contract accepts a base rate and slope parameter in its constructor.</dd>
</dl>

Installation
------------
To run onyx, pull the repository from GitHub and install its dependencies. You will need [yarn](https://yarnpkg.com/lang/en/docs/install/) or [npm](https://docs.npmjs.com/cli/install) installed.

    git clone https://github.com/onyx-finance/onyx-protocol
    cd onyx-protocol
    yarn install --lock-file # or `npm install`

REPL
----

The Onyx Protocol has a simple scenario evaluation tool to test and evaluate scenarios which could occur on the blockchain. This is primarily used for constructing high-level integration tests. The tool also has a REPL to interact with local the Onyx Protocol (similar to `truffle console`).

    yarn repl -n development
    yarn repl -n rinkeby

    > Read OToken oBAT Address
    Command: Read OToken oBAT Address
    AddressV<val=0xAD53863b864AE703D31b819d29c14cDA93D7c6a6>

You can read more about the scenario runner in the [Scenario Docs](https://github.com/onyx-finance/onyx-protocol/tree/master/scenario/SCENARIO.md) on steps for using the repl.

Testing
-------
Jest contract tests are defined under the [tests directory](https://github.com/onyx-finance/onyx-protocol/tree/master/tests). To run the tests run:

    yarn test

Integration Specs
-----------------

There are additional tests under the [spec/scenario](https://github.com/onyx-finance/onyx-protocol/tree/master/spec/scenario) folder. These are high-level integration tests based on the scenario runner depicted above. The aim of these tests is to be highly literate and have high coverage in the interaction of contracts.

Code Coverage
-------------
To run code coverage, run:

    yarn coverage

Linting
-------
To lint the code, run:

    yarn lint

_© Copyright 2022, Onyx Protocol
