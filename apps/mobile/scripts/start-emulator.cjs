const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/expo/bin/cli"),
    "start",
    "--go",
    "--localhost",
    "--android",
    "--clear",
    "--max-workers",
    "1",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: "http://10.0.2.2:3000/api/v1",
      EXPO_PUBLIC_WEB_URL: "http://10.0.2.2:5173",
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
