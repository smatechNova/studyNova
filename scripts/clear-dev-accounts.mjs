import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(repoRoot, "apps", "api", ".data");
const databasePath = path.join(dataDir, "studynova.sqlite3");
const backupDir = path.join(dataDir, "backups");
const proofDir = path.join(dataDir, "study-proofs");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function clearDirectory(targetDir) {
  if (!(await pathExists(targetDir))) {
    return 0;
  }

  const entries = await fs.readdir(targetDir);
  await Promise.all(entries.map((entry) => fs.rm(path.join(targetDir, entry), { force: true, recursive: true })));
  return entries.length;
}

async function main() {
  await fs.mkdir(backupDir, { recursive: true });

  if (!(await pathExists(databasePath))) {
    const removedProofs = await clearDirectory(proofDir);
    console.log("No active local StudyNova database was found.");
    console.log(`Removed ${removedProofs} local study proof file${removedProofs === 1 ? "" : "s"}.`);
    return;
  }

  const backupPath = path.join(backupDir, `studynova-dev-reset-${timestamp()}.sqlite3`);
  await fs.copyFile(databasePath, backupPath);
  await fs.rm(databasePath, { force: true });
  const removedProofs = await clearDirectory(proofDir);

  console.log("Cleared local development StudyNova account data.");
  console.log(`Backup saved to: ${path.relative(repoRoot, backupPath)}`);
  console.log(`Removed ${removedProofs} local study proof file${removedProofs === 1 ? "" : "s"}.`);
  console.log("Restart the API server so it creates a fresh development database.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
