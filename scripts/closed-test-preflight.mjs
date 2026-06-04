import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const positionalArgs = args.filter((arg) => !["--help", "-h"].includes(arg));

const apiUrl = (positionalArgs[0] || process.env.STUDYNOVA_API_URL || "").trim().replace(/\/$/, "");
const adminCode = (positionalArgs[1] || process.env.STUDYNOVA_ADMIN_CODE || "").trim();

function printUsage() {
  console.error("Usage: node scripts/closed-test-preflight.mjs <https-api-url> <admin-code>");
  console.error("Or set STUDYNOVA_API_URL and STUDYNOVA_ADMIN_CODE.");
}

function runStep(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n${label}`);

    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code}.`));
    });
  });
}

if (showHelp) {
  printUsage();
  process.exit(0);
}

if (!apiUrl || !adminCode) {
  printUsage();
  process.exit(1);
}

let parsedApiUrl;

try {
  parsedApiUrl = new URL(apiUrl);
} catch (error) {
  console.error(`API URL is invalid: ${apiUrl}`);
  process.exit(1);
}

if (parsedApiUrl.protocol !== "https:") {
  console.error("Closed-test preflight requires a hosted HTTPS API URL.");
  process.exit(1);
}

if (adminCode === "studynova-admin-dev") {
  console.error("Closed-test preflight cannot use the default development admin code.");
  process.exit(1);
}

try {
  await runStep("1/2 Mobile release configuration", process.execPath, [
    join(root, "scripts", "mobile-release-check.mjs")
  ]);

  await runStep("2/2 Hosted API readiness", process.execPath, [
    join(root, "scripts", "api-smoke-test.mjs"),
    apiUrl,
    adminCode,
    "--write-mobile-env"
  ]);

  console.log("\nClosed-test preflight passed.");
  console.log("Next set the same URL in EAS, then build:");
  console.log(
    `cd apps/mobile\nnpx eas-cli@latest env:create production --name EXPO_PUBLIC_API_URL --value ${apiUrl} --visibility plaintext --force\ncd ../..\nnpm run mobile:build:closed-test`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
