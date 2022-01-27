import { ethers } from "hardhat"
import { BigNumber, Contract } from "ethers"
import { Fixture } from "ethereum-waffle"

import { Staking } from "../../types/Staking"
import { ERC20 } from "../../types/ERC20"


interface CompoundFixture {
    gton: ERC20
    compound: Staking
}

export const compoundFixture: Fixture<CompoundFixture> = async function (): Promise<CompoundFixture> {
    const gtonF = await ethers.getContractFactory("ERC20Mock")
    const gton = (await gtonF.deploy("Graviton", "GTON", BigNumber.from("100000000000000000000000"))) as ERC20
    const compoundF = await ethers.getContractFactory("Staking")
    const compound = (await compoundF.deploy(
        gton.address,
        "sGTON",
        "sGTON",
        2500,
        86400, // seconds in day
        )
    ) as Staking
    return {
        gton,
        compound
    }
}