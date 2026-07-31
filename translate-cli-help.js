// 汉化 cli/args.js 的 printHelp 帮助文本
// 用法: node translate-cli-help.js
const fs = require("fs");
const path = require("path");
const DIST = "C:/Users/Eternity/AppData/Local/pi-node/current/node_modules/@earendil-works/pi-coding-agent/dist";
const file = path.join(DIST, "cli/args.js");
const helpZh = fs.readFileSync(path.join(__dirname, "help-zh.txt"), "utf8").trimEnd() + "\n";
let src = fs.readFileSync(file, "utf8");

// 定位 printHelp 中的 console.log 模板区间：从 "console.log(`" + APP_NAME 描述开始，到 "off by default)\n`);" 结束
const startMarker = "console.log(`${chalk.bold(APP_NAME)} - AI coding assistant with read, bash, edit, write tools";
const endMarker = "off by default)\n`);";
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error("未找到 printHelp 文本区间", startIdx, endIdx);
  process.exit(1);
}
src = src.slice(0, startIdx) + helpZh + src.slice(endIdx + endMarker.length);
fs.writeFileSync(file, src);
console.log("printHelp 已汉化");
