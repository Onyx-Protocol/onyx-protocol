
import {Event} from '../Event';
import {addAction, World} from '../World';
import {Erc721} from '../Contract/Erc721';
import {Invokation, invoke} from '../Invokation';
import {
  getAddressV,
  getCoreValue,
  getNumberV,
  getStringV
} from '../CoreValue';
import {
  AddressV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract, getTestContract} from '../Contract';
import {encodeABI} from '../Utils';

const ExistingToken = getContract("IERC721");
const TetherInterface = getContract("TetherInterface");

const Erc721Harness = getContract("ERC721Harness");

export interface TokenData {
  invokation: Invokation<Erc721>,
  description: string,
  name: string,
  symbol: string,
  address?: string,
  contract: string
}

export async function buildErc721(world: World, from: string, event: Event): Promise<{ world: World, erc721: Erc721, tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ symbol: StringV, address: AddressV, name: StringV }, TokenData>(`
        #### Existing

        * "Existing symbol:<String> address:<Address> name:<String>" - Wrap an existing Erc20 token
          * E.g. "Erc721 Deploy Existing BAYC 0x123...
      `,
      "Existing",
      [
        new Arg("symbol", getStringV),
        new Arg("address", getAddressV),
        new Arg("name", getStringV, { default: undefined }),
      ],
      async (world, { symbol, name, address }) => {
        const existingToken = await ExistingToken.at<Erc721>(world, address.val);
        const tokenName = name.val === undefined ? symbol.val : name.val;

        return {
          invokation: new Invokation<Erc721>(existingToken, null, null, null),
          description: "Existing",
          name: tokenName,
          symbol: symbol.val,
          contract: 'ExistingToken'
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV}, TokenData>(`
        #### Standard

        * "Standard symbol:<String> name:<String>" - Standard ERC-721 contract
          * E.g. "Erc721 Deploy Standard BAT \"Basic Attention Token\""
      `,
      "Standard",
      [
        new Arg("symbol", getStringV),
        new Arg("name", getStringV)
      ],
      async (world, {symbol, name}) => {
        return {
          invokation: await Erc721Harness.deploy<Erc721>(world, from, [name.val, symbol.val]),
          description: "Standard",
          name: name.val,
          symbol: symbol.val,
          contract: 'ERC721Harness'
        };
      }
    ),

    new Fetcher<{symbol: StringV, name: StringV}, TokenData>(`
        #### BAYC

        * "BAYC symbol:<String> name:<String>" - The BAYC contract
          * E.g. "Erc721 Deploy BAYC BAYC \"Bored Ape\""
      `,
      "BAYC",
      [
        new Arg("symbol", getStringV, {default: new StringV("BAYC")}),
        new Arg("name", getStringV, {default: new StringV("Bored Ape")})
      ],
      async (world, {symbol, name}) => {
        return {
          invokation: await Erc721Harness.deploy<Erc721>(world, from, []),
          description: "BAYC",
          name: name.val,
          symbol: symbol.val,
          contract: 'ERC721Harness'
        };
      }
    ),
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployErc721", fetchers, world, event);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const erc721 = invokation.value!;
  tokenData.address = erc721._address;

  world = await storeAndSaveContract(
    world,
    erc721,
    tokenData.symbol,
    invokation,
    [
      { index: ['Erc721Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  return {world, erc721, tokenData};
}
