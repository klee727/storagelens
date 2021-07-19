const chalk = require("chalk");
import { task, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import { LayoutLens } from "./LayoutLens";
// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import "./type-extensions";

const { TASK_COMPILE } = require("hardhat/builtin-tasks/task-names");

extendEnvironment((hre) => {
  // We add a field to the Hardhat Runtime Environment here.
  // We use lazyObject to avoid initializing things until they are actually
  // needed.
  hre.layoutLens = lazyObject(() => new LayoutLens(hre));
});

task("printStorage", "Print storage for contract")
  .addFlag("noCompile", "Don't compile before running this task")
  .addPositionalParam("contractName", "The name of contract to print")
  .setAction(async function (
    { contractName, noCompile }: { contractName: string; noCompile: boolean },
    { run, layoutLens }
  ) {
    if (!noCompile) {
      await run(TASK_COMPILE, { quiet: true });
    }
    const fullName = await layoutLens.getFullName(contractName);
    const layout = await layoutLens.getStorageLayout(fullName);
    console.log(`layout of ${chalk.greenBright(fullName)}:`);
    printLayout(layout, 0);
  });

function printLayout(layout: any, indent: number) {
  for (var i = 0; i < layout.length; i++) {
    const node = layout[i];
    const padding = " ".repeat(indent) + (indent == 0 ? "" : "- ");
    console.log(
      `${padding}${chalk.yellow(node.name)} [${node.id}][${chalk.magentaBright(
        node.typeName
      )}]`
    );
    if ("subType" in node) {
      printLayout(node.subType, indent + 2);
    }
  }
}
