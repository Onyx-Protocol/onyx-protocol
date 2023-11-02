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
    ' This account will create oPepe token and the oPepe price oracle.'
  );

  const proceed = readline.question('Do you want to proceed? (Y/n)\n');

  if (!['y', 'yes'].includes(proceed.toLowerCase())) {
    console.log('Bye!\n');
    return;
  } else {
    console.log('Creating oPepe token..');
  }

  const oPepe = await ethers.deployContract("OErc20Delegator", [
    PEPE_ADDRESS, // Underlying token address (PEPE)
    COMPTROLLER_ADDRESS,
    TOKEN_JUMP_RATE_MODEL_ADDRESS, // Interest rate model
    DEFAULT_OTOKEN_INITIAL_EXCHANGE_RATE_MANTISSA,
    "Onyx PEPE",
    "oPEPE",
    DEFAULT_OTOKEN_DECIMALS,
    GOVERNANCE_TIMELOCK_ADDRESS, // Admin
    OTOKEN_IMPLEMENTATION_ADDRESS, // OErc20Delegate
    "0x" // Become implementation signature (empty)
  ]);

  await oPepe.waitForDeployment();

  console.log('Creating oPepe price Oracle..');
  const oPepeOracleFactory = await ethers.getContractFactory('UniV3TwapOracle') as UniV3TwapOracle__factory;

  const oPepeOracle = await oPepeOracleFactory.deploy(
    PEPE_ADDRESS,
    PEPE_ETH_UNIV3_POOL,
    3600,
  );

  await oPepeOracle.waitForDeployment();

  await oPepeOracle.setAdmin(
    GOVERNANCE_TIMELOCK_ADDRESS as any
  );

  console.log('Deployed oToken oPEPE, address:', await oPepe.getAddress());
  console.log('Deployed oracle for oPEPE, address:', await oPepeOracle.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
