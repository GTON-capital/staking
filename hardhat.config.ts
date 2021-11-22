import * as dotenv from "dotenv";
dotenv.config({ path: __dirname+'/.env' });

import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "solidity-coverage";
import "hardhat-abi-exporter";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.0"
      },
    ]
  },
  networks: {
    hardhat: {
    },
    mainnet: {
      url: "https://mainnet.infura.io/v3/" + (process.env.INFURA ?? ""),
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    },
    fantom: { // 250
      url: "https://rpcapi.fantom.network",
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    },
    bsc: { // 56
      url: "https://bsc-dataseed.binance.org",
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    },
    polygon: { // 137
      url: "https://rpc-mainnet.maticvigil.com/",
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    },
    heco: { // 128
      url: "https://http-mainnet.hecochain.com",
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    },
    avax: { // 43114
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    },
    xdai: { // 100
      url: "https://rpc.xdaichain.com",
      accounts: { mnemonic: process.env.MNEMONIC ?? "" }
    }
  },
  abiExporter: {
    clear: true,
    flat: true,
    spacing: 2
  },
  mocha: {
    timeout: '10000000000'
  }
};
