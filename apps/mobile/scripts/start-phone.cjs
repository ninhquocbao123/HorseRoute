const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const candidates = Object.entries(os.networkInterfaces()).flatMap(
  ([name, addresses]) =>
    (addresses || [])
      .filter(
        (a) =>
          a.family === "IPv4" &&
          !a.internal &&
          !a.address.startsWith("169.254.") &&
          !/vEthernet|virtual|docker|wsl|loopback/i.test(name),
      )
      .map((a) => ({ name, address: a.address })),
);
const host =
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME ||
  candidates.find((a) => /wi-?fi|wireless|wlan/i.test(a.name))?.address ||
  candidates[0]?.address;
if (!host) {
  console.error(
    "Chưa tìm thấy mạng LAN. Kết nối Wi-Fi hoặc Ethernet rồi thử lại.",
  );
  process.exit(1);
}
console.log(`Expo Go: ${host}. Điện thoại cần cùng mạng với máy tính.`);
const root = path.resolve(__dirname, "..");
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/expo/bin/cli"),
    "start",
    "--go",
    "--lan",
    "--clear",
    "--max-workers",
    "1",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: host },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
