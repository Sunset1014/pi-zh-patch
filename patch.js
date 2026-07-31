// pi 汉化补丁脚本：应用 map-*.json 到 dist 下的 JS 文件
// 用法: node patch.js map-*.json
// 会自动探测 Pi 安装目录；也可设置环境变量 PI_DIST 指定
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const findPiDist = require("./find-dist.js");

const DIST = findPiDist();
if (!DIST) {
  console.error("未找到 Pi 安装目录。请设置环境变量 PI_DIST 指向 pi 的 dist 目录后重试。");
  process.exit(1);
}
console.log("Pi dist 目录:", DIST);
const mapFiles = process.argv.slice(2);
if (mapFiles.length === 0) {
  console.error("用法: node patch.js <map1.json> [map2.json ...]");
  process.exit(1);
}

// 汇总映射: fileKey -> {old: new}
const byFile = new Map(); // fileKey -> Map(old -> new)
for (const mf of mapFiles) {
  const map = JSON.parse(fs.readFileSync(mf, "utf8"));
  for (const [fileKey, entries] of Object.entries(map)) {
    if (!byFile.has(fileKey)) byFile.set(fileKey, new Map());
    const m = byFile.get(fileKey);
    for (const [old, nw] of Object.entries(entries)) {
      if (m.has(old) && m.get(old) !== nw) {
        console.warn(`⚠ 冲突 ${fileKey}: ${JSON.stringify(old)} 已有 ${JSON.stringify(m.get(old))}，现改为 ${JSON.stringify(nw)}`);
      }
      m.set(old, nw);
    }
  }
}

function listJsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJsFiles(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const allFiles = listJsFiles(DIST);
let totalReplacements = 0;
const missed = []; // {file, old}

for (const [fileKey, entries] of byFile) {
  const targets = fileKey === "__all__"
    ? allFiles
    : fileKey.split(",").map((k) => path.join(DIST, k.trim()));
  for (const t of targets) {
    if (!fs.existsSync(t)) { console.warn(`⚠ 文件不存在: ${t}`); continue; }
    let src = fs.readFileSync(t, "utf8");
    let changed = false;
    // 长字符串先替换，避免短映射先应用导致长映射失配
    const sorted = [...entries].sort((a, b) => b[0].length - a[0].length);
    for (const [old, nw] of sorted) {
      if (src.includes(old)) {
        const count = src.split(old).length - 1;
        src = src.split(old).join(nw);
        totalReplacements += count;
        changed = true;
        console.log(`  ✓ ${path.relative(DIST, t)}: ${JSON.stringify(old).slice(0, 60)} → ${JSON.stringify(nw).slice(0, 60)} ×${count}`);
      } else {
        missed.push({ file: t, old });
      }
    }
    if (changed) fs.writeFileSync(t, src);
  }
}

// 语法检查所有被修改的文件
console.log("\n=== 语法检查 ===");
let syntaxErrors = 0;
for (const f of allFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    syntaxErrors++;
    console.error(`✗ 语法错误 ${path.relative(DIST, f)}:\n${e.stderr?.toString().split("\n").slice(0, 6).join("\n")}`);
  }
}
console.log(`语法检查完成，错误: ${syntaxErrors}`);
console.log(`总替换次数: ${totalReplacements}`);
if (missed.length > 0) {
  console.log(`\n=== 未命中的映射 (${missed.length}) ===`);
  const uniq = new Map();
  for (const m of missed) {
    const k = m.old;
    if (!uniq.has(k)) uniq.set(k, []);
    uniq.get(k).push(path.relative(DIST, m.file));
  }
  for (const [old, files] of uniq) {
    console.log(`  ${JSON.stringify(old).slice(0, 90)}  <${[...new Set(files)].join(",")}>`);
  }
}
