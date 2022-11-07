const config = require("hardhat/config");
require("@nomicfoundation/hardhat-toolbox");
const claim_ABI = require("./claim.json");
const claimAddress = "0xBceB65916a02804aCfC32983A52b07F07e1C5477";

var deployer;

async function main(address) {
  const [dep] = await ethers.getSigners();
  deployer = dep;

  const contract = new ethers.Contract(claimAddress, claim_ABI, deployer);
  console.log("Withdraw status:", await contract.withdrawals(address));
}

config
  .task(
    "did-withdraw",
    "Prints withdraw status for Claim contract on Fantom Network"
  )
  .addParam("account", "The account's address")
  .setAction(async (taskArgs) => {
    console.log(taskArgs);
    await main(taskArgs.account);
  });
