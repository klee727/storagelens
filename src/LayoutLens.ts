import { HardhatRuntimeEnvironment, CompilerOutput, CompilerOutputContract, BuildInfo } from "hardhat/types";
import { HardhatPluginError } from "hardhat/plugins";

export interface TypeReference {
  name: string;
  type: string;
  slot: string;
  offset: number;
  numberOfBytes: string;
  subType: TypeReference[];
}

export class LayoutLens {
  public hre: HardhatRuntimeEnvironment;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
  }

  public async getFullName(shotName: string): Promise<string> {
    if (shotName.indexOf(":") >= 0) {
      return shotName;
    }
    const fullNames = await this.hre.artifacts.getAllFullyQualifiedNames();
    const found = fullNames.filter((v) => v.split(":")[1] == shotName);
    if (found.length > 1) {
      throw new HardhatPluginError(LayoutLens.name,
        `more than one path found for ${shotName}, please use full path like "contracts/target.sol:ContractName`
      );
    }
    return found[0];
  }

  // public saveLayout() {
  // const branch = getCurrentBranch();
  // const commitHash = getCurrentCommitShort();
  // printInfo(`Working on ${branch} with commit ${commitHash}`);
  // const target = yaml.load(fs.readFileSync("./scripts/upgrade/target.yml", "utf8"));
  // const outDir = `${PREFIX}/${branch}`;
  // const outPath = `${outDir}/${commitHash}.yml`;
  // fs.mkdirSync(outDir, { recursive: true });
  // const layouts = {};
  // for (var i = 0; i < target.contracts.length; i++) {
  //   const path = target.contracts[i];
  //   printInfo(`begin processing ${path}.`);
  //   const layout = await getStorageLayout(path);
  //   layouts[path] = layout;
  //   printInfo(`processing ${path} done.`);
  // }
  // fs.writeFileSync(outPath, yaml.dump(layouts));
  // printInfo(
  //   `layouts has been written to ${outPath}. ${target.contracts.length} contracts generated.`
  // );
  // }

  public async getStorageLayout(fullyQualifiedName: string) {
    const buildInfo = await this.hre.artifacts.getBuildInfo(fullyQualifiedName);
    if (!buildInfo) {
      throw new HardhatPluginError(LayoutLens.name, `Cannot get buildInfo from ${fullyQualifiedName}`);
    }
    const compiledContracts = this._flatten(buildInfo);
    return this._parseLayout(compiledContracts, fullyQualifiedName);
  }

  _flatten(buildInfo: BuildInfo): { [key: string]: CompilerOutputContract } {
    const compiledContracts: { [key: string]: CompilerOutputContract } = {};
    const contracts = buildInfo.output.contracts;
    for (const sourceName in contracts) {
      for (const contractName in contracts[sourceName]) {
        const key = `${sourceName}:${contractName}`;
        compiledContracts[key] = contracts[sourceName][contractName];
      }
    }
    return compiledContracts;
  }

  _parseLayout(compiledContracts: { [key: string]: CompilerOutputContract }, fullyQualifiedName: string): TypeReference[] {
    const compiledContract = compiledContracts[fullyQualifiedName] as any // no declaration for storageLayout
    if (!compiledContract) {
      throw new HardhatPluginError(LayoutLens.name, `Cannot get compiledContract from ${fullyQualifiedName}`);
    }
    const { storage, types } = compiledContract.storageLayout;
    if (!storage) {
      throw new HardhatPluginError(LayoutLens.name, `Cannot get storage from ${fullyQualifiedName}`);
    }
    if (!types) {
      throw new HardhatPluginError(LayoutLens.name, `Cannot get types from ${fullyQualifiedName}`);
    }
    return this._parseSubType(types, storage);
  }

  protected _parseSubType(types: any, subType: any[]): TypeReference[] {
    let output: TypeReference[] = [];
    for (const i of subType) {
      const compiledType = types[i.type];
      let parsedSubType: TypeReference[] = [];
      const subType = this._getSubType(types, compiledType);
      if (subType) {
        parsedSubType = this._parseSubType(types, subType);
      }
      output.push({
        name: i.label,
        type: compiledType.label,
        slot: i.slot,
        offset: i.offset,
        numberOfBytes: types[i.type].numberOfBytes,
        subType: parsedSubType,
      });
    }
    return output;
  }

  protected _getSubType(types: any, compiledType: any): any[] {
    // the "storage" is an array
    if (compiledType.length) {
      return compiledType;
    }
    // "struct" has .member
    if (compiledType.members) {
      return compiledType.members;
    }
    // "mapping" has .value
    const valueType = types[compiledType.value];
    if (valueType && valueType.members) {
      return valueType.members;
    }
    // unrecognized
    return []
  }
}
