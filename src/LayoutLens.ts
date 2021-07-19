import { HardhatRuntimeEnvironment, CompilerOutput } from "hardhat/types";
import { HardhatPluginError } from "hardhat/plugins";

interface ObjectWithID {
  [index: string]: ObjectWithID | any;
  id?: string;
}

interface IndexedObjects {
  [index: string]: any;
}

export interface SearchHandler {
  test: (x: ObjectWithID | any) => boolean;
  callback: (x: ObjectWithID) => void;
}

export interface TypeReference {
  id: string;
  name: string;
  type: string;
  typeName: string;
  visibility: string;
  length?: string | number;
  keyType?: string;
  subType?: Array<TypeReference>;
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
    const fullNames = this.hre.artifacts.getAllFullyQualifiedNames();
    const found = (await fullNames).filter((v) => v.split(":")[1] == shotName);
    if (found.length > 1) {
      this._throw(
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
    const [path, name] = fullyQualifiedName.split(":");
    const buildInfo = await this.hre.artifacts.getBuildInfo(fullyQualifiedName);
    if (!buildInfo) {
      this._throw(`Cannot get buildInfo from ${fullyQualifiedName}`);
    }
    const indexedObjects = buildInfo
      ? this.flattenObjects(buildInfo.output)
      : {};
    return this._parseLayout(indexedObjects, name);
  }

  public flattenObjects(solcOutput: CompilerOutput): { [index: string]: any } {
    const result: { [index: string]: any } = {};
    const handler = {
      test: (x: ObjectWithID | null) => {
        return x != null && "id" in x;
      },
      callback: (x: ObjectWithID) => {
        result[x.id as string] = x;
      },
    };
    this._search(solcOutput.sources, handler);
    return result;
  }

  protected _search(root: ObjectWithID, handler: SearchHandler) {
    if (root == null) {
      return;
    }
    if (typeof root === "object" && handler.test(root)) {
      handler.callback(root);
    }
    Object.keys(root).forEach((key: string) => {
      const child = root[key];
      if (Array.isArray(child)) {
        for (var i = 0; i < child.length; i++) {
          this._search(child[i], handler);
        }
      } else if (typeof child === "object") {
        this._search(child, handler);
      }
    });
  }

  protected _parseLayout(all: IndexedObjects, contractName: string) {
    const ast = this._find(
      all,
      (x: any) => x.nodeType == "ContractDefinition" && x.name == contractName
    );
    const inheritIDs = ast.linearizedBaseContracts;
    const output: Array<TypeReference> = [];
    for (var i = inheritIDs.length - 1; i >= 0; i--) {
      const root = all[inheritIDs[i]].nodes;
      this._parseCompositeType(all, output, root);
    }
    return output;
  }

  protected _parseCompositeType(
    all: IndexedObjects,
    output: Array<TypeReference>,
    current: IndexedObjects
  ) {
    if (typeof current === "undefined") {
      return;
    }
    for (var j = 0; j < current.length; j++) {
      var node = current[j];
      if (node.nodeType != "VariableDeclaration") {
        continue;
      }
      const typeRef = this._parseDeclaration(all, node);
      if (typeof typeRef != "undefined") {
        output.push(typeRef);
      }
    }
  }

  protected _parseDeclaration(
    all: IndexedObjects,
    current: IndexedObjects
  ): TypeReference | undefined {
    if (current.constant == true) {
      return undefined;
    }
    const typeRef: TypeReference = {
      id: current.id,
      name: current.name,
      type: current.typeDescriptions.typeIdentifier,
      typeName: current.typeDescriptions.typeString,
      visibility: current.visibility,
    };
    var subRef = null;
    switch (current.typeName.nodeType) {
      // struct
      case "UserDefinedTypeName": {
        subRef = all[current.typeName.referencedDeclaration];
        break;
      }
      // array
      case "ArrayTypeName": {
        if (typeof current.typeName.length != "undefined") {
          typeRef["length"] = current.typeName.length.value;
        }
        if (current.typeName.baseType.nodeType == "UserDefinedTypeName") {
          subRef = all[current.typeName.baseType.referencedDeclaration];
        }
        break;
      }
      // map
      case "Mapping": {
        typeRef["keyType"] =
          current.typeName.keyType.typeDescriptions.typeIdentifier;
        if (current.typeName.valueType.nodeType == "UserDefinedTypeName") {
          subRef = all[current.typeName.valueType.referencedDeclaration];
        }
        break;
      }
    }
    if (subRef != null && subRef.nodeType != "ContractDefinition") {
      typeRef["subType"] = [];
      this._parseCompositeType(all, typeRef["subType"], subRef.members);
    }

    return typeRef;
  }

  protected _find(objects: IndexedObjects, condition: (x: any) => boolean) {
    for (var key in objects) {
      if (condition(objects[key])) {
        return objects[key];
      }
    }
    return undefined;
  }

  protected _throw(message: string) {
    throw new HardhatPluginError(LayoutLens.name, message);
  }
}
