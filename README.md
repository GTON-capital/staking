# GTON CAPITAL farming & staking smart contracts
---

GTON staking contract that provides fixed APR currently set at 22.32% as per DAO voting


## Deployments
GTON mainnet: [user-friendly interface](https://cli.gton.capital/) ; [0xf7Ff34caA3d1425488E63Cafa197933D9f60bc16](https://explorer.gton.network/token/0xf7Ff34caA3d1425488E63Cafa197933D9f60bc16/token-transfers)  
Ethereum: [user-friendly interface](https://cli.gton.capital/) ; [0xeff66b4a84c8a6b69b99eb1c5e39af8fc35d13db](https://etherscan.io/token/0xeff66b4a84c8a6b69b99eb1c5e39af8fc35d13db) 
## Run tests
npm v16.14.0 is required
```
npm i
npx hardhat test
```
---
## Deploy
Example testnet deploy:
```
npx hardhat run --network ftmTestnet scripts/deployStaking.js
```

## Contracts
Staking.sol - $GTON token compound staking
