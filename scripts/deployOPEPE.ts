import { ethers } from "hardhat";
import { UniV3TwapOracle, UniV3TwapOracle__factory } from "../typechain-types";

async function main() {
  const oPepe = await ethers.deployContract("OErc20Delegator", [
    "0x6982508145454Ce325dDbE47a25d4ec3d2311933", // underlying token address (PEPE)
    "0x7D61ed92a6778f5ABf5c94085739f1EDAbec2800", // Comptroller address
    "0x4021047a36AC60b40316F630307cD4791cdAeD52", // Interest rate model address
    0.2e9, // initial exchange rate mantissa
    "Onyx PEPE",
    "oPEPE",
    8, // oToken decimals
    "0x08eDF0F2AF8672029eb445742B3b4072c6158DF3", // admin address (Timelock)
    "0x9dcb6bc351ab416f35aeab1351776e2ad295abc4", // implementation address (OErc20Delegate)
    "0x" // become implementation signature (empty)
  ]);

  await oPepe.waitForDeployment();

  const oPepeOracleFactory = await ethers.getContractFactory('UniV3TwapOracle') as UniV3TwapOracle__factory;

  const oPepeOracle = await oPepeOracleFactory.deploy(
    "0x6982508145454ce325ddbe47a25d4ec3d2311933", // PEPE token
    "0x11950d141ecb863f01007add7d1a342041227b58", // PEPE/ETH Uni V3 Pool
    3600,
  );

  await oPepeOracle.waitForDeployment();

  await oPepeOracle.setAdmin(
    "0x08eDF0F2AF8672029eb445742B3b4072c6158DF3" as any // Timelock address
  );

  console.log('Deployed oToken oPEPE, address: ', await oPepe.getAddress());
  console.log('Deployed oracle for oPEPE, address: ', await oPepeOracle.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
