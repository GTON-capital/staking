require("@nomiclabs/hardhat-waffle");

require('dotenv').config();
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: resolve(__dirname, "./.env") });

const { PRIVATE_KEY, ETHERSCAN, POLYGONSCAN, FTMSCAN } = process.env;

module.exports = {
  abiExporter: {
    path: "./abi",
    clear: false,
    flat: true,
  },
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      forking: {
        enabled: process.env.FORKING === "true",
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      gasPrice: 120 * 1000000000,
      chainId: 1,
    },
    ftm: {
      // url: "https://rpc.ankr.com/fantom",
      url: "https://rpcapi-tracing.fantom.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined,
    },
    ftmTestnet: {
      networkId: 4002,
      url: "https://rpc.testnet.fantom.network",
      accounts: [PRIVATE_KEY],
      // gasPrice: 35000000000,
    }
  },
  etherscan: {
    apiKey: {
        mainnet: ETHERSCAN,
        ropsten: ETHERSCAN,
        rinkeby: ETHERSCAN,
        goerli: ETHERSCAN,
        kovan: ETHERSCAN,
        // ftm
        opera: FTMSCAN,
        ftmTestnet: FTMSCAN,
        // polygon
        polygon: POLYGONSCAN,
        polygonMumbai: POLYGONSCAN,
    }
  },
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    enabled: process.env.REPORT_GAS === "true",
    excludeContracts: ["contracts/mocks/", "contracts/libraries/"],
  },
  mocha: {
    timeout: 20000,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    dev: {
      // Default to 1
      default: 2,
      // dev address mainnet
      // 1: "",
    },
  },
  paths: {
    artifacts: "artifacts",
    cache: "cache",
    sources: "contracts",
    tests: "test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.13"
      }
    ],
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
  },
}
