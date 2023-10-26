import { ethers } from "hardhat";
import { UniV3TwapOracle, UniV3TwapOracle__factory } from "../typechain-types";
import {
  COMPTROLLER_ADDRESS, DEFAULT_OTOKEN_DECIMALS,
  DEFAULT_OTOKEN_INITIAL_EXCHANGE_RATE_MANTISSA, GOVERNANCE_TIMELOCK_ADDRESS, OTOKEN_IMPLEMENTATION_ADDRESS,
  PEPE_ADDRESS, PEPE_ETH_UNIV3_POOL,
  TOKEN_JUMP_RATE_MODEL_ADDRESS
} from "./constants";
import readline from 'readline-sync'

async function main() {
  const [account] = await ethers.getSigners();
  const signerAddress = await account.getAddress();

  console.log(
    `Your account is ${signerAddress}, it's balance is ${ethers.formatEther(await ethers.provider.getBalance(signerAddress))} ETH.` +
    " This account will create oPepe token and the oPepe price oracle." +
    "\nDo you want to proceed?"
  );

  const proceed = readline.question('Y/n\n');

  if (!['y', 'yes'].includes(proceed.toLowerCase())) {
    console.log('Bye')
    return;
  }

  const oPepe = await ethers.deployContract("OErc20Delegator", [
    PEPE_ADDRESS, // underlying token address (PEPE)
    COMPTROLLER_ADDRESS, // Comptroller address
    TOKEN_JUMP_RATE_MODEL_ADDRESS, // Interest rate model address
    DEFAULT_OTOKEN_INITIAL_EXCHANGE_RATE_MANTISSA, // initial exchange rate mantissa
    "Onyx PEPE",
    "oPEPE",
    DEFAULT_OTOKEN_DECIMALS, // oToken decimals
    GOVERNANCE_TIMELOCK_ADDRESS, // admin address (Timelock)
    OTOKEN_IMPLEMENTATION_ADDRESS, // implementation address (OErc20Delegate)
    "0x" // become implementation signature (empty)
  ]);

  await oPepe.waitForDeployment();

  const oPepeOracleFactory = await ethers.getContractFactory('UniV3TwapOracle') as UniV3TwapOracle__factory;

  const oPepeOracle = await oPepeOracleFactory.deploy(
    PEPE_ADDRESS, // PEPE token
    PEPE_ETH_UNIV3_POOL, // PEPE/ETH Uni V3 Pool
    3600,
  );

  await oPepeOracle.waitForDeployment();

  await oPepeOracle.setAdmin(
    GOVERNANCE_TIMELOCK_ADDRESS as any // Timelock address
  );

  console.log('Deployed oToken oPEPE, address: ', await oPepe.getAddress());
  console.log('Deployed oracle for oPEPE, address: ', await oPepeOracle.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
