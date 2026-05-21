const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('toml');

const heroUIProInternalComponentsShim = path.resolve(
  __dirname,
  'components/native/heroui-pro-internal-components-shim.js'
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    moduleName.endsWith('helpers/internal/components/index.js')
  ) {
    return {
      filePath: heroUIProInternalComponentsShim,
      type: 'sourceFile',
    };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-env.d.ts',
});
