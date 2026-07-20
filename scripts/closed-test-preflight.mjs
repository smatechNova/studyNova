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
const webUrl = (positionalArgs[2] || process.env.STUDYNOVA_WEB_URL || "").trim().replace(/\/$/, "");

function printUsage() {
  console.error("Usage: node scripts/closed-test-preflight.mjs <https-api-url> <admin-code> <https-web-url>");
  console.error("Or set STUDYNOVA_API_URL, STUDYNOVA_ADMIN_CODE, and STUDYNOVA_WEB_URL.");
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

async function checkPublicPages(baseUrl) {
  for (const route of ["/privacy", "/terms", "/delete-account"]) {
    const url = `${baseUrl}${route}`;
    const response = await fetch(url, {
      headers: { "user-agent": "StudyNova-Release-Preflight/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000)
    });

    if (!response.ok) {
      throw new Error(`Public release page failed (${response.status}): ${url}`);
    }

    const body = await response.text();
    if (!body.toLowerCase().includes("studynova")) {
      throw new Error(`Public release page does not contain StudyNova content: ${url}`);
    }

    console.log(`- ${url} (${response.status})`);
  }
}

if (showHelp) {
  printUsage();
  process.exit(0);
}

if (!apiUrl || !adminCode || !webUrl) {
  printUsage();
  process.exit(1);
}

let parsedApiUrl;
let parsedWebUrl;

try {
  parsedApiUrl = new URL(apiUrl);
} catch (error) {
  console.error(`API URL is invalid: ${apiUrl}`);
  process.exit(1);
}

try {
  parsedWebUrl = new URL(webUrl);
} catch (error) {
  console.error(`Public web URL is invalid: ${webUrl}`);
  process.exit(1);
}

if (parsedApiUrl.protocol !== "https:") {
  console.error("Closed-test preflight requires a hosted HTTPS API URL.");
  process.exit(1);
}

if (parsedWebUrl.protocol !== "https:") {
  console.error("Closed-test preflight requires a public HTTPS web URL.");
  process.exit(1);
}

if (adminCode === "studynova-admin-dev") {
  console.error("Closed-test preflight cannot use the default development admin code.");
  process.exit(1);
}

try {
  await runStep("1/3 Mobile release configuration", process.execPath, [
    join(root, "scripts", "mobile-release-check.mjs")
  ]);

  await runStep("2/3 Hosted API readiness", process.execPath, [
    join(root, "scripts", "api-smoke-test.mjs"),
    apiUrl,
    adminCode,
    "--write-mobile-env"
  ]);

  console.log("\n3/3 Public privacy, terms, and deletion pages");
  await checkPublicPages(webUrl);

  console.log("\nClosed-test preflight passed.");
  console.log("Next set the same URL in EAS, then build:");
  console.log(
    `cd apps/mobile\nnpx eas-cli@latest env:create production --name EXPO_PUBLIC_API_URL --value ${apiUrl} --visibility plaintext --force\ncd ../..\nnpm run mobile:build:closed-test`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
