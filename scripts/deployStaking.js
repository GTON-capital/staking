const hre = require("hardhat");

const gtonEthereum = "0x01e0e2e61f554ecaaec0cc933e739ad90f24a86d"
const gtonGTON = "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2"
const gtonRopsten = "0xaab9f76100e3332dc559878b0ebbf31cc4ab72e6"
const gtonFantomTestnet = "0xc4d0a76ba5909c8e764b67acf7360f843fbacb2d"

const gton = gtonGTON

const stakingEthereum = "0xeFF66B4A84C8a6b69b99EB1C5e39aF8fc35d13db"
const stakingGTON = "0xf7Ff34caA3d1425488E63Cafa197933D9f60bc16"
const stakingRopsten = "0x2061489A2AE30D0ced15F4721c0bb53f30DE175c"

const staking = stakingGTON

var deployer

const ERC20Json = require("./ERC20.json");

async function main() {
    console.log(process.argv)
    const [dep] = await ethers.getSigners()
    deployer = dep
    console.log("Working with the account:", deployer.address)
    console.log("Account balance:", (await deployer.getBalance()).toString())

    // Deployment
    // await deployStaking()

    // Actions for staking
    // await getGTONApprovalForStaking()
    // await approveGTON()
    // await stakeGTON()
    // await unstakeGTON()
    // await getUserInfo()
}

async function deployStaking() {

    const stakinTokenAddress = gton
    const name = "Staking GTON"
    const symbol = "sGTON"
    const aprBasisPoints = 1200
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
    console.log("Deployment address: ", contract.address)

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

async function stakeGTON() {
    let contract = await getStaking()

    let tx = await contract.stake(
        "1000000000000000000", // 1
        deployer.address,
    )
    await tx.wait()
    console.log("Tx hash: " + tx.hash)
}

async function getUserInfo() {
    let contract = await getStaking()

    let tx = await contract.userInfo(
        deployer.address
    )

    console.log(
        "User info:\n" + 
        "(amount / rewardAccountedForHarvest / availableHarvest / lastHarvestTimestamp)\n" + 
        tx
    )
}

async function unstakeGTON() {
    let contract = await getStaking()

    let tx = await contract.unstake(
        deployer.address,
        "1000000000000000000", // 1
    )
    await tx.wait()
    console.log("Tx hash: " + tx.hash)
}

async function approveGTON() {
    let contract = await getGTON()

    let tx = await contract.approve(
        staking,
        "10000000000000000000000" // 10.000
    )
    await tx.wait()
    console.log("Tx hash: " + tx.hash)
}

async function getGTONApprovalForStaking() {
    let contract = await getGTON()

    let tx = await contract.allowance(
        deployer.address,
        staking
    )
    console.log("Allowance is: " + tx)
}

async function getGTON() {
    return new ethers.Contract(
        gton,
        ERC20Json,
        deployer
    )
}

async function getStaking() {
    const Factory = await ethers.getContractFactory("Staking")
    const contract = await Factory.attach(
        stakingGTON
    )
    return contract
}

const erc20ABI = {

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
