const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const mobileNodeModules = path.resolve(projectRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro resolve workspace packages from mobile + root node_modules.
// Hierarchical lookup stays on globally so pnpm nested deps (e.g. invariant
// under react-native) still resolve. React / RN requests are intercepted so
// they pin to the mobile React 18 copies instead of walking into desktop React 19.
config.resolver.nodeModulesPaths = [
  mobileNodeModules,
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  react: path.resolve(mobileNodeModules, "react"),
  "react/jsx-runtime": path.resolve(mobileNodeModules, "react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(
    mobileNodeModules,
    "react/jsx-dev-runtime",
  ),
  "react-native": path.resolve(mobileNodeModules, "react-native"),
};

const reactOriginModulePath = path.join(projectRoot, "package.json");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isReactRequest =
    moduleName === "react" || moduleName.startsWith("react/");
  const isReactNativeRequest =
    moduleName === "react-native" || moduleName.startsWith("react-native/");

  if (isReactRequest || isReactNativeRequest) {
    return context.resolveRequest(
      {
        ...context,
        originModulePath: reactOriginModulePath,
        nodeModulesPaths: [mobileNodeModules],
        disableHierarchicalLookup: true,
      },
      moduleName,
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Ensure workspace TypeScript packages are transpiled
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "ts",
  "tsx",
  "mts",
];

module.exports = config;
