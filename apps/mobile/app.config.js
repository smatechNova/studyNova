const { existsSync } = require("node:fs");
const { join } = require("node:path");

const baseConfig = require("./app.json");

module.exports = () => {
  const expo = structuredClone(baseConfig.expo);
  const localGoogleServicesPath = join(__dirname, "google-services.json");
  const googleServicesPath = process.env.GOOGLE_SERVICES_JSON || localGoogleServicesPath;

  if (existsSync(googleServicesPath)) {
    expo.android = {
      ...expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
    };
  }

  return { expo };
};
