// Đóng gói maplibre-gl vào một module chuỗi để nhúng vào WebView, không phải tải từ CDN.
// Chạy: npm run map:vendor
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "node_modules/maplibre-gl/dist");
const js = fs.readFileSync(path.join(dist, "maplibre-gl.js"), "utf8");
const css = fs.readFileSync(path.join(dist, "maplibre-gl.css"), "utf8");
const version = require(path.join(root, "node_modules/maplibre-gl/package.json")).version;

const out = path.join(root, "src/map/vendor.generated.ts");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  "// Sinh bởi scripts/build-map-vendor.cjs, không sửa tay.\n" +
    `export const MAPLIBRE_VERSION = ${JSON.stringify(version)};\n` +
    // Không để "</script" nằm nguyên văn, trình duyệt sẽ đóng thẻ script sớm.
    `export const MAPLIBRE_JS = ${JSON.stringify(js.replace(/<\/script/gi, "<\\/script"))};\n` +
    `export const MAPLIBRE_CSS = ${JSON.stringify(css)};\n`,
);
console.log(`maplibre-gl ${version}: ${Math.round((js.length + css.length) / 1024)} KB -> ${path.relative(root, out)}`);
