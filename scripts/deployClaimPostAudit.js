const hre = require("hardhat");
const Big = require('big.js');

const contractName = "ClaimGTONPostAudit"

const stakingMainnet = "0xB0dAAb4eb0C23aFFaA5c9943d6f361b51479ac48"
const gtonMainnet = "0xc1be9a4d5d45beeacae296a7bd5fadbfc14602c4"

const stakingTestnet = "0x314650ac2876c6B6f354499362Df8B4DC95E4750"
const gtonTestnet = "0xc4d0a76ba5909c8e764b67acf7360f843fbacb2d"

const testnetDeploy = "0xb74cA2Ae0348fcFf27CeC498e3dD2f2346937C15"
const mainnetDeploy = ""

async function main() {
    await deployTestnet()
}

async function deployMainnet() {
    await deploy(stakingMainnet, gtonMainnet)
}

async function deployTestnet() {
    await deploy(stakingTestnet, gtonTestnet)
}

async function deploy(stakingAddress, gtonAddress) {
    console.log(process.argv);
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const Factory = await ethers.getContractFactory(contractName);
    const deploy = await Factory.deploy(
        stakingAddress,
        gtonAddress
    );
    await deploy.deployed()
    console.log("Deploy address: ", deploy.address);
}

async function userWithdrawal() {
    const [deployer] = await ethers.getSigners();

  console.log("Working with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Factory = await ethers.getContractFactory(contractName);
  const contract = await Factory.attach(
    testnetDeploy // The deployed contract address
  );

  // Now you can call functions of the contract
  const result = await contract.withdrawGton();
  console.log(result.hash);
}

async function adminWithdrawal() {
    const [deployer] = await ethers.getSigners();

  console.log("Working with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Factory = await ethers.getContractFactory(contractName);
  const contract = await Factory.attach(
    testnetDeploy // The deployed contract address
  );

  // Now you can call functions of the contract
  const result = await contract.withdrawToken(
    gtonTestnet,
    deployer.address,
    Big(3).mul(1e18)
  );
  console.log(result.hash);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
