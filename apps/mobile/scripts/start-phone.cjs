const fs = require("node:fs");
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
console.log(
  "Lưu ý: Windows phải đặt mạng Wi-Fi là Private, nếu không tường lửa sẽ chặn điện thoại kết nối tới Metro (cổng 8081).",
);
const root = path.resolve(__dirname, "..");
const readEnvLocal = (key) => {
  try {
    const line = fs
      .readFileSync(path.join(root, ".env.local"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
};
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
    // Cổng 8081 là cổng duy nhất được mở trong Windows Firewall ("HorseRoute Expo Metro").
    "--port",
    "8081",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_TOKEN: process.env.EXPO_TOKEN || readEnvLocal("EXPO_TOKEN"),
      REACT_NATIVE_PACKAGER_HOSTNAME: host,
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
