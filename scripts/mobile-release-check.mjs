import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDir = join(root, "apps", "mobile");
const appConfigPath = join(mobileDir, "app.json");
const easConfigPath = join(mobileDir, "eas.json");
const mobilePackagePath = join(mobileDir, "package.json");
const babelConfigPath = join(mobileDir, "babel.config.js");
const closedTestEnvExamplePath = join(mobileDir, ".env.closed-test.example");
const localMobileEnvPath = join(mobileDir, ".env.local");
const accountDeletionDocPath = join(root, "docs", "account-deletion-request.md");
const closedTestDocPath = join(root, "docs", "play-store-closed-test.md");
const dataSafetyDocPath = join(root, "docs", "play-store-data-safety.md");
const dependencySecurityDocPath = join(root, "docs", "dependency-security-review.md");
const listingPackDocPath = join(root, "docs", "play-store-listing-pack.md");
const playChecklistPath = join(root, "docs", "play-store-checklist.md");
const publicationRunbookPath = join(root, "docs", "play-store-publication-runbook.md");
const privacyPolicyDocPath = join(root, "docs", "privacy-policy-draft.md");
const productionEmailDocPath = join(root, "docs", "production-email-delivery.md");
const screenshotCaptureDocPath = join(root, "docs", "play-store-screenshot-capture.md");
const termsDocPath = join(root, "docs", "terms-of-use-draft.md");
const renderEnvExamplePath = join(root, "infra", "render-env.closed-test.example");
const renderBlueprintPath = join(root, "render.yaml");
const webExportScriptPath = join(root, "scripts", "export-mobile-web.mjs");
const featureGraphicPath = join(root, "docs", "play-store-assets", "feature-graphic.png");
const screenshotCoverPath = join(root, "docs", "play-store-assets", "screenshot-cover.png");

const failures = [];
const warnings = [];
const placeholderSupportEmail = ["support", "example.com"].join("@");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`Could not read ${path}: ${error.message}`);
    return {};
  }
}

