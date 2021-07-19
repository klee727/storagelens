# StorageLens

_StorageLens is a hardhat plugin to help developer to check contract storage layout_

## What is storage layout

Storage layout represents how the state storage slots are taken inside a ethereum smart contract.

Knowing this is very helpful for contract using upgradeable pattern like TransparentUpgradeableProxy.

## Installation

```bash
npm install storagelens
```

Import the plugin in your `hardhat.config.js`:

```js
require("storagelens");
```

Or if you are using TypeScript, in your `hardhat.config.ts`:

```ts
import "storagelens";
```

## Tasks

This plugin creates task called 'printStorage'

```
npx hardhat printStorage [--no-compile] ERC20
```

This command will generate results like below (depends on ERC20 you used):

```
layout of @openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20:
_balances [4771][mapping(address => uint256)]
_allowances [4777][mapping(address => mapping(address => uint256))]
_totalSupply [4779][uint256]
_name [4781][string]
_symbol [4783][string]
_decimals [4785][uint8]
```
