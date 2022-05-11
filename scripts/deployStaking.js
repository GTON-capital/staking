const hre = require("hardhat");

const gtonEthereum = "0x01e0e2e61f554ecaaec0cc933e739ad90f24a86d"
const gtonRopsten = "0xaab9f76100e3332dc559878b0ebbf31cc4ab72e6"
const gtonFantomTestnet = "0xc4d0a76ba5909c8e764b67acf7360f843fbacb2d"

const gton = gtonRopsten

const stakingRopsten = "0x9fC6Be561958ce5f50aF68Ba617099F7D351fa94"

async function main() {
    await deployStaking()
}

async function deployStaking() {
    console.log(process.argv)
    const [deployer] = await ethers.getSigners()

    console.log("Deploying contracts with the account:", deployer.address)

    console.log("Account balance:", (await deployer.getBalance()).toString())

    const stakinTokenAddress = gton // Testnet GTON
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