function requireValue(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function warnValue(condition, message) {
  if (!condition) {
    warnings.push(message);
  }
}

function requireFile(relativePath, label) {
  const path = join(mobileDir, relativePath);
  requireValue(existsSync(path), `${label} is missing at apps/mobile/${relativePath}`);
}

function requireRootFile(path, label) {
  requireValue(existsSync(path), `${label} is missing at ${path.replace(`${root}\\`, "")}`);
}

function readEnvValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${key}=`));

  return line ? line.slice(key.length + 1).trim() : "";
}

function pluginOptions(plugins, name) {
  const plugin = (plugins ?? []).find((item) => item === name || (Array.isArray(item) && item[0] === name));
  return Array.isArray(plugin) ? plugin[1] ?? {} : plugin ? {} : null;
}

function readPngDimensions(path) {
  if (!existsSync(path)) {
    return null;
  }

  const png = readFileSync(path);
  if (png.length < 24 || png.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }

  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const appJson = readJson(appConfigPath);
const easJson = readJson(easConfigPath);
const mobilePackage = readJson(mobilePackagePath);
const expo = appJson.expo ?? {};
const android = expo.android ?? {};
const notificationsPlugin = pluginOptions(expo.plugins, "expo-notifications");
const imagePickerPlugin = pluginOptions(expo.plugins, "expo-image-picker");
const closedTestProfile = easJson.build?.["closed-test"] ?? {};
const productionProfile = easJson.build?.production ?? {};
const previewProfile = easJson.build?.preview ?? {};
const docs = [
  accountDeletionDocPath,
  closedTestDocPath,
  dataSafetyDocPath,
  dependencySecurityDocPath,
  listingPackDocPath,
  playChecklistPath,
  publicationRunbookPath,
  privacyPolicyDocPath,
  productionEmailDocPath,
  screenshotCaptureDocPath,
  termsDocPath
]
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

requireValue(expo.name === "StudyNova", "Expo app name should be StudyNova.");
requireValue(expo.slug === "studynova", "Expo slug should be studynova.");
requireValue(Boolean(expo.description), "Expo description should be set for release metadata.");
requireValue(/^\d+\.\d+\.\d+$/.test(expo.version ?? ""), "Expo version should use semantic format, e.g. 1.0.0.");
requireValue(Number((expo.version ?? "0").split(".")[0]) >= 1, "Public release version must be 1.0.0 or newer.");
requireValue(/^~?55\./.test(mobilePackage.dependencies?.expo ?? ""), "Play release must use Expo SDK 55 and Android target SDK 36.");
requireValue(
  /^\^?55\./.test(mobilePackage.dependencies?.["@expo/metro-runtime"] ?? ""),
  "The mobile workspace must declare the SDK 55 @expo/metro-runtime package for static rendering."
);
requireValue(
  /^~?55\./.test(mobilePackage.devDependencies?.["babel-preset-expo"] ?? ""),
  "The mobile workspace must declare the SDK 55 babel-preset-expo package for deterministic EAS and web builds."
);
requireValue(android.package === "com.studynova.app", "Android package should be com.studynova.app before first Play upload.");
requireValue(Array.isArray(android.permissions), "Android permissions should be explicit.");
requireValue(
  android.permissions?.includes("POST_NOTIFICATIONS"),
  "Android POST_NOTIFICATIONS permission should be configured for reminders."
);
requireValue(
  android.permissions?.includes("CAMERA"),
  "Android CAMERA permission should be configured for optional study proof photos."
);
requireValue(
  !android.permissions?.includes("RECORD_AUDIO"),
  "Android RECORD_AUDIO must not be requested because StudyNova does not record audio."
);
requireValue(android.softwareKeyboardLayoutMode === "resize", "Android keyboard layout mode should be resize.");
requireValue(expo.icon === "./assets/icon.png", "Expo icon should point to ./assets/icon.png.");
requireValue(expo.splash?.image === "./assets/splash-icon.png", "Splash image should point to ./assets/splash-icon.png.");
requireValue(
  android.adaptiveIcon?.foregroundImage === "./assets/adaptive-icon.png",
  "Android adaptive icon foreground should be configured."
);
requireValue(!expo.notification, "Remove the retired top-level Expo notification configuration for SDK 55.");
requireValue(
  notificationsPlugin?.icon === "./assets/notification-icon.png",
  "expo-notifications plugin should configure the notification icon."
);
requireValue(notificationsPlugin?.color === "#2563EB", "expo-notifications plugin should configure the brand color.");
requireValue(
  notificationsPlugin?.defaultChannel === "study-reminders",
  "expo-notifications plugin should configure the study-reminders channel."
);
requireValue(expo.extra?.eas?.projectId, "EAS projectId should be linked in app.json.");
requireValue(
  imagePickerPlugin !== null,
  "expo-image-picker config plugin should be configured for study proof image permissions."
);
requireValue(
  imagePickerPlugin?.microphonePermission === false,
  "expo-image-picker must disable microphonePermission to avoid an unnecessary audio permission."
);
requireValue(expo.web?.output === "static", "Expo web output should be static for public policy pages.");

requireFile("assets/icon.png", "App icon");
requireFile("assets/adaptive-icon.png", "Adaptive icon");
requireFile("assets/splash-icon.png", "Splash icon");
requireFile("assets/splash.png", "Full splash artwork");
requireFile("assets/notification-icon.png", "Notification icon");
requireFile(".env.closed-test.example", "Closed-test mobile env example");
requireRootFile(accountDeletionDocPath, "Account deletion request document");
requireRootFile(dataSafetyDocPath, "Play Store Data safety draft");
requireRootFile(dependencySecurityDocPath, "Dependency security review");
requireRootFile(listingPackDocPath, "Play Store listing pack");
requireRootFile(privacyPolicyDocPath, "Privacy policy draft");
requireRootFile(productionEmailDocPath, "Production email delivery guide");
requireRootFile(screenshotCaptureDocPath, "Play Store screenshot capture plan");
requireRootFile(renderEnvExamplePath, "Render closed-test env example");
requireRootFile(renderBlueprintPath, "Render deployment blueprint");
requireRootFile(webExportScriptPath, "Monorepo-safe Expo web export launcher");
requireRootFile(publicationRunbookPath, "Play Store publication runbook");
requireRootFile(featureGraphicPath, "Play Store feature graphic");
requireRootFile(screenshotCoverPath, "Play Store screenshot cover");
requireFile("app/privacy.tsx", "Public privacy policy route");
requireRootFile(termsDocPath, "Terms of Use draft");
requireFile("app/terms.tsx", "Public Terms of Use route");
requireFile("src/lib/demoData.ts", "Screenshot demo data");
requireFile("babel.config.js", "Mobile Babel configuration");

if (existsSync(babelConfigPath)) {
  const babelConfig = readFileSync(babelConfigPath, "utf8");
  requireValue(babelConfig.includes("babel-preset-expo"), "Mobile Babel configuration must use babel-preset-expo.");
  requireValue(
    babelConfig.includes("expo-router-plugin"),
    "Mobile Babel configuration must preserve the npm-workspace Expo Router transform."
  );
}

requireValue(easJson.cli?.appVersionSource === "remote", "EAS appVersionSource should be remote.");
requireValue(easJson.cli?.requireCommit === true, "EAS must require a committed release source tree.");
requireValue(closedTestProfile.autoIncrement === true, "closed-test profile should auto-increment.");
requireValue(closedTestProfile.environment === "production", "closed-test profile should use the production EAS environment.");
requireValue(closedTestProfile.android?.buildType === "app-bundle", "closed-test profile should build an Android App Bundle.");
requireValue(productionProfile.autoIncrement === true, "production profile should auto-increment.");
requireValue(productionProfile.android?.buildType === "app-bundle", "production profile should build an Android App Bundle.");
requireValue(previewProfile.android?.buildType === "apk", "preview profile should build an APK.");
requireValue(easJson.submit?.["closed-test"]?.android?.track === "alpha", "closed-test submit profile should use the alpha track.");
requireValue(easJson.submit?.production?.android?.track === "production", "production submit profile should use the production track.");

const featureGraphicDimensions = readPngDimensions(featureGraphicPath);
const screenshotCoverDimensions = readPngDimensions(screenshotCoverPath);
requireValue(
  featureGraphicDimensions?.width === 1024 && featureGraphicDimensions?.height === 500,
  "Play Store feature graphic must be a 1024x500 PNG."
);
requireValue(
  screenshotCoverDimensions?.width === 1080 && screenshotCoverDimensions?.height === 1920,
  "Play Store screenshot cover must be a 1080x1920 PNG."
);

warnValue(docs.includes("com.studynova.app"), "Play Store docs should mention the current Android package.");
warnValue(docs.includes("account deletion"), "Play Store docs should mention account deletion.");
warnValue(docs.includes("/privacy"), "Play Store docs should mention the public /privacy route.");
warnValue(docs.includes("/terms"), "Play Store docs should mention the public /terms route.");
warnValue(docs.includes("/delete-account"), "Play Store docs should mention the public /delete-account route.");
warnValue(docs.includes("Data safety"), "Play Store docs should mention Data safety.");
warnValue(docs.includes("Tester feedback"), "Play Store docs should mention tester feedback.");
warnValue(docs.includes("Short description"), "Play Store docs should include listing copy.");
warnValue(docs.includes("screenshot") && docs.includes("demo"), "Play Store docs should include screenshot demo guidance.");
warnValue(docs.includes("npx eas-cli@latest"), "Play Store docs should prefer npx eas-cli@latest for machines without global EAS.");
warnValue(docs.includes("mobile:release-check"), "Play Store docs should mention npm run mobile:release-check.");
warnValue(docs.includes("api:smoke"), "Play Store docs should mention npm run api:smoke.");
warnValue(docs.includes("closed-test:api-env"), "Play Store docs should mention npm run closed-test:api-env.");
warnValue(docs.includes("closed-test:preflight"), "Play Store docs should mention npm run closed-test:preflight.");
warnValue(docs.includes("EXPO_PUBLIC_API_URL"), "Play Store docs should mention EXPO_PUBLIC_API_URL.");
warnValue(docs.includes("render-env.closed-test.example"), "Play Store docs should mention the Render env example.");
warnValue(docs.includes("STUDY_PROOF_STORAGE_BACKEND"), "Play Store docs should mention study proof image storage.");
warnValue(docs.includes("RESEND_API_KEY"), "Play Store docs should mention production verification email delivery.");
requireValue(docs.includes("13 or older"), "Public release documents must state the 13+ account requirement.");
requireValue(docs.includes("target SDK 36") || docs.includes("API 36"), "Play Store docs must state Android target SDK 36.");
requireValue(!docs.includes(placeholderSupportEmail), "Replace the placeholder support email before release.");
requireValue(!docs.includes("YOUR-STUDYNOVA-WEB-HOST"), "Replace the placeholder public web host before release.");
requireValue(!docs.includes("This draft must be reviewed before public launch"), "Remove draft-only policy language before release.");

if (existsSync(renderBlueprintPath)) {
  const renderBlueprint = readFileSync(renderBlueprintPath, "utf8");
  requireValue(renderBlueprint.includes("name: studynova-api"), "Render blueprint should include the production API.");
  requireValue(renderBlueprint.includes("name: studynova-web"), "Render blueprint should include the public web app.");
  requireValue(renderBlueprint.includes("npm run mobile:export:web"), "Render web build should export the Expo static site.");
  requireValue(renderBlueprint.includes("EMAIL_PROVIDER"), "Render API configuration should include production email delivery.");
}

if (existsSync(closedTestEnvExamplePath)) {
  const closedTestEnvExample = readFileSync(closedTestEnvExamplePath, "utf8");
  const exampleApiUrl = readEnvValue(closedTestEnvExample, "EXPO_PUBLIC_API_URL");
  requireValue(
    exampleApiUrl.startsWith("https://"),
    "apps/mobile/.env.closed-test.example should show an HTTPS EXPO_PUBLIC_API_URL."
  );
  requireValue(
    Boolean(readEnvValue(closedTestEnvExample, "EXPO_PUBLIC_FIREBASE_API_KEY")),
    "apps/mobile/.env.closed-test.example should document EXPO_PUBLIC_FIREBASE_API_KEY."
  );
  requireValue(
    Boolean(readEnvValue(closedTestEnvExample, "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")),
    "apps/mobile/.env.closed-test.example should document EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID."
  );
  requireValue(
    Boolean(readEnvValue(closedTestEnvExample, "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID")),
    "apps/mobile/.env.closed-test.example should document EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID."
  );
}

if (existsSync(localMobileEnvPath)) {
  const localMobileEnv = readFileSync(localMobileEnvPath, "utf8");
  const localApiUrl = readEnvValue(localMobileEnv, "EXPO_PUBLIC_API_URL");

  warnValue(Boolean(localApiUrl), "apps/mobile/.env.local exists but EXPO_PUBLIC_API_URL is missing.");
  warnValue(
    !localApiUrl ||
      localApiUrl.startsWith("https://") ||
      localApiUrl.startsWith("http://localhost") ||
      localApiUrl.startsWith("http://127.0.0.1"),
    "apps/mobile/.env.local EXPO_PUBLIC_API_URL should be HTTPS, localhost, or 127.0.0.1."
  );
  warnValue(
    !localApiUrl.includes("app.github.dev"),
    "apps/mobile/.env.local still points to Codespaces. Use the hosted API URL before closed-test builds."
  );
}

if (warnings.length) {
  console.warn("\nRelease check warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (failures.length) {
  console.error("\nRelease check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Mobile release check passed.");
