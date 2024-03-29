const { ethers } = require("hardhat");
import { BigNumber } from "ethers"
import { Fixture } from "ethereum-waffle"

import { 
    ERC20,
    Staking,
} from "../../types"

interface CompoundFixture {
    gton: ERC20
    staking: Staking
}

export const stakingFixture: Fixture<CompoundFixture> = async function (): Promise<CompoundFixture> {
    const gtonF = await ethers.getContractFactory("ERC20Mock")
    const gton = (await gtonF.deploy("Graviton", "GTON", BigNumber.from("21000000000000000000000000"))) as ERC20
    const stakingF = await ethers.getContractFactory("Staking")
    const staking = (await stakingF.deploy(
        gton.address,
        "sGTON",
        "sGTON",
        1200,
        86400, // seconds in day
        )
    ) as Staking
    return {
        gton,
        staking
    }
}