import { ethers } from "hardhat"
import { BigNumber, Contract } from "ethers"
import { Fixture } from "ethereum-waffle"

import { Staking } from "../../types/Staking"
import { ERC20 } from "../../types/ERC20"


interface StakingFixture {
    gton: ERC20
    staking: Staking
    lib: Contract
}

export const stakingFixture: Fixture<StakingFixture> = async function ([
    wallet, admin0, admin1
]): Promise<StakingFixture> {
    const gtonF = await ethers.getContractFactory("ERC20Mock")
    const gton = (await gtonF.deploy("Graviton", "GTON", BigNumber.from("100000000000000000000000"))) as ERC20
    const libFactory = await ethers.getContractFactory("AddressArrayLib")
    const lib = await libFactory.deploy();
    const stakingF = await ethers.getContractFactory("Staking")
    const staking = (await stakingF.deploy(
        gton.address,
        "sGTON",
        "sGTON",
        2500,
        [admin0.address, admin1.address],
        7)
    ) as Staking
    return {
        gton,
        lib,
        staking
    }
}