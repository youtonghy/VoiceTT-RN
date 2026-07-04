// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value="react-native"] ImportSpecifier[imported.name="Alert"]',
          message: 'Use "@/components/app-alert" so Alert works on Electron/web.',
        },
      ],
      'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
    },
  },
]);
