import { ethers } from "hardhat";
import { OErc20Delegator } from './../typechain-types/OErc20Delegator'
import PEPE from './../abi/PEPE.json'

async function main() {
  const [account] = await ethers.getSigners();
  const signerAddress = await account.getAddress();

  const pepe = await ethers.getContractAt(PEPE, "0x6982508145454Ce325dDbE47a25d4ec3d2311933", account) as OErc20Delegator;
  const opepe = await ethers.getContractAt("OErc20Delegator", "0x5FdBcD61bC9bd4B6D3FD1F49a5D253165Ea11750", account) as OErc20Delegator;

  const balance = await pepe.balanceOf(signerAddress as any)
  await pepe.approve("0x5FdBcD61bC9bd4B6D3FD1F49a5D253165Ea11750" as any, balance as any)
  console.log('PEPE balance:', balance)
  await opepe.mint(balance as any)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
