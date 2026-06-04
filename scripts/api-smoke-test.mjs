import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const args = process.argv.slice(2);
const writeMobileEnv = args.includes("--write-mobile-env");
const showHelp = args.includes("--help") || args.includes("-h");
const positionalArgs = args.filter((arg) => !["--write-mobile-env", "--help", "-h"].includes(arg));

const apiUrl = (positionalArgs[0] || process.env.STUDYNOVA_API_URL || "").trim().replace(/\/$/, "");
const adminCode = (positionalArgs[1] || process.env.STUDYNOVA_ADMIN_CODE || "").trim();

function printUsage() {
  console.error("Usage: node scripts/api-smoke-test.mjs <https-api-url> <admin-code> [--write-mobile-env]");
  console.error("Or set STUDYNOVA_API_URL and STUDYNOVA_ADMIN_CODE.");
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

const isLocalUrl =
  parsedApiUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedApiUrl.hostname);

if (parsedApiUrl.protocol !== "https:" && !isLocalUrl) {
  console.error("API URL must be HTTPS for hosted testing. Localhost is only accepted for local checks.");
  process.exit(1);
}

async function readJson(response, label) {
  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`${label} did not return JSON.`);
  }

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function main() {
  console.log(`Checking StudyNova API: ${apiUrl}`);

  const health = await readJson(await fetch(`${apiUrl}/health`), "Health check");
  if (health.status !== "ok") {
    throw new Error(`Health check returned unexpected status: ${health.status}`);
  }
  console.log(`Health: ${health.status} (${health.environment})`);

  const readiness = await readJson(
    await fetch(`${apiUrl}/api/v1/admin/deployment/readiness`, {
      headers: {
        "X-Admin-Code": adminCode
      }
    }),
    "Deployment readiness"
  );

  const checks = Array.isArray(readiness.checks) ? readiness.checks : [];

  if (!checks.length) {
    throw new Error("Deployment readiness returned no checks.");
  }

  for (const check of checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warning" ? "WARN" : "FAIL";
    console.log(`${marker} ${check.name}: ${check.message}`);
  }

  if (!isLocalUrl && readiness.environment !== "production") {
    throw new Error(`Hosted smoke test expected production environment, received ${readiness.environment}.`);
  }

  if (!readiness.ready) {
    throw new Error("Deployment readiness is not clean yet. Fix the failing checks before the closed-test build.");
  }

  if (readiness.public_api_base_url && readiness.public_api_base_url !== apiUrl) {
    throw new Error(
      `PUBLIC_API_BASE_URL is ${readiness.public_api_base_url}, but smoke test used ${apiUrl}. These must match.`
    );
  }

  if (writeMobileEnv) {
    const outputPath = join(root, "apps", "mobile", ".env.local");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `EXPO_PUBLIC_API_URL=${apiUrl}\n`, "utf8");
    console.log(`Wrote ${outputPath}`);
    console.log("Use the same URL in the production EAS environment before the closed-test build.");
  }

  console.log("Backend is ready for the mobile closed-test API URL.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
