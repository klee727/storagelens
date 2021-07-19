import { task, extendConfig, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";
import path from "path";

import { LayoutLens } from "./LayoutLens";
// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import "./type-extensions";

const { TASK_COMPILE } = require("hardhat/builtin-tasks/task-names");

extendEnvironment((hre) => {
  // We add a field to the Hardhat Runtime Environment here.
  // We use lazyObject to avoid initializing things until they are actually
  // needed.
  hre.layoutLens = lazyObject(() => new LayoutLens());
});

task("printStorage", "Print storage for contract")
  .addPositionalParam("contractName", "The name of contract to print")
  .setAction(async function (args, hre) {
    await hre.run(TASK_COMPILE, { quiet: true });
    hre.layoutLens.getStorageLayout(args.contractName);
  });
