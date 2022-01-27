import { waffle, ethers } from "hardhat"
import { expect } from "chai"
import { BigNumber, BigNumberish, constants, Contract, Wallet } from 'ethers'
const { AddressZero } = constants
import { stakingFixture } from "./utilities/fixtures"
import { mineBlocks, expandTo18Decimals } from "./utilities/index"

import { ERC20 } from "../types/ERC20"
import { Staking } from "../types/Staking"

describe("Staking", () => {
    const [wallet, admin0, admin1, alice, bob, denice, fedor, other] = waffle.provider.getWallets()

    let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

    before("create fixture loader", async () => {
        loadFixture = waffle.createFixtureLoader([wallet, admin0, admin1, other], waffle.provider)
    })

    let gton: ERC20
    let staking: Staking
    let lib: Contract
    beforeEach("deploy test contracts", async () => {
        ; ({
            gton,
            lib,
            staking
        } = await loadFixture(stakingFixture))

    })
    async function fillUpStaking() {
        const fedorValue = BigNumber.from("974426000000")
        const deniceValue = BigNumber.from("1000000")
        const bobValue = BigNumber.from("76499200000")

        await gton.transfer(denice.address, deniceValue)
        await gton.connect(denice).approve(staking.address, deniceValue)
        await staking.connect(denice).mint(deniceValue, denice.address)

        await gton.transfer(fedor.address, fedorValue)
        await gton.connect(fedor).approve(staking.address, fedorValue)
        await staking.connect(fedor).mint(fedorValue, fedor.address)

        await gton.transfer(bob.address, bobValue)
        await gton.connect(bob).approve(staking.address, bobValue)
        await staking.connect(bob).mint(bobValue, bob.address)
    }

    it("constructor initializes variables", async () => {
        const lastBlock = (await waffle.provider.getBlock("latest")).number
        expect(await staking.owner()).to.eq(wallet.address)
    })

    it("transfer ownership", async () => {
        await expect(staking.connect(other).transferOwnership(wallet.address)).to.be.revertedWith('Staking: permitted to owner only.')
        await staking.transferOwnership(other.address)
        expect(await staking.owner()).to.eq(other.address)
    })

    it("setAdmins", async () => {
        await expect(staking.connect(other).setAdmins([alice.address, bob.address])).to.be.revertedWith('Staking: permitted to owner only.')
        // expect admin to fail to setAdmins
        await expect(staking.connect(admin0).setAdmins([alice.address, bob.address])).to.be.revertedWith('Staking: permitted to owner only.')
        await staking.setAdmins([alice.address, bob.address]);
        // 0 and 1 indicies are for admin0 and admin1
        expect(await staking.lpAdmins(2)).to.eq(alice.address);
        expect(await staking.lpAdmins(3)).to.eq(bob.address);
    })

    it("removeAdmins", async () => {
        await staking.setAdmins([alice.address, bob.address, other.address]);
        // expect admin to fail to removeAdmins
        await expect(staking.connect(admin0).removeAdmins([admin0.address])).to.be.revertedWith('Staking: permitted to owner only.')
        // 0 and 1 indicies are for admin0 and admin1
        expect(await staking.lpAdmins(2)).to.eq(alice.address);
        expect(await staking.lpAdmins(3)).to.eq(bob.address);
        await staking.removeAdmins([alice.address, other.address]);
        expect(await staking.lpAdmins(2)).to.eq(bob.address);
        await expect(staking.lpAdmins(3)).to.be.reverted;
    })

    it("set aprs", async () => {
        // random numbers
        const aprBasisPoints = BigNumber.from("10769")
        await expect(staking.connect(other).setApr(aprBasisPoints)).to.be.revertedWith('Staking: permitted to admins only.')
        await staking.setApr(aprBasisPoints)
        expect(await staking.aprBasisPoints()).to.eq(aprBasisPoints)

        const aprBasisPointsAdmin = BigNumber.from("69988")
        await staking.connect(admin0).setApr(aprBasisPointsAdmin)
        expect(await staking.aprBasisPoints()).to.eq(aprBasisPointsAdmin)
    })

    it("withdraw token", async () => {
        const amount = BigNumber.from(15000000000000)
        gton.transfer(staking.address, amount)
        await expect(staking.connect(other).withdrawToken(gton.address, wallet.address, amount)).to.be.revertedWith('Staking: permitted to owner only')
        // expect admin to fail to withdraw
        await expect(staking.connect(admin0).withdrawToken(gton.address, wallet.address, amount)).to.be.revertedWith('Staking: permitted to owner only')
        await staking.withdrawToken(gton.address, other.address, amount)
        expect(await gton.balanceOf(other.address)).to.eq(amount)
        expect(await gton.balanceOf(staking.address)).to.eq(0)
        await expect(staking.withdrawToken(gton.address, other.address, amount.add(1))).to.be.reverted
    })
    const updRewardData = [
        {
            period: 100,
            aprBasisPoints: BigNumber.from("1200"),
            amount: expandTo18Decimals(150),
            user: bob,
            blocksInYear: BigNumber.from("1012"),
        },
        {
            period: 1000,
            aprBasisPoints: BigNumber.from("75000"),
            amount: expandTo18Decimals(897),
            user: alice,
            blocksInYear: BigNumber.from("9214"),
        },
        {
            period: 5000,
            aprBasisPoints: BigNumber.from("900"),
            amount: expandTo18Decimals(54000),
            user: fedor,
            blocksInYear: BigNumber.from("15266"),
        },
    ]

    async function getTokenPerBlock(): Promise<BigNumber> {
        const aprBasisPoints = await staking.aprBasisPoints();
        const required = await staking.requiredBalance();
        const blocksInYear = await staking.blocksInYear();
        return aprBasisPoints.mul(required).div(10000).div(blocksInYear)
    }

    async function testUpdateReward({ period, aprBasisPoints }: { period: number, aprBasisPoints: BigNumber }) {
        // await staking.setTokenPerBlock(rewardPerBlock);
        await staking.setApr(aprBasisPoints);
        const lrb = await staking.lastRewardBlock();
        // const potential = await staking.potentiallyMinted();
        const required = await staking.requiredBalance();
        await mineBlocks(waffle.provider, period - 1) // to count upcoming txn
        const tpb = await getTokenPerBlock()
        const minted = tpb.mul(period)
        await staking.updateRewardPool();
        // expect(await staking.potentiallyMinted()).to.eq(potential.add(minted))
        expect(await staking.requiredBalance()).to.eq(required.add(minted))
        expect(await staking.lastRewardBlock()).to.eq(lrb.add(period))
    }

    async function requiredBalanceAfterUpdateReward(blockperiod: number): Promise<BigNumber> {
        const required = await staking.requiredBalance();
        const tpb = await getTokenPerBlock()
        const minted = tpb.mul(blockperiod)
        return required.add(minted)
    }

    it("update reward pool", async () => {
        await staking.togglePause();
        await expect(staking.updateRewardPool()).to.be.revertedWith("Staking: contract paused.")
        await staking.togglePause();

        for (const item of updRewardData) {
            await testUpdateReward(item)
            await fillUpStaking();
        }
    })

    /*
    it("mint", async () => {
        const tpb = await getTokenPerBlock()
        const amount = expandTo18Decimals(256)
        await expect(staking.mint(0, wallet.address)).to.be.revertedWith("Staking: Nothing to deposit")
        await expect(staking.mint(amount, wallet.address)).to.be.revertedWith("ERC20: transfer amount exceeds allowance")

        await staking.toggleRevert();
        await expect(staking.mint(amount, wallet.address)).to.be.revertedWith("Staking: contract paused")
        await staking.toggleRevert();

        await gton.approve(staking.address, amount);
        await staking.mint(amount, wallet.address)
        // 0 total shares
        const res = await staking.userInfo(wallet.address)
        // expect(res.share).to.eq(amount)
        expect(await staking.totalShares()).to.eq(amount)
        expect(await staking.requiredBalance()).to.eq(amount.add(tpb.mul(4))) // by the amount of sent txn in rows (98-101)

        await fillUpStaking();

        const amount2 = expandTo18Decimals(150)
        await gton.transfer(other.address, amount2)
        await gton.connect(other).approve(staking.address, amount2);
        const requiredAfter = await requiredBalanceAfterUpdateReward(3) // transfer + approve + upcoming mint
        const totalShares = await staking.totalShares()
        const currentShare = amount2.mul(totalShares).div(requiredAfter)
        await staking.connect(other).mint(amount2, other.address)
        const res2 = await staking.userInfo(other.address)
        expect(res2.share).to.eq(currentShare)
        // expect(res2.tokenAtLastUserAction).to.eq(currentShare)
        expect(await staking.totalShares()).to.eq(totalShares.add(currentShare))
        expect(await staking.requiredBalance()).to.eq(requiredAfter.add(amount2))
    })

    it("burn", async () => {
        await fillUpStaking();

        const amount = expandTo18Decimals(115)
        const period = 50
        await gton.approve(staking.address, amount)

        await staking.mint(amount, wallet.address)
        await mineBlocks(waffle.provider, period)
        await expect(staking.burn(wallet.address, 0)).to.be.revertedWith("Staking: Nothing to burn")
        const share = (await staking.userInfo(wallet.address)).share

        await expect(staking.burn(wallet.address, share.add(expandTo18Decimals(1000)))).to.be.revertedWith("Staking: Withdraw amount exceeds balance")
        await expect(staking.burn(wallet.address, share)).to.be.revertedWith("ERC20: transfer amount exceeds balance")

        await staking.toggleRevert();
        await expect(staking.burn(wallet.address, share)).to.be.revertedWith("Staking: contract paused")
        await staking.toggleRevert();

        await gton.transfer(staking.address, await gton.balanceOf(wallet.address));

        const requiredBalance = await staking.requiredBalance()
        const totalShares = await staking.totalShares()
        const tpb = await getTokenPerBlock();
        const balanceBefore = await gton.balanceOf(wallet.address)

        await staking.burn(wallet.address, share)
        const updRequiredBalance = requiredBalance.add(tpb.mul(58)) // hasn't updated since mineBlocs call so it's 50 + 5 + 3 toggle and failed txn
        const currentAmount = updRequiredBalance.mul(share).div(totalShares)

        const user = await staking.userInfo(wallet.address)
        expect(user.share).to.eq(0)

        expect(await staking.requiredBalance()).to.eq(updRequiredBalance.sub(currentAmount))
        expect(await staking.totalShares()).to.eq(totalShares.sub(share))
        expect(await gton.balanceOf(wallet.address)).to.eq(balanceBefore.add(currentAmount))
        expect(user.tokenAtLastUserAction).to.eq(await staking.balanceOf(wallet.address))
    })
    */
    function balanceToShare(amount: BigNumber, totalSupply: BigNumber, totalShares: BigNumber): BigNumber {
        return amount.mul(totalShares).div(totalSupply);
    }
    async function futureTotalSupply(blocks: number): Promise<BigNumber> {
        const tokenPerBlock = await getTokenPerBlock()
        const required = await staking.requiredBalance();
        const lastRewardBlock = await staking.lastRewardBlock();
        const delta = (await waffle.provider.getBlock("latest")).number + blocks - lastRewardBlock.toNumber();
        const potentialMint = tokenPerBlock.mul(delta);
        return required.add(potentialMint);
    }
    /*
    it("transfer", async () => {
        const amount = BigNumber.from("1150200000000")
        await gton.approve(staking.address, amount);
        await staking.mint(amount, wallet.address)
        await mineBlocks(waffle.provider, 10)
        const balance = await staking.balanceOf(wallet.address)
        await expect(staking.transfer(other.address, balance.add(expandTo18Decimals(100)))).to.be.revertedWith("ERC20: transfer amount exceeds balance")

        await staking.toggleRevert();
        await expect(staking.transfer(other.address, balance)).to.be.revertedWith("Staking: contract paused")
        await staking.toggleRevert();


        const share = balanceToShare(balance, await futureTotalSupply(1), await staking.totalShares())
        const shareBefore = (await staking.userInfo(wallet.address)).share

        await staking.transfer(other.address, balance)
        const res = await staking.userInfo(other.address)
        const resWallet = await staking.userInfo(wallet.address)
        
        expect(resWallet.share).to.eq(shareBefore.sub(share))
        expect(res.share).to.eq(share) // tpb for transfer option
    })
    */

    it("approve and allowance", async () => {
        const amount = BigNumber.from("10012412401248")
        const secondAmount = BigNumber.from("1000000")
        expect(await staking.allowance(wallet.address, bob.address)).to.eq(0)

        await staking.togglePause();
        await expect(staking.approve(alice.address, amount)).to.be.revertedWith("Staking: contract paused")
        await staking.togglePause();

        // await expect(staking.approve(wallet.address, 0)).to.be.revertedWith("ERC20: approve to the zero address")
        await staking.approve(alice.address, amount)
        expect(await staking.allowance(wallet.address, alice.address)).to.eq(amount)
        await staking.approve(alice.address, secondAmount)
        expect(await staking.allowance(wallet.address, alice.address)).to.eq(secondAmount)
    })

    /*
    it("transferFrom", async () => {
        const amount = BigNumber.from("1012401999999")
        await gton.approve(staking.address, amount);
        await staking.mint(amount, wallet.address)
        const tpb = await getTokenPerBlock()

        await mineBlocks(waffle.provider, 10)
        await expect(staking.connect(bob).transferFrom(wallet.address, bob.address, 15)).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
        
        await staking.toggleRevert();
        await expect(staking.transferFrom(wallet.address, bob.address, 15)).to.be.revertedWith("Staking: contract paused")
        await staking.toggleRevert();
        
        const balance = await staking.balanceOf(wallet.address)
        // upcoming approve and transfer from blocks
        const share = balanceToShare(balance, await futureTotalSupply(2), await staking.totalShares())
        const shareBefore = (await staking.userInfo(wallet.address)).share
        await staking.approve(bob.address, balance)
        await staking.connect(bob).transferFrom(wallet.address, bob.address, balance)

        expect(await staking.allowance(wallet.address, bob.address)).to.eq(0)
        const res = await staking.userInfo(bob.address)
        const resWallet = await staking.userInfo(wallet.address)
        expect(res.share).to.eq(share)
        expect(resWallet.share).to.eq(shareBefore.sub(share))
        expect(await staking.balanceOf(bob.address)).to.eq(await staking.shareToBalance(share))
    })
    it("transferShare", async () => {
        const amount = BigNumber.from("1012401999998")
        await gton.approve(staking.address, amount);
        await staking.mint(amount, wallet.address)
        await mineBlocks(waffle.provider, 10)
        expect((await staking.userInfo(wallet.address)).share).to.eq(amount)

        await staking.transferShare(alice.address, amount.div(2))

        expect((await staking.userInfo(wallet.address)).share).to.eq(amount.div(2))
        expect((await staking.userInfo(alice.address)).share).to.eq(amount.div(2))

    })

    it("balanceToShare", async () => {
        const amount = expandTo18Decimals(789)
        await gton.approve(staking.address, amount);
        await staking.mint(amount, wallet.address)

        const user = await staking.userInfo(wallet.address)

        expect(await staking.balanceToShare(await staking.balanceOf(wallet.address))).to.eq(user.share)

        await mineBlocks(waffle.provider, 20)

        expect(await staking.balanceToShare(await staking.balanceOf(wallet.address))).to.eq(user.share)
    })
    */

    it("shareToBalance", async () => {
        const amount = BigNumber.from("1012401999999")
        await gton.approve(staking.address, amount);
        await staking.mint(amount, wallet.address)
    })

    context("Apr checking", function () {
        const decimals = BigNumber.from("10000000")

        it("After year APR of each user should be correct and APR of all sc the same", async () => {
            for (const i of updRewardData) {
                const apr = i.aprBasisPoints.mul(decimals).div(10000)
                await staking.setApr(i.aprBasisPoints)
                // await staking.setBlocksInYear(i.blocksInYear)
                const balanceAfterYear = i.amount.add(i.amount.mul(apr).div(decimals))
                await gton.approve(staking.address, i.amount);
                await staking.mint(i.amount, i.user.address)

                await mineBlocks(waffle.provider, i.blocksInYear.toNumber())
                expect(await staking.balanceOf(i.user.address)).to.be.closeTo(balanceAfterYear, 10000) // 3000 in wei
            }
        })
        const periods = [2]
        /*
        it("After n blocks APY of all sc should be correct for these n blocks", async () => {
            for (const period of periods) {
                for (const i of updRewardData) {
                    const apy = i.apyUp.mul(decimals).div(i.apyDown)
                    await staking.setApy(i.apyUp, i.apyDown)
                    await staking.setBlocksInYear(i.blocksInYear)
                    const balanceAfterYear = i.amount.add(i.amount.mul(apy).div(decimals).div(period))
                    await gton.approve(staking.address, i.amount);
                    await staking.mint(i.amount, i.user.address)

                    await mineBlocks(waffle.provider, i.blocksInYear.div(period).toNumber())
                    // 3000 in wei for less than 5000 gtons and about 5000 in wei for stake more than 50 000 gton
                    // it stated with 10 000 to level out the error of number when working with quarter the year (outdated)
                    expect(await staking.balanceOf(i.user.address)).to.be.closeTo(balanceAfterYear, 10000)
                    await staking.connect(i.user).transferShare(wallet.address, (await staking.userInfo(i.user.address)).share) // clear the users balance
                }
            }

        })
        */

        async function checkUserApr(user: Wallet, blockAmount: number, stakedAmount: BigNumber) {
            const aprBasisPoints = await staking.aprBasisPoints()
            const biy = await staking.blocksInYear()

            const apr = aprBasisPoints.mul(decimals).div(10000)
            const earned = stakedAmount.mul(apr).mul(blockAmount).div(decimals).div(biy)
            const balanceBefore = (await staking.balanceOf(user.address)).sub(stakedAmount)
            const balanceAfter = stakedAmount.add(earned)

            await mineBlocks(waffle.provider, blockAmount)
            // the approximate amount about 1 gton
            expect(await staking.balanceOf(user.address)).to.be.closeTo(balanceAfter.add(balanceBefore), 1000000000000000)
        }

        it("for each user we should emulate several mint and burn actions and calculate APR", async () => {
            await fillUpStaking();
            const fedorAmount = expandTo18Decimals(180)
            await gton.approve(staking.address, fedorAmount)
            await staking.mint(fedorAmount, fedor.address)
            await checkUserApr(fedor, 150, fedorAmount)

            await staking.setApr("1500") // balance update here
            const balance = await staking.balanceOf(fedor.address)
            const share = balanceToShare(balance, await futureTotalSupply(1), await staking.totalShares())
            
            await staking.connect(fedor).transfer(admin0.address, balance)
            await checkUserApr(admin0, 100, share)

            // await staking.setApy("670000", "1000000") // balance update here
            // const aliceBalance = await staking.balanceOf(alice.address)   
            // const aliceShare = balanceToShare(aliceBalance, await futureTotalSupply(1), await staking.totalShares())
            // await gton.approve(staking.address, expandTo18Decimals(110))
            // await staking.mint(expandTo18Decimals(110), alice.address)  
            // await checkUserApy(alice, 100, aliceShare)

        })

        it("if no one farms there should be 0 income at any block after somebody got in, his APY should suite rules", async () => {
            await mineBlocks(waffle.provider, 100);
            expect(await staking.balanceOf(admin1.address)).to.eq(0)

            const amount = expandTo18Decimals(180)
            await gton.approve(staking.address, amount)
            await staking.mint(amount, admin1.address)
            await checkUserApr(admin1, 800, amount)
        })
        // Add checks of the APY when it changes in case of users mint and burn actions (for users and contract in total)
        // Add checks of the block time parameters in the contract and emulate that it has been changed for some time, the APY should be constant
    })

})