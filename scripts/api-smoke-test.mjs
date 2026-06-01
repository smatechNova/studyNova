import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const writeMobileEnv = args.includes("--write-mobile-env");
const positionalArgs = args.filter((arg) => arg !== "--write-mobile-env");

const apiUrl = (positionalArgs[0] || process.env.STUDYNOVA_API_URL || "").trim().replace(/\/$/, "");
const adminCode = (positionalArgs[1] || process.env.STUDYNOVA_ADMIN_CODE || "").trim();

if (!apiUrl || !adminCode) {
  console.error("Usage: node scripts/api-smoke-test.mjs <https-api-url> <admin-code> [--write-mobile-env]");
  console.error("Or set STUDYNOVA_API_URL and STUDYNOVA_ADMIN_CODE.");
  process.exit(1);
}

if (!apiUrl.startsWith("https://") && !apiUrl.startsWith("http://localhost")) {
  console.error("API URL must be HTTPS for hosted testing. http://localhost is only accepted for local checks.");
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
  console.log(`Health: ${health.status} (${health.environment})`);

  const readiness = await readJson(
    await fetch(`${apiUrl}/api/v1/admin/deployment/readiness`, {
      headers: {
        "X-Admin-Code": adminCode
      }
    }),
    "Deployment readiness"
  );

  for (const check of readiness.checks || []) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warning" ? "WARN" : "FAIL";
    console.log(`${marker} ${check.name}: ${check.message}`);
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
    const outputPath = path.join(process.cwd(), "apps", "mobile", ".env.local");
    await writeFile(outputPath, `EXPO_PUBLIC_API_URL=${apiUrl}\n`, "utf8");
    console.log(`Wrote ${outputPath}`);
  }

  console.log("Backend is ready for the mobile closed-test API URL.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
