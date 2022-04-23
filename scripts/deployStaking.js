async function main() {
    console.log(process.argv);
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const stakinTokenAddress = "0xc4d0a76ba5909c8e764b67acf7360f843fbacb2d"; // Testnet GTON
    const name = "Staking GTON";
    const symbol = "sGTON";
    const aprBasisPoints = 2232;
    const harvestInterval = 86400;

    const Factory = await ethers.getContractFactory("Staking");
    const deploy = await Factory.deploy(
        stakinTokenAddress,
        name,
        symbol,
        aprBasisPoints,
        harvestInterval
    );

    console.log("Deploy address: ", deploy.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
