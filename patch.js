// pi 汉化补丁脚本：应用 map-*.json 到 dist 下的 JS 文件，并自动汉化 --help 大文本
// 用法:
//   node patch.js map-*.json        应用补丁（自动备份原始文件到 backup/）
//   node patch.js --restore         从 backup/ 恢复到英文原文
//   node patch.js --no-backup map-*.json   应用补丁但不备份
// 会自动探测 Pi 安装目录；也可设置环境变量 PI_DIST 指定
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const findPiDist = require("./find-dist.js");
const { translateCliHelp } = require("./translate-cli-help.js");

const DIST = findPiDist();
if (!DIST) {
  console.error("未找到 Pi 安装目录。请设置环境变量 PI_DIST 指向 pi 的 dist 目录后重试。");
  process.exit(1);
}
console.log("Pi dist 目录:", DIST);

// 备份目录（存放在补丁目录下，已加入 .gitignore）
const BACKUP_ROOT = path.join(__dirname, "backup");

// ---------- 备份 / 恢复 ----------
// 在文件被修改前调用：把 dist 中的当前内容（原文）复制到备份目录
function backupFile(relPath) {
  const src = path.join(DIST, relPath);
  const dest = path.join(BACKUP_ROOT, relPath);
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) return false; // 已有备份（首次应用时的原文），不覆盖
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  💾 已备份原文: ${relPath}`);
  return true;
}

function restoreFromBackup() {
  if (!fs.existsSync(BACKUP_ROOT)) {
    console.error(`没有找到备份目录 ${BACKUP_ROOT}，无法恢复。\n提示：若从未运行过补丁则无需恢复；若备份丢失，可运行 "pi update" 重新安装 Pi 来还原官方英文版。`);
    process.exit(1);
  }
  const backupFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else backupFiles.push(p);
    }
  };
  walk(BACKUP_ROOT);
  if (backupFiles.length === 0) {
    console.log("备份目录为空，没有可恢复的文件。");
    return;
  }
  let restored = 0;
  for (const bf of backupFiles) {
    const rel = path.relative(BACKUP_ROOT, bf);
    const dest = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(bf, dest);
    restored++;
    console.log(`  ↩ 已恢复: ${rel}`);
  }
  console.log(`\n已从备份恢复 ${restored} 个文件，Pi 界面已还原为英文原文。`);
  console.log("（备份仍保留在 backup/ 中，随时可再次运行补丁重新汉化）");
  verifySyntax();
}

// ---------- 语法检查 ----------
function listJsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJsFiles(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

function verifySyntax() {
  console.log("\n=== 语法检查 ===");
  let syntaxErrors = 0;
  for (const f of listJsFiles(DIST)) {
    try {
      execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    } catch (e) {
      syntaxErrors++;
      console.error(`✗ 语法错误 ${path.relative(DIST, f)}:\n${e.stderr?.toString().split("\n").slice(0, 6).join("\n")}`);
    }
  }
  console.log(`语法检查完成，错误: ${syntaxErrors}`);
  return syntaxErrors;
}

// ---------- 主流程 ----------
const args = process.argv.slice(2);

// 恢复模式
if (args.includes("--restore")) {
  restoreFromBackup();
  process.exit(0);
}

// 应用模式
const mapFiles = args.filter((a) => !a.startsWith("--"));
const noBackup = args.includes("--no-backup");
if (mapFiles.length === 0) {
  console.error("用法:\n  node patch.js map-*.json                 应用补丁（自动备份）\n  node patch.js --restore                 恢复到英文原文\n  node patch.js --no-backup map-*.json    应用补丁但不备份");
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

const allFiles = listJsFiles(DIST);
let totalReplacements = 0;
const missed = []; // {file, old}
let backedUp = 0;

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
    if (changed) {
      // 写入前先备份原文（幂等：已有备份则跳过）
      if (!noBackup && backupFile(path.relative(DIST, t))) backedUp++;
      fs.writeFileSync(t, src);
    }
  }
}

// 汉化 --help 大文本（printHelp），同样在修改前备份
let helpChanged = false;
try {
  if (!noBackup && backupFile("cli/args.js")) backedUp++;
  helpChanged = translateCliHelp(DIST);
} catch (e) {
  console.error("printHelp 汉化失败:", e.message);
}

console.log("");
verifySyntax();
console.log(`总替换次数: ${totalReplacements}`);
if (!noBackup) {
  console.log(`已备份 ${backedUp} 个原始文件到 ${path.relative(process.cwd(), BACKUP_ROOT)}（执行 node patch.js --restore 可恢复英文原文）`);
} else {
  console.log("本次未备份（--no-backup 模式）");
}

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
