import { Contract, BigNumber, BigNumberish} from "ethers"
import { ethers } from "hardhat"

export const BASE_TEN = 10
export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000"

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: string | number | BigNumber, decimals = 18) {
  return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals))
}
export function expandTo18Decimals(n: BigNumberish): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}
export async function mineBlocks(provider: any, blocks: number): Promise<void> {
  while(blocks > 0) {
      await provider.send("evm_mine")
      blocks -= 1
  }
} 

export async function setTimestamp(provider: any, timestamp: number): Promise<void> {
  await provider.send("evm_mine", [timestamp])
} 

export const time = {
  day: 60*60*24,
  year: 31557600,
  halfYear: 15778800,
  month: 2629800,
}

export * from "./time"
