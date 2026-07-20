import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mobileDir = join(root, "apps", "mobile");
const mobileRequire = createRequire(join(mobileDir, "package.json"));
const expoCli = mobileRequire.resolve("expo/bin/cli");
const modulePaths = [join(mobileDir, "node_modules"), join(root, "node_modules")];

if (process.env.NODE_PATH) {
  modulePaths.push(process.env.NODE_PATH);
}

const child = spawn(process.execPath, [expoCli, "export", "--platform", "web", ...process.argv.slice(2)], {
  cwd: mobileDir,
  env: {
    ...process.env,
    NODE_PATH: modulePaths.join(delimiter)
  },
  shell: false,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
