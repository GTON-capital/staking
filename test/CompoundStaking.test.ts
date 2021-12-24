import { waffle } from "hardhat"
import { expect } from "chai"
import { BigNumber, BigNumberish, constants } from 'ethers'
const {AddressZero} = constants
import { compoundFixture } from "./utilities/fixtures"
import { mineBlocks, expandTo18Decimals } from "./utilities/index"

import { ERC20 } from "../types/ERC20"
import { CompoundStaking } from "../types/CompoundStaking"
import { mineBlock } from "../graviton-periphery-evm/test/shared/utilities"

describe("Compound", () => {
    const [wallet, alice, bob, denice, fedor, other] = waffle.provider.getWallets()

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
    async function fillUpCompound() {
        const fedorValue = BigNumber.from("974426000000")
        const deniceValue = BigNumber.from("1000000")
        const bobValue = BigNumber.from("76499200000")

        await gton.transfer(denice.address, deniceValue)
        await gton.connect(denice).approve(compound.address, deniceValue)
        await compound.connect(denice).mint(deniceValue, denice.address)

        await gton.transfer(fedor.address, fedorValue)
        await gton.connect(fedor).approve(compound.address, fedorValue)
        await compound.connect(fedor).mint(fedorValue, fedor.address)

        await gton.transfer(bob.address, bobValue)
        await gton.connect(bob).approve(compound.address, bobValue)
        await compound.connect(bob).mint(bobValue, bob.address)
    }

    it("constructor initializes variables", async () => {
        const lastBlock = (await waffle.provider.getBlock("latest")).number
        expect(await compound.owner()).to.eq(wallet.address)
        expect(await compound.blocksInYear()).to.eq(BigNumber.from("100000"))
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

    it("set Blocks In Year", async () => {
        const blocksInYear = BigNumber.from("100")
        await expect(compound.connect(other).setBlocksInYear(BigNumber.from("100"))).to.be.revertedWith('Compound: permitted to owner only.')
        await compound.setBlocksInYear(blocksInYear)
        expect(await compound.blocksInYear()).to.eq(blocksInYear)
    })

    it("setAdmins", async () => {
        await compound.setAdmins([alice.address, bob.address]);
        expect(await compound.lpAdmins(0)).to.eq(alice.address);
        expect(await compound.lpAdmins(1)).to.eq(bob.address);
    })

    it("removeAdmins", async () => {
        await compound.setAdmins([alice.address, bob.address, other.address]);
        expect(await compound.lpAdmins(0)).to.eq(alice.address);
        await compound.removeAdmins([alice.address, other.address]);
        expect(await compound.lpAdmins(0)).to.eq(bob.address);
        await expect(compound.lpAdmins(1)).to.be.reverted;
    })

    it("set apys", async () => {
        const apyUp = BigNumber.from("140")
        const apyDown = BigNumber.from("13")
        await expect(compound.connect(other).setApy(apyUp, apyDown)).to.be.revertedWith('Compound: permitted to owner only.')
        await compound.setApy(apyUp, apyDown)
        expect(await compound.apyUp()).to.eq(apyUp)
        expect(await compound.apyDown()).to.eq(apyDown)
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
            apyUp: BigNumber.from("10000000"),
            apyDown: BigNumber.from("12400000"),
        },
        {
            period: 1000,
            apyUp: BigNumber.from("1000000000"),
            apyDown: BigNumber.from("7500000"),
        },
        {
            period: 5000,
            apyUp: BigNumber.from("112410000"),
            apyDown: BigNumber.from("9000"),
        },
    ]

    async function getTokenPerBlock(): Promise<BigNumber> {
        const apyUp = await compound.apyUp();
        const apyDown = await compound.apyDown();
        const required = await compound.requiredBalance();
        const blocksInYear = await compound.blocksInYear();
        return apyUp.mul(required).div(apyDown).div(blocksInYear)
    }

    async function testUpdateReward({ period, apyUp, apyDown }: { period: number, apyUp: BigNumber, apyDown: BigNumber }) {
        // await compound.setTokenPerBlock(rewardPerBlock);
        await compound.setApy(apyUp, apyDown);
        const lrb = await compound.lastRewardBlock();
        const potential = await compound.potentiallyMinted();
        const required = await compound.requiredBalance();
        await mineBlocks(waffle.provider, period-2) // to count upcoming txn
        const tpb = await getTokenPerBlock()
        const minted = tpb.mul(period)
        await compound.updateRewardPool();
        expect(await compound.potentiallyMinted()).to.eq(potential.add(minted))
        expect(await compound.requiredBalance()).to.eq(required.add(minted))
        expect(await compound.lastRewardBlock()).to.eq(lrb.add(period))
    }

    it("update reward pool", async () => {
        for (const item of updRewardData) {
            await testUpdateReward(item)
            await fillUpCompound();
        }
    })

    it("mint", async () => {
        const tpb = await getTokenPerBlock()
        const amount = expandTo18Decimals(256)
        await expect(compound.mint(0, wallet.address)).to.be.revertedWith("Compound: Nothing to deposit")
        await expect(compound.mint(amount, wallet.address)).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)
        
        // 0 total shares
        const res = await compound.userInfo(wallet.address)
        expect(res.share).to.eq(amount)
        expect(await compound.totalShares()).to.eq(amount)
        expect(await compound.requiredBalance()).to.eq(amount.add(tpb.mul(4))) // by the amount of sent txn in rows (98-101)

        await fillUpCompound();
        
        const amount2 = expandTo18Decimals(150)
        await gton.transfer(other.address, amount2)
        await gton.connect(other).approve(compound.address, amount2);

        // const prevBlock = await compound.lastRewardBlock()
        // const totalShares = await compound.totalShares()
        // const requiredBalance = await compound.requiredBalance()

        await compound.connect(other).mint(amount2, other.address)
        // const blockDelta = 1

        // const updatedReq = requiredBalance.add((await getTokenPerBlock()).mul(blockDelta))
        // const currentShare = amount2.mul(totalShares).div(updatedReq); 
        const res2 = await compound.userInfo(other.address)
        expect(res2.share).to.eq("149832117534176254992")
        expect(await compound.totalShares()).to.eq("405832118584492781891")
        expect(await compound.requiredBalance()).to.eq("406286841496373797085")
    })
    
    it("burn", async () => {
        await fillUpCompound(); 

        const amount = expandTo18Decimals(115)
        const period = 50
        await gton.approve(compound.address, amount)

        await compound.mint(amount, wallet.address)
        await mineBlocks(waffle.provider, period)
        await expect(compound.burn(wallet.address, 0)).to.be.revertedWith("Compound: Nothing to burn")
        const share = (await compound.userInfo(wallet.address)).share
        
        await expect(compound.burn(wallet.address, share.add(expandTo18Decimals(1000)))).to.be.revertedWith("Compound: Withdraw amount exceeds balance")
        await expect(compound.burn(wallet.address, share)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
        await gton.transfer(compound.address, await gton.balanceOf(wallet.address));
        
        const requiredBalance = await compound.requiredBalance()
        const totalShares = await compound.totalShares()
        const tpb = await getTokenPerBlock();
        const balanceBefore = await gton.balanceOf(wallet.address)

        await compound.burn(wallet.address, share)
        const updRequiredBalance = requiredBalance.add(tpb.mul(55)) // hasn't updated since mineBlocs call
        const currentAmount = updRequiredBalance.mul(share).div(totalShares)
    
        const user = await compound.userInfo(wallet.address)
        expect(user.share).to.eq(0)
        
        expect(await compound.requiredBalance()).to.eq(updRequiredBalance.sub(currentAmount))
        expect(await compound.totalShares()).to.eq(totalShares.sub(share))
        expect(await gton.balanceOf(wallet.address)).to.eq(balanceBefore.add(currentAmount))
        expect(user.tokenAtLastUserAction).to.eq(await compound.balanceOf(wallet.address))
    })

    it("transfer", async () => {
        const amount = BigNumber.from("1150200000000")
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)

        await mineBlocks(waffle.provider, 10)
        const balance = await compound.balanceOf(wallet.address)
        const share = await compound.balanceToShare(balance)
        await compound.transfer(other.address, balance)
        const res = await compound.userInfo(other.address)
        const resWallet = await compound.userInfo(wallet.address)
        expect(res.share).to.eq(share)
        expect(resWallet.share).to.eq(0)
    })

    it("approve and allowance", async () => {
        const amount = BigNumber.from("10012412401248")
        const secondAmount = BigNumber.from("1000000")
        expect(await compound.allowance(wallet.address, bob.address)).to.eq(0)
        // await expect(compound.approve(wallet.address, 0)).to.be.revertedWith("ERC20: approve to the zero address")
        await compound.approve(alice.address, amount)
        expect(await compound.allowance(wallet.address, alice.address)).to.eq(amount)
        await compound.approve(alice.address, secondAmount)
        expect(await compound.allowance(wallet.address, alice.address)).to.eq(secondAmount)
    })

    it("transferFrom", async () => {
        const amount = BigNumber.from("1012401999999")
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)

        await mineBlocks(waffle.provider, 100)
        await expect(compound.connect(bob).transferFrom(wallet.address, bob.address, 15)).to.be.revertedWith("ERC20: transfer amount exceeds allowance")

        const balance = await compound.balanceOf(wallet.address)
        await compound.approve(bob.address, balance)
        await compound.connect(bob).transferFrom(wallet.address, bob.address, balance.sub(10))
        const share = await compound.balanceToShare(balance.sub(10))

        expect(await compound.allowance(wallet.address,bob.address)).to.eq(10)
        expect(await compound.balanceOf(bob.address)).to.eq(share)

    })
})