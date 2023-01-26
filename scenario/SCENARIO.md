
# Types
* `name:<Type>` - Helper to describe arguments with names, not actually input this way
* `<Bool>` - `True` or `False`
* `<Number>` - A standard number (e.g. `5` or `6.0` or `10.0e18`)
* `<OToken>` - The local name for a given oToken when created, e.g. `oZRX`
* `<User>` - One of: `Admin, Bank, Geoff, Torrey, Robert, Coburn, Jared`
* `<String>` - A string, may be quoted but does not have to be if a single-word (e.g. `"Mint"` or `Mint`)
* `<Address>` - TODO
* `<Assertion>` - See assertions below.

# Events

## Core Events

* "History n:<Number>=5" - Prints history of actions
  * E.g. "History"
  * E.g. "History 10"
* `Read ...` - Reads given value and prints result
  * E.g. `Read OToken oBAT ExchangeRateStored` - Returns exchange rate of oBAT
* `Assert <Assertion>` - Validates given assertion, raising an exception if assertion fails
  * E.g. `Assert Equal (Erc20 BAT TokenBalance Geoff) (Exactly 5.0)` - Returns exchange rate of oBAT
* `FastForward n:<Number> Blocks` - For `OTokenScenario`, moves the block number forward n blocks. Note: in `OTokenScenario` the current block number is mocked (starting at 100000). Thus, this is the only way for the protocol to see a higher block number (for accruing interest).
  * E.g. `FastForward 5 Blocks` - Move block number forward 5 blocks.
* `Inspect` - Prints debugging information about the world
* `Debug message:<String>` - Same as inspect but prepends with a string
* `From <User> <Event>` - Runs event as the given user
  * E.g. `From Geoff (OToken oZRX Mint 5e18)`
* `Invariant <Invariant>` - Adds a new invariant to the world which is checked after each transaction
  * E.g. `Invariant Static (OToken oZRX TotalSupply)`
* `WipeInvariants` - Removes all invariants.
* `Comptroller <ComptrollerEvent>` - Runs given Comptroller event
  * E.g. `Comptroller _setReserveFactor 0.5`
* `OToken <OTokenEvent>` - Runs given OToken event
  * E.g. `OToken oZRX Mint 5e18`
* `Erc20 <Erc20Event>` - Runs given Erc20 event
  * E.g. `Erc20 ZRX Facuet Geoff 5e18`
* `InterestRateModel ...event` - Runs given interest rate model event
  * E.g. `InterestRateModel Deployed (Fixed 0.5)`
* `PriceOracle <PriceOracleEvent>` - Runs given Price Oracle event
  * E.g. `PriceOracle SetPrice oZRX 1.5`

## Comptroller Events

* "Comptroller Deploy ...comptrollerParams" - Generates a new Comptroller
  * E.g. "Comptroller Deploy Scenario (PriceOracle Address) 0.1 10"
* `Comptroller SetPaused action:<String> paused:<Bool>` - Pauses or unpaused given oToken function (e.g. Mint)
  * E.g. `Comptroller SetPaused Mint True`
* `Comptroller SupportMarket <OToken>` - Adds support in the Comptroller for the given oToken
  * E.g. `Comptroller SupportMarket oZRX`
* `Comptroller EnterMarkets <User> <OToken> ...` - User enters the given markets
  * E.g. `Comptroller EnterMarkets Geoff oZRX oETH`
* `Comptroller SetMaxAssets <Number>` - Sets (or resets) the max allowed asset count
  * E.g. `Comptroller SetMaxAssets 4`
* `OToken <oToken> SetOracle oracle:<Contract>` - Sets the oracle
  * E.g. `Comptroller SetOracle (Fixed 1.5)`
* `Comptroller SetCollateralFactor <OToken> <Number>` - Sets the collateral factor for given oToken to number
  * E.g. `Comptroller SetCollateralFactor oZRX 0.1`
* `FastForward n:<Number> Blocks` - Moves the block number forward `n` blocks. Note: in `OTokenScenario` and `ComptrollerScenario` the current block number is mocked (starting at 100000). This is the only way for the protocol to see a higher block number (for accruing interest).
  * E.g. `Comptroller FastForward 5 Blocks` - Move block number forward 5 blocks.

## oToken Events

* `OToken Deploy name:<OToken> underlying:<Contract> comptroller:<Contract> interestRateModel:<Contract> initialExchangeRate:<Number> decimals:<Number> admin:<Address>` - Generates a new comptroller and sets to world global
  * E.g. `OToken Deploy oZRX (Erc20 ZRX Address) (Comptroller Address) (InterestRateModel Address) 1.0 18`
* `OToken <oToken> AccrueInterest` - Accrues interest for given token
  * E.g. `OToken oZRX AccrueInterest`
* `OToken <oToken> Mint <User> amount:<Number>` - Mints the given amount of oToken as specified user
  * E.g. `OToken oZRX Mint Geoff 1.0`
* `OToken <oToken> Redeem <User> amount:<Number>` - Redeems the given amount of oToken as specified user
      * E.g. `OToken oZRX Redeem Geoff 1.0e18`
* `OToken <oToken> Borrow <User> amount:<Number>` - Borrows the given amount of this oToken as specified user
      * E.g. `OToken oZRX Borrow Geoff 1.0e18`
* `OToken <oToken> ReduceReserves amount:<Number>` - Reduces the reserves of the oToken
      * E.g. `OToken oZRX ReduceReserves 1.0e18`
* `OToken <oToken> SetReserveFactor amount:<Number>` - Sets the reserve factor for the oToken
      * E.g. `OToken oZRX SetReserveFactor 0.1`
* `OToken <oToken> SetInterestRateModel interestRateModel:<Contract>` - Sets the interest rate model for the given oToken
  * E.g. `OToken oZRX SetInterestRateModel (Fixed 1.5)`
* `OToken <oToken> SetComptroller comptroller:<Contract>` - Sets the comptroller for the given oToken
  * E.g. `OToken oZRX SetComptroller Comptroller`
* `OToken <oToken> Mock variable:<String> value:<Number>` - Mocks a given value on oToken. Note: value must be a supported mock and this will only work on a OTokenScenario contract.
  * E.g. `OToken oZRX Mock totalBorrows 5.0e18`
  * E.g. `OToken oZRX Mock totalReserves 0.5e18`

## Erc-20 Events

* `Erc20 Deploy name:<Erc20>` - Generates a new ERC-20 token by name
  * E.g. `Erc20 Deploy ZRX`
* `Erc20 <Erc20> Approve <User> <Address> <Amount>` - Adds an allowance between user and address
  * E.g. `Erc20 ZRX Approve Geoff oZRX 1.0e18`
* `Erc20 <Erc20> Faucet <Address> <Amount>` - Adds an arbitrary balance to given user
  * E.g. `Erc20 ZRX Facuet Geoff 1.0e18`

## Price Oracle Events

* `Deploy` - Generates a new price oracle (note: defaults to (Fixed 1.0))
  * E.g. `PriceOracle Deploy (Fixed 1.0)`
  * E.g. `PriceOracle Deploy Simple`
  * E.g. `PriceOracle Deploy NotPriceOracle`
* `SetPrice <OToken> <Amount>` - Sets the per-ether price for the given oToken
  * E.g. `PriceOracle SetPrice oZRX 1.0`

## Interest Rate Model Events

## Deploy

* `Deploy params:<String[]>` - Generates a new interest rate model (note: defaults to (Fixed 0.25))
  * E.g. `InterestRateModel Deploy (Fixed 0.5)`
  * E.g. `InterestRateModel Deploy Whitepaper`

# Values

## Core Values

* `True` - Returns true
* `False` - Returns false
* `Zero` - Returns 0
* `Some` - Returns 100e18
* `Little` - Returns 100e10
* `Exactly <Amount>` - Returns a strict numerical value
  * E.g. `Exactly 5.0`
* `Exp <Amount>` - Returns the mantissa for a given exp
  * E.g. `Exp 5.5`
* `Precisely <Amount>` - Matches a number to given number of significant figures
  * E.g. `Exactly 5.1000` - Matches to 5 sig figs
* `Anything` - Matches anything
* `Nothing` - Matches nothing
* `Default value:<Value> default:<Value>` - Returns value if truthy, otherwise default. Note: this does short-circuit
* `LastContract` - Returns the address of last constructed contract
* `User <...>` - Returns User value (see below)
* `Comptroller <...>` - Returns Comptroller value (see below)
* `OToken <...>` - Returns OToken value (see below)
* `Erc20 <...>` - Returns Erc20 value (see below)
* `InterestRateModel <...>` - Returns InterestRateModel value (see below)
* `PriceOracle <...>` - Returns PriceOracle value (see below)

## User Values

* `User <User> Address` - Returns address of user
  * E.g. `User Geoff Address` - Returns Geoff's address

## Comptroller Values

* `Comptroller Liquidity <User>` - Returns a given user's trued up liquidity
  * E.g. `Comptroller Liquidity Geoff`
* `Comptroller MembershipLength <User>` - Returns a given user's length of membership
  * E.g. `Comptroller MembershipLength Geoff`
* `Comptroller CheckMembership <User> <OToken>` - Returns one if user is in asset, zero otherwise.
  * E.g. `Comptroller CheckMembership Geoff oZRX`
* "Comptroller CheckListed <OToken>" - Returns true if market is listed, false otherwise.
  * E.g. "Comptroller CheckListed oZRX"

## OToken Values
* `OToken <OToken> UnderlyingBalance <User>` - Returns a user's underlying balance (based on given exchange rate)
  * E.g. `OToken oZRX UnderlyingBalance Geoff`
* `OToken <OToken> BorrowBalance <User>` - Returns a user's borrow balance (including interest)
  * E.g. `OToken oZRX BorrowBalance Geoff`
* `OToken <OToken> TotalBorrowBalance` - Returns the oToken's total borrow balance
  * E.g. `OToken oZRX TotalBorrowBalance`
* `OToken <OToken> Reserves` - Returns the oToken's total reserves
  * E.g. `OToken oZRX Reserves`
* `OToken <OToken> Comptroller` - Returns the oToken's comptroller
  * E.g. `OToken oZRX Comptroller`
* `OToken <OToken> PriceOracle` - Returns the oToken's price oracle
  * E.g. `OToken oZRX PriceOracle`
* `OToken <OToken> ExchangeRateStored` - Returns the oToken's exchange rate (based on balances stored)
  * E.g. `OToken oZRX ExchangeRateStored`
* `OToken <OToken> ExchangeRate` - Returns the oToken's current exchange rate
  * E.g. `OToken oZRX ExchangeRate`

## Erc-20 Values

* `Erc20 <Erc20> Address` - Returns address of ERC-20 contract
  * E.g. `Erc20 ZRX Address` - Returns ZRX's address
* `Erc20 <Erc20> Name` - Returns name of ERC-20 contract
  * E.g. `Erc20 ZRX Address` - Returns ZRX's name
* `Erc20 <Erc20> Symbol` - Returns symbol of ERC-20 contract
  * E.g. `Erc20 ZRX Symbol` - Returns ZRX's symbol
* `Erc20 <Erc20> Decimals` - Returns number of decimals in ERC-20 contract
  * E.g. `Erc20 ZRX Decimals` - Returns ZRX's decimals
* `Erc20 <Erc20> TotalSupply` - Returns the ERC-20 token's total supply
  * E.g. `Erc20 ZRX TotalSupply`
  * E.g. `Erc20 oZRX TotalSupply`
* `Erc20 <Erc20> TokenBalance <Address>` - Returns the ERC-20 token balance of a given address
  * E.g. `Erc20 ZRX TokenBalance Geoff` - Returns a user's ZRX balance
  * E.g. `Erc20 oZRX TokenBalance Geoff` - Returns a user's oZRX balance
  * E.g. `Erc20 ZRX TokenBalance oZRX` - Returns oZRX's ZRX balance
* `Erc20 <Erc20> Allowance owner:<Address> spender:<Address>` - Returns the ERC-20 allowance from owner to spender
  * E.g. `Erc20 ZRX Allowance Geoff Torrey` - Returns the ZRX allowance of Geoff to Torrey
  * E.g. `Erc20 oZRX Allowance Geoff Coburn` - Returns the oZRX allowance of Geoff to Coburn
  * E.g. `Erc20 ZRX Allowance Geoff oZRX` - Returns the ZRX allowance of Geoff to the oZRX oToken

## PriceOracle Values

* `Address` - Gets the address of the global price oracle
* `Price asset:<Address>` - Gets the price of the given asset

## Interest Rate Model Values

* `Address` - Gets the address of the global interest rate model

# Assertions

* `Equal given:<Value> expected:<Value>` - Asserts that given matches expected.
  * E.g. `Assert Equal (Exactly 0) Zero`
  * E.g. `Assert Equal (OToken oZRX TotalSupply) (Exactly 55)`
  * E.g. `Assert Equal (OToken oZRX Comptroller) (Comptroller Address)`
* `True given:<Value>` - Asserts that given is true.
  * E.g. `Assert True (Comptroller CheckMembership Geoff oETH)`
* `False given:<Value>` - Asserts that given is false.
  * E.g. `Assert False (Comptroller CheckMembership Geoff oETH)`
* `Failure error:<String> info:<String> detail:<Number?>` - Asserts that last transaction had a graceful failure with given error, info and detail.
  * E.g. `Assert Failure UNAUTHORIZED SUPPORT_MARKET_OWNER_CHECK`
  * E.g. `Assert Failure MATH_ERROR MINT_CALCULATE_BALANCE 5`
* `Revert` - Asserts that the last transaction reverted.
* `Success` - Asserts that the last transaction completed successfully (that is, did not revert nor emit graceful failure).
* `Log name:<String> ((key:<String> value:<Value>) ...)` - Asserts that last transaction emitted log with given name and key-value pairs.
  * E.g. `Assert Log Minted (("account" (User Geoff address)) ("amount" (Exactly 55)))`
