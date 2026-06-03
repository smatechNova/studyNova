import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDir = join(root, "apps", "mobile");
const appConfigPath = join(mobileDir, "app.json");
const easConfigPath = join(mobileDir, "eas.json");
const accountDeletionDocPath = join(root, "docs", "account-deletion-request.md");
const closedTestDocPath = join(root, "docs", "play-store-closed-test.md");
const dataSafetyDocPath = join(root, "docs", "play-store-data-safety.md");
const listingPackDocPath = join(root, "docs", "play-store-listing-pack.md");
const playChecklistPath = join(root, "docs", "play-store-checklist.md");
const privacyPolicyDocPath = join(root, "docs", "privacy-policy-draft.md");
const screenshotCaptureDocPath = join(root, "docs", "play-store-screenshot-capture.md");
const termsDocPath = join(root, "docs", "terms-of-use-draft.md");

const failures = [];
const warnings = [];

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

const appJson = readJson(appConfigPath);
const easJson = readJson(easConfigPath);
const expo = appJson.expo ?? {};
const android = expo.android ?? {};
const closedTestProfile = easJson.build?.["closed-test"] ?? {};
const productionProfile = easJson.build?.production ?? {};
const previewProfile = easJson.build?.preview ?? {};
const docs = [
  accountDeletionDocPath,
  closedTestDocPath,
  dataSafetyDocPath,
  listingPackDocPath,
  playChecklistPath,
  privacyPolicyDocPath,
  screenshotCaptureDocPath,
  termsDocPath
]
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

requireValue(expo.name === "StudyNova", "Expo app name should be StudyNova.");
requireValue(expo.slug === "studynova", "Expo slug should be studynova.");
requireValue(Boolean(expo.description), "Expo description should be set for release metadata.");
requireValue(/^\d+\.\d+\.\d+$/.test(expo.version ?? ""), "Expo version should use semantic format, e.g. 0.1.0.");
requireValue(android.package === "com.studynova.app", "Android package should be com.studynova.app before first Play upload.");
requireValue(Array.isArray(android.permissions), "Android permissions should be explicit.");
requireValue(
  android.permissions?.includes("POST_NOTIFICATIONS"),
  "Android POST_NOTIFICATIONS permission should be configured for reminders."
);
requireValue(android.softwareKeyboardLayoutMode === "resize", "Android keyboard layout mode should be resize.");
requireValue(expo.icon === "./assets/icon.png", "Expo icon should point to ./assets/icon.png.");
requireValue(expo.splash?.image === "./assets/splash-icon.png", "Splash image should point to ./assets/splash-icon.png.");
requireValue(
  android.adaptiveIcon?.foregroundImage === "./assets/adaptive-icon.png",
  "Android adaptive icon foreground should be configured."
);
requireValue(expo.notification?.icon === "./assets/notification-icon.png", "Notification icon should be configured.");
requireValue(expo.extra?.eas?.projectId, "EAS projectId should be linked in app.json.");

requireFile("assets/icon.png", "App icon");
requireFile("assets/adaptive-icon.png", "Adaptive icon");
requireFile("assets/splash-icon.png", "Splash icon");
requireFile("assets/splash.png", "Full splash artwork");
requireFile("assets/notification-icon.png", "Notification icon");
requireRootFile(accountDeletionDocPath, "Account deletion request document");
requireRootFile(dataSafetyDocPath, "Play Store Data safety draft");
requireRootFile(listingPackDocPath, "Play Store listing pack");
requireRootFile(privacyPolicyDocPath, "Privacy policy draft");
requireRootFile(screenshotCaptureDocPath, "Play Store screenshot capture plan");
requireFile("app/privacy.tsx", "Public privacy policy route");
requireRootFile(termsDocPath, "Terms of Use draft");
requireFile("app/terms.tsx", "Public Terms of Use route");
requireFile("src/lib/demoData.ts", "Screenshot demo data");

requireValue(easJson.cli?.appVersionSource === "remote", "EAS appVersionSource should be remote.");
requireValue(closedTestProfile.autoIncrement === true, "closed-test profile should auto-increment.");
requireValue(closedTestProfile.environment === "production", "closed-test profile should use the production EAS environment.");
requireValue(closedTestProfile.android?.buildType === "app-bundle", "closed-test profile should build an Android App Bundle.");
requireValue(productionProfile.autoIncrement === true, "production profile should auto-increment.");
requireValue(productionProfile.android?.buildType === "app-bundle", "production profile should build an Android App Bundle.");
requireValue(previewProfile.android?.buildType === "apk", "preview profile should build an APK.");
requireValue(easJson.submit?.["closed-test"]?.android?.track === "alpha", "closed-test submit profile should use the alpha track.");
requireValue(easJson.submit?.production?.android?.track === "production", "production submit profile should use the production track.");

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
