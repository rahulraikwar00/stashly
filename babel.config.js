module.exports = function (api) {
  api.cache(true);

  const plugins = ['react-native-worklets/plugin', ['inline-import', { extensions: ['.sql'] }]];

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins,
  };
};
