// 汉化 cli/args.js 的 printHelp 帮助文本
// 用法: node translate-cli-help.js
// 会自动探测 Pi 安装目录；也可设置环境变量 PI_DIST 指定
const fs = require("fs");
const path = require("path");
const findPiDist = require("./find-dist.js");

const DIST = findPiDist();
if (!DIST) {
  console.error("未找到 Pi 安装目录。请设置环境变量 PI_DIST 指向 pi 的 dist 目录后重试。");
  process.exit(1);
}
const file = path.join(DIST, "cli/args.js");
const helpZh = fs.readFileSync(path.join(__dirname, "help-zh.txt"), "utf8").trimEnd() + "\n";
let src = fs.readFileSync(file, "utf8");

// 定位 printHelp 中的 console.log 模板区间：从 "console.log(`" + APP_NAME 描述开始，到 "off by default)\n`);" 结束
const startMarker = "console.log(`${chalk.bold(APP_NAME)} - AI coding assistant with read, bash, edit, write tools";
const endMarker = "off by default)\n`);";
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  // 可能已汉化过（幂等）：检查中文标记是否存在
  const zhMarker = "console.log(`${chalk.bold(APP_NAME)} - 支持 read、bash、edit、write 工具的 AI 编码助手";
  if (src.includes(zhMarker)) {
    console.log("printHelp 已汉化过，跳过。");
    process.exit(0);
  }
  console.error("未找到 printHelp 文本区间", startIdx, endIdx);
  process.exit(1);
}
src = src.slice(0, startIdx) + helpZh + src.slice(endIdx + endMarker.length);
fs.writeFileSync(file, src);
console.log("printHelp 已汉化");
