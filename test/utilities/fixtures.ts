import { ethers } from "hardhat"
import { BigNumber, Contract } from "ethers"
import { Fixture } from "ethereum-waffle"

import { CompoundStaking } from "../../types/CompoundStaking"
import { ERC20 } from "../../types/ERC20"


interface CompoundFixture {
    gton: ERC20
    compound: CompoundStaking
}

export const compoundFixture: Fixture<CompoundFixture> = async function ([
    wallet
]): Promise<CompoundFixture> {
    const gtonF = await ethers.getContractFactory("ERC20Mock")
    const gton = (await gtonF.deploy("Graviton", "GTON", BigNumber.from("100000000000000000000000"))) as ERC20
    const libFactory = await ethers.getContractFactory("AddressArrayLib")
    const lib = await libFactory.deploy();
    const compoundF = await ethers.getContractFactory("CompoundStaking", {
        libraries: {
          AddressArrayLib: lib.address,
        }})
    const compound = (await compoundF.deploy(gton.address, BigNumber.from("100000"), "sGTON", "sGTON", 140, 15)) as CompoundStaking
    return {
        gton,
        compound
    }
}