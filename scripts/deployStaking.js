const hre = require("hardhat");

const gtonEthereum = "0x01e0e2e61f554ecaaec0cc933e739ad90f24a86d"
const gtonRopsten = "0xaab9f76100e3332dc559878b0ebbf31cc4ab72e6"
const gtonFantomTestnet = "0xc4d0a76ba5909c8e764b67acf7360f843fbacb2d"

const gton = gtonEthereum

const stakingEthereum = "0xeFF66B4A84C8a6b69b99EB1C5e39aF8fc35d13db"
const stakingRopsten = "0x2061489A2AE30D0ced15F4721c0bb53f30DE175c"

async function main() {
    await deployStaking()
}

async function deployStaking() {
    console.log(process.argv)
    const [deployer] = await ethers.getSigners()

    console.log("Deploying contracts with the account:", deployer.address)

    console.log("Account balance:", (await deployer.getBalance()).toString())

    const stakinTokenAddress = gton
    const name = "Staking GTON"
    const symbol = "sGTON"
    const aprBasisPoints = 2232
    const harvestInterval = 86400

    const Factory = await ethers.getContractFactory("Staking")
    const contract = await Factory.deploy(
        stakinTokenAddress,
        name,
        symbol,
        aprBasisPoints,
        harvestInterval
    )
    await contract.deployed()
    console.log("Deploy address: ", contract.address)

    await delay(20000)
    await hre.run("verify:verify", {
        address: contract.address,
        network: hre.network,
        constructorArguments: [
            stakinTokenAddress,
            name,
            symbol,
            aprBasisPoints,
            harvestInterval
        ]
      });
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
