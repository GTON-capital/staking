import { waffle } from "hardhat"
import { expect } from "chai"
import { BigNumber, BigNumberish } from 'ethers'

import { compoundFixture } from "./utilities/fixtures"
import { mineBlocks, expandTo18Decimals } from "./utilities/index"

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
    const updRewardData = [
        {
            period: 100,
            rewardPerBlock: BigNumber.from("1000000000")
        },
        {
            period: 1000,
            rewardPerBlock: BigNumber.from("243000000000")
        },
        {
            period: 5000,
            rewardPerBlock: BigNumber.from("890000000")
        },
    ]
    async function testUpdateReward({ period, rewardPerBlock }: { period: number, rewardPerBlock: BigNumber }) {
        await compound.setTokenPerBlock(rewardPerBlock);
        const lrb = await compound.lastRewardBlock();
        const potential = await compound.potentiallyMinted();
        const required = await compound.requiredBalance();
        await mineBlocks(waffle.provider, period - 1) // to count upcoming txn
        await compound.updateRewardPool();
        const minted = rewardPerBlock.mul(period)
        expect(await compound.potentiallyMinted()).to.eq(potential.add(minted))
        expect(await compound.requiredBalance()).to.eq(required.add(minted))
        expect(await compound.lastRewardBlock()).to.eq(lrb.add(period))
    }

    it("update reward pool", async () => {
        for (const item of updRewardData) {
            await testUpdateReward(item)
        }
    })

    it("deposit", async () => {
        const amount = expandTo18Decimals(256)
        const tpb = await compound.tokenPerBlock()
        await expect(compound.deposit(0)).to.be.revertedWith("Compound: Nothing to deposit")
        await expect(compound.deposit(amount)).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
        await gton.approve(compound.address, amount);
        await compound.deposit(amount)
        // 0 total shares
        const res = await compound.userInfo(wallet.address)
        expect(res.share).to.eq(amount)
        expect(await compound.totalShares()).to.eq(amount)
        expect(await compound.requiredBalance()).to.eq(amount.add(tpb.mul(4))) // by the amount of sent txn in rows (98-101)

        const amount2 = expandTo18Decimals(150)
        await gton.transfer(other.address, amount2)
        await gton.connect(other).approve(compound.address, amount2);

        const totalShares = await compound.totalShares()
        const requiredBalance = await compound.requiredBalance()
        const currentShare = amount2.mul(totalShares).div(requiredBalance.add(tpb.mul(3))); // by the amount of sent txn in rows (109-110 and 118)

        await compound.connect(other).deposit(amount2)

        const res2 = await compound.userInfo(other.address)
        expect(res2.share).to.eq(currentShare)
        expect(await compound.totalShares()).to.eq(totalShares.add(currentShare))
        expect(await compound.requiredBalance()).to.eq(requiredBalance.add(tpb.mul(3)).add(amount2))
    })
    
    async function testWithdraw(amountIn: BigNumber) {
        
    }

    it("withdraw", async () => {
        const amount = expandTo18Decimals(115)
        const period = 50
        await gton.approve(compound.address, amount)

        await compound.deposit(amount)
        await mineBlocks(waffle.provider, period)
        await expect(compound.withdraw(0)).to.be.revertedWith("Compound: Nothing to withdraw")
        const share = (await compound.userInfo(wallet.address)).share
        
        await expect(compound.withdraw(share.add(expandTo18Decimals(1000)))).to.be.revertedWith("Compound: Withdraw amount exceeds balance")
        await expect(compound.withdraw(share)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
        await gton.transfer(compound.address, await gton.balanceOf(wallet.address));
        
        await compound.withdraw(share)
    })

    it("pending reward", async () => {

    })

    it("withdraw all", async () => {

    })

})