import { waffle } from "hardhat"
import { expect } from "chai"
import { BigNumber, BigNumberish } from 'ethers'

import { compoundFixture } from "./utilities/fixtures"

import { ERC20 } from "../types/ERC20"
import { CompoundStaking } from "../types/CompoundStaking"

describe("Bounding", () => {
  const [wallet, other] = waffle.provider.getWallets()

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before("create fixture loader", async () => {
    loadFixture = waffle.createFixtureLoader([wallet, other], waffle.provider)
  })

  let gton: ERC20
  let compound: CompoundStaking

  beforeEach("deploy test contracts", async () => {
    ; ({
      gton,
      compound
    } = await loadFixture(compoundFixture))

  })

  it("constructor initializes variables", async () => {
    const lastBlock = (await waffle.provider.getBlock("latest")).number
    expect(await compound.owner()).to.eq(wallet.address)
    expect(await compound.tokenPerBlock()).to.eq(BigNumber.from("10000000"))
    expect(await compound.totalShares()).to.eq(0)
    expect(await compound.potentiallyMinted()).to.eq(0)
    expect(await compound.lastRewardBlock()).to.eq(lastBlock)
    expect(await compound.requiredBalance()).to.eq(0)
  })

  it("transfer ownership", async () => {
    await expect(compound.connect(other).transferOwnership(wallet.address)).to.be.revertedWith('Compound: permitted to owner only.')
    await compound.transferOwnership(other.address)
    expect(await compound.owner()).to.eq(other.address)
  })

  it("set token per block", async () => {
    await expect(compound.connect(other).setTokenPerBlock(BigNumber.from("100"))).to.be.revertedWith('Compound: permitted to owner only.')
    await compound.setTokenPerBlock(BigNumber.from("100"))
    expect(await compound.tokenPerBlock()).to.eq(BigNumber.from("100"))
  })

  it("withdraw token", async () => {
    const amount = BigNumber.from(15000000000000)
    gton.transfer(compound.address, amount)
    await expect(compound.connect(other).withdrawToken(gton.address, wallet.address, amount)).to.be.revertedWith('Compound: permitted to owner only')
    await compound.withdrawToken(gton.address, other.address, amount)
    expect(await gton.balanceOf(other.address)).to.eq(amount)
    expect(await gton.balanceOf(compound.address)).to.eq(0)
    await expect(compound.withdrawToken(gton.address, other.address, amount.add(1))).to.be.reverted
  })

  it("update reward pool", async () => {

  })

  it("deposit", async () => {

  })

  it("pending reward", async () => {

  })

  it("withdraw", async () => {

  })

  it("withdraw all", async () => {

  })

})