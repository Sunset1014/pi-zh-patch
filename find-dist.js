// 自动探测 Pi 安装目录（dist 目录），供 patch.js / translate-cli-help.js 使用
// 用法:
//   const findPiDist = require("./find-dist.js");
//   const DIST = findPiDist();  // 找不到返回 null
//
// 探测优先级：
//   1. 环境变量 PI_DIST（用户显式指定，最灵活）
//   2. `npm root -g` 下的 @earendil-works/pi-coding-agent/dist（npm 全局安装，
//      Windows 的 pi-node 环境与 Linux/macOS 的全局安装均适用）
//   3. Windows: %LOCALAPPDATA%\pi-node\current\node_modules\...（pi-node 兜底）
//   4. 从 `where pi` / `which pi` 解析的可执行文件位置向上查找 node_modules
//   5. require.resolve 解析（当前 Node 环境能解析到包时）
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PACKAGE_REL = path.join("@earendil-works", "pi-coding-agent", "dist");

function tryExec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function isValidDist(dir) {
  return !!dir && fs.existsSync(path.join(dir, "cli.js"));
}

function candidates() {
  const list = [];
  // 1. 环境变量显式指定
  if (process.env.PI_DIST) list.push(process.env.PI_DIST);
  // 2. npm 全局根
  const npmRoot = tryExec("npm root -g");
  if (npmRoot) list.push(path.join(npmRoot, PACKAGE_REL));
  // 3. Windows pi-node
  if (process.env.LOCALAPPDATA) {
    list.push(path.join(process.env.LOCALAPPDATA, "pi-node", "current", "node_modules", PACKAGE_REL));
  }
  // 4. 从 pi 可执行文件向上查找
  const piBin = tryExec(process.platform === "win32" ? "where pi" : "which pi");
  if (piBin) {
    for (const bin of piBin.split(/\r?\n/)) {
      let dir = path.dirname(bin);
      // 向上最多找 6 层，查找 node_modules/@earendil-works/pi-coding-agent/dist
      for (let i = 0; i < 6 && dir !== path.dirname(dir); i++) {
        const p = path.join(dir, "node_modules", PACKAGE_REL);
        if (isValidDist(p)) list.push(p);
        dir = path.dirname(dir);
      }
    }
  }
  // 5. require.resolve
  try {
    const pkg = require.resolve("@earendil-works/pi-coding-agent/package.json");
    list.push(path.join(path.dirname(pkg), "dist"));
  } catch {
    // ignore
  }
  return list;
}

function findPiDist() {
  for (const c of candidates()) {
    if (isValidDist(c)) return path.resolve(c);
  }
  return null;
}

module.exports = findPiDist;
if (require.main === module) {
  const dist = findPiDist();
  if (dist) {
    console.log("已自动识别 Pi dist 目录:", dist);
  } else {
    console.error("未找到 Pi 安装目录。请设置环境变量 PI_DIST 指向 pi 的 dist 目录。");
    process.exit(1);
  }
}
