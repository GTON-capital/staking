import { ethers } from "hardhat"
import { BigNumber, Contract } from "ethers"
import { Fixture } from "ethereum-waffle"

import { CompoundStaking } from "../../types/CompoundStaking"
import { ERC20 } from "../../types/ERC20"


interface CompoundFixture {
    gton: ERC20
    compound: CompoundStaking
    lib: Contract
}

export const compoundFixture: Fixture<CompoundFixture> = async function ([
    wallet, admin0, admin1
]): Promise<CompoundFixture> {
    const gtonF = await ethers.getContractFactory("ERC20Mock")
    const gton = (await gtonF.deploy("Graviton", "GTON", BigNumber.from("100000000000000000000000"))) as ERC20
    const libFactory = await ethers.getContractFactory("AddressArrayLib")
    const lib = await libFactory.deploy();
    const compoundF = await ethers.getContractFactory("CompoundStaking")
    const compound = (await compoundF.deploy(
        gton.address,
        "sGTON",
        "sGTON",
        140,
        15,
        [admin0.address, admin1.address],
        7)
    ) as CompoundStaking
    return {
        gton,
        lib,
        compound
    }
}