module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer, account1} = await getNamedAccounts();
    console.log(deployer);

    await deploy('CompoundStaking', {
      from: deployer,
        args: [
            "0xc1be9a4d5d45beeacae296a7bd5fadbfc14602c4", 
            1000,
            "name", 
            "symbol", 
            2500, 
            10000, 
        ],
      log: true,
    });
  };
