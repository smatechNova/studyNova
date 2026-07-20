module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // npm workspaces may keep expo-router below apps/mobile, outside the preset's root-level module lookup.
    plugins: [require("babel-preset-expo/build/expo-router-plugin").expoRouterBabelPlugin]
  };
};
