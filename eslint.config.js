const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.kilo/**'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
]);
