import { waffle, ethers } from "hardhat"
import { expect } from "chai"
import { BigNumber, BigNumberish, constants, Contract, Wallet } from 'ethers'
const { AddressZero } = constants
import { compoundFixture } from "./utilities/fixtures"
import { mineBlocks, expandTo18Decimals } from "./utilities/index"

import { ERC20 } from "../types/ERC20"
import { CompoundStaking } from "../types/CompoundStaking"

describe("Compound", () => {
    const [wallet, admin0, admin1, alice, bob, denice, fedor, other] = waffle.provider.getWallets()

    let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

    before("create fixture loader", async () => {
        loadFixture = waffle.createFixtureLoader([wallet, admin0, admin1, other], waffle.provider)
    })

    let gton: ERC20
    let compound: CompoundStaking
    let lib: Contract
    beforeEach("deploy test contracts", async () => {
        ; ({
            gton,
            compound,
            lib
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
        await expect(compound.connect(other).setBlocksInYear(BigNumber.from("100"))).to.be.revertedWith('Compound: permitted to admins only.')
        await compound.setBlocksInYear(blocksInYear)
        expect(await compound.blocksInYear()).to.eq(blocksInYear)

        // expect admin update biy
        await compound.connect(admin0).setBlocksInYear(blocksInYear.add(1000))
        expect(await compound.blocksInYear()).to.eq(blocksInYear.add(1000))
    })

    it("setAdmins", async () => {
        await expect(compound.connect(other).setAdmins([alice.address, bob.address])).to.be.revertedWith('Compound: permitted to owner only.')
        // expect admin to fail to setAdmins
        await expect(compound.connect(admin0).setAdmins([alice.address, bob.address])).to.be.revertedWith('Compound: permitted to owner only.')
        await compound.setAdmins([alice.address, bob.address]);
        // 0 and 1 indicies are for admin0 and admin1
        expect(await compound.lpAdmins(2)).to.eq(alice.address);
        expect(await compound.lpAdmins(3)).to.eq(bob.address);
    })

    it("removeAdmins", async () => {
        await compound.setAdmins([alice.address, bob.address, other.address]);
        // expect admin to fail to removeAdmins
        await expect(compound.connect(admin0).removeAdmins([admin0.address])).to.be.revertedWith('Compound: permitted to owner only.')
        // 0 and 1 indicies are for admin0 and admin1
        expect(await compound.lpAdmins(2)).to.eq(alice.address);
        expect(await compound.lpAdmins(3)).to.eq(bob.address);
        await compound.removeAdmins([alice.address, other.address]);
        expect(await compound.lpAdmins(2)).to.eq(bob.address);
        await expect(compound.lpAdmins(3)).to.be.reverted;
    })

    it("set apys", async () => {
        // random numbers
        const apyUp = BigNumber.from("140")
        const apyDown = BigNumber.from("13")
        await expect(compound.connect(other).setApy(apyUp, apyDown)).to.be.revertedWith('Compound: permitted to admins only.')
        await compound.setApy(apyUp, apyDown)
        expect(await compound.apyUp()).to.eq(apyUp)
        expect(await compound.apyDown()).to.eq(apyDown)

        const apyUpAdmin = BigNumber.from("5977")
        const apyDownAdmin = BigNumber.from("854")
        await compound.connect(admin0).setApy(apyUpAdmin, apyDownAdmin)
        expect(await compound.apyUp()).to.eq(apyUpAdmin)
        expect(await compound.apyDown()).to.eq(apyDownAdmin)
    })

    it("withdraw token", async () => {
        const amount = BigNumber.from(15000000000000)
        gton.transfer(compound.address, amount)
        await expect(compound.connect(other).withdrawToken(gton.address, wallet.address, amount)).to.be.revertedWith('Compound: permitted to owner only')
        // expect admin to fail to withdraw
        await expect(compound.connect(admin0).withdrawToken(gton.address, wallet.address, amount)).to.be.revertedWith('Compound: permitted to owner only')
        await compound.withdrawToken(gton.address, other.address, amount)
        expect(await gton.balanceOf(other.address)).to.eq(amount)
        expect(await gton.balanceOf(compound.address)).to.eq(0)
        await expect(compound.withdrawToken(gton.address, other.address, amount.add(1))).to.be.reverted
    })
    const updRewardData = [
        {
            period: 100,
            apyUp: BigNumber.from("120000000"),
            apyDown: BigNumber.from("1000000000"),
            amount: expandTo18Decimals(150),
            user: bob,
            blocksInYear: BigNumber.from("1012"),
        },
        {
            period: 1000,
            apyUp: BigNumber.from("7500000"),
            apyDown: BigNumber.from("10000000"),
            amount: expandTo18Decimals(897),
            user: alice,
            blocksInYear: BigNumber.from("9214"),
        },
        {
            period: 5000,
            apyUp: BigNumber.from("9000"),
            apyDown: BigNumber.from("100000"),
            amount: expandTo18Decimals(54000),
            user: fedor,
            blocksInYear: BigNumber.from("15266"),
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
        await mineBlocks(waffle.provider, period - 1) // to count upcoming txn
        const tpb = await getTokenPerBlock()
        const minted = tpb.mul(period)
        await compound.updateRewardPool();
        expect(await compound.potentiallyMinted()).to.eq(potential.add(minted))
        expect(await compound.requiredBalance()).to.eq(required.add(minted))
        expect(await compound.lastRewardBlock()).to.eq(lrb.add(period))
    }

    async function requiredBalanceAfterUpdateReward(blockperiod: number): Promise<BigNumber> {
        const required = await compound.requiredBalance();
        const tpb = await getTokenPerBlock()
        const minted = tpb.mul(blockperiod)
        return required.add(minted)
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
        const requiredAfter = await requiredBalanceAfterUpdateReward(3) // transfer + approve + upcoming mint
        const totalShares = await compound.totalShares()
        const currentShare = amount2.mul(totalShares).div(requiredAfter)
        await compound.connect(other).mint(amount2, other.address)
        const res2 = await compound.userInfo(other.address)
        expect(res2.share).to.eq(currentShare)
        // expect(res2.tokenAtLastUserAction).to.eq(currentShare)
        expect(await compound.totalShares()).to.eq(totalShares.add(currentShare))
        expect(await compound.requiredBalance()).to.eq(requiredAfter.add(amount2))
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
        const updRequiredBalance = requiredBalance.add(tpb.mul(55)) // hasn't updated since mineBlocs call so it's 50 + 5
        const currentAmount = updRequiredBalance.mul(share).div(totalShares)

        const user = await compound.userInfo(wallet.address)
        expect(user.share).to.eq(0)

        expect(await compound.requiredBalance()).to.eq(updRequiredBalance.sub(currentAmount))
        expect(await compound.totalShares()).to.eq(totalShares.sub(share))
        expect(await gton.balanceOf(wallet.address)).to.eq(balanceBefore.add(currentAmount))
        expect(user.tokenAtLastUserAction).to.eq(await compound.balanceOf(wallet.address))
    })
    function balanceToShare(amount: BigNumber, totalSupply: BigNumber, totalShares: BigNumber): BigNumber {
        return amount.mul(totalShares).div(totalSupply);
    }
    async function futureTotalSupply(blocks: number): Promise<BigNumber> {
        const tokenPerBlock = await getTokenPerBlock()
        const required = await compound.requiredBalance();
        const lastRewardBlock = await compound.lastRewardBlock();
        const delta = (await waffle.provider.getBlock("latest")).number + blocks - lastRewardBlock.toNumber();
        const potentialMint = tokenPerBlock.mul(delta);
        return required.add(potentialMint);
    }
    it("transfer", async () => {
        const amount = BigNumber.from("1150200000000")
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)
        await mineBlocks(waffle.provider, 10)
        const balance = await compound.balanceOf(wallet.address)
        
        const share = balanceToShare(balance, await futureTotalSupply(1), await compound.totalShares())
        console.log("Share = "+share.toString());
        
        const shareBefore = (await compound.userInfo(wallet.address)).share

        await compound.transfer(other.address, balance)
        const res = await compound.userInfo(other.address)
        const resWallet = await compound.userInfo(wallet.address)
        console.log(res.share.toString());
        console.log(resWallet.share.toString());
        
        expect(resWallet.share).to.eq(shareBefore.sub(share))
        expect(res.share).to.eq(share) // tpb for transfer option
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
        const tpb = await getTokenPerBlock()

        await mineBlocks(waffle.provider, 10)
        await expect(compound.connect(bob).transferFrom(wallet.address, bob.address, 15)).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
        const balance = await compound.balanceOf(wallet.address)
        // upcoming approve and transfer from blocks
        const share = balanceToShare(balance, await futureTotalSupply(2), await compound.totalShares())
        const shareBefore = (await compound.userInfo(wallet.address)).share
        await compound.approve(bob.address, balance)
        await compound.connect(bob).transferFrom(wallet.address, bob.address, balance)

        expect(await compound.allowance(wallet.address, bob.address)).to.eq(0)
        const res = await compound.userInfo(bob.address)
        const resWallet = await compound.userInfo(wallet.address)
        expect(res.share).to.eq(share)
        expect(resWallet.share).to.eq(shareBefore.sub(share))
        expect(await compound.balanceOf(bob.address)).to.eq(await compound.shareToBalance(share))
    })
    it("transferShare", async () => {
        const amount = BigNumber.from("1012401999998")
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)
        await mineBlocks(waffle.provider, 10)
        expect((await compound.userInfo(wallet.address)).share).to.eq(amount)

        await compound.transferShare(alice.address, amount.div(2))

        expect((await compound.userInfo(wallet.address)).share).to.eq(amount.div(2))
        expect((await compound.userInfo(alice.address)).share).to.eq(amount.div(2))

    })

    it("balanceToShare", async () => {
        const amount = expandTo18Decimals(789)
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)

        const user = await compound.userInfo(wallet.address)

        expect(await compound.balanceToShare(await compound.balanceOf(wallet.address))).to.eq(user.share)

        await mineBlocks(waffle.provider, 20)

        expect(await compound.balanceToShare(await compound.balanceOf(wallet.address))).to.eq(user.share)
    })

    it("shareToBalance", async () => {
        const amount = BigNumber.from("1012401999999")
        await gton.approve(compound.address, amount);
        await compound.mint(amount, wallet.address)
    })

    context("Apy checking", function () {
        const decimals = BigNumber.from("10000000")

        it("After year APY of each user should be correct and APY of all sc the same", async () => {
            for (const i of updRewardData) {
                const apy = i.apyUp.mul(decimals).div(i.apyDown)
                await compound.setApy(i.apyUp, i.apyDown)
                await compound.setBlocksInYear(i.blocksInYear)
                const balanceAfterYear = i.amount.add(i.amount.mul(apy).div(decimals))
                await gton.approve(compound.address, i.amount);
                await compound.mint(i.amount, i.user.address)

                await mineBlocks(waffle.provider, i.blocksInYear.toNumber())
                expect(await compound.balanceOf(i.user.address)).to.be.closeTo(balanceAfterYear, 10000) // 3000 in wei
            }
        })
        const periods = [2]
        it("After n blocks APY of all sc should be correct for these n blocks", async () => {
            for (const period of periods) {
                for (const i of updRewardData) {
                    const apy = i.apyUp.mul(decimals).div(i.apyDown)
                    await compound.setApy(i.apyUp, i.apyDown)
                    await compound.setBlocksInYear(i.blocksInYear)
                    const balanceAfterYear = i.amount.add(i.amount.mul(apy).div(decimals).div(period))
                    await gton.approve(compound.address, i.amount);
                    await compound.mint(i.amount, i.user.address)

                    await mineBlocks(waffle.provider, i.blocksInYear.div(period).toNumber())
                    // 3000 in wei for less than 5000 gtons and about 5000 in wei for stake more than 50 000 gton
                    // it stated with 10 000 to level out the error of number when working with quarter the year (outdated)
                    expect(await compound.balanceOf(i.user.address)).to.be.closeTo(balanceAfterYear, 10000)
                    await compound.connect(i.user).transferShare(wallet.address, (await compound.userInfo(i.user.address)).share) // clear the users balance
                }
            }

        })

        async function checkUserApy(user: Wallet, blockAmount: number, stakedAmount: BigNumber) {
            const apyUp = await compound.apyUp()
            const apyDown = await compound.apyDown()
            const biy = await compound.blocksInYear()

            const apy = apyUp.mul(decimals).div(apyDown)
            const earned = stakedAmount.mul(apy).mul(blockAmount).div(decimals).div(biy)
            const balanceAfter = stakedAmount.add(earned)

            await mineBlocks(waffle.provider, blockAmount)
            // the approximate amount about 1 gton
            expect(await compound.balanceOf(user.address)).to.be.closeTo(balanceAfter, 1000000000000)
        }

        it("for each user we should emulate several mint and burn actions and calculate APY", async () => {
            await fillUpCompound();
            const fedorAmount = expandTo18Decimals(180)
            await gton.approve(compound.address, fedorAmount)
            await compound.mint(fedorAmount, fedor.address)
            await checkUserApy(fedor, 150, fedorAmount)

            await compound.setApy("1500", "10000") // balance update here
            const balance = await compound.balanceOf(fedor.address)
            const share = balanceToShare(balance, await futureTotalSupply(1), await compound.totalShares())
            console.log(share.toString());
            
            await compound.connect(fedor).transfer(admin0.address, balance)
            console.log("s"+await (await compound.userInfo(admin0.address)).share.toString());
            console.log("s"+await (await compound.userInfo(fedor.address)).share.toString());
            console.log("b"+await (await compound.balanceOf(admin0.address)).toString());
            console.log("b"+await (await compound.balanceOf(fedor.address)).toString());
            
            // await checkUserApy(admin0, 100, share)

        })

        it("if no one farms there should be 0 income at any block after somebody got in, his APY should suite rules", async () => {
            await mineBlocks(waffle.provider, 100);
            expect(await compound.potentiallyMinted()).to.eq(0)
            expect(await compound.requiredBalance()).to.eq(0)
            expect(await compound.balanceOf(admin1.address)).to.eq(0)

            const amount = expandTo18Decimals(180)
            await gton.approve(compound.address, amount)
            await compound.mint(amount, admin1.address)
            await checkUserApy(admin1, 800, amount)
        })
        // Add checks of the APY when it changes in case of users mint and burn actions (for users and contract in total)
        // Add checks of the block time parameters in the contract and emulate that it has been changed for some time, the APY should be constant
    })

})