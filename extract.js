// 提取候选 UI 文案：剔除注释、import、路径、纯代码 token
const fs = require("fs"), path = require("path");

const DIST = "C:/Users/Eternity/AppData/Local/pi-node/current/node_modules/@earendil-works/pi-coding-agent/dist";
const roots = process.argv[2] ? process.argv[2].split(",") : ["modes/interactive"];
const outFile = process.argv[3] || "candidates.txt";

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

// 去掉注释后的代码
function stripComments(src) {
  // 先处理块注释，再处理行注释（粗略但够用）
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

const pat = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const found = new Map();
for (const root of roots) {
  for (const f of walk(path.join(DIST, root))) {
    const src = stripComments(fs.readFileSync(f, "utf8"));
    let m;
    while ((m = pat.exec(src))) {
      let s = m[0];
      const inner = s.slice(1, -1);
      // 过滤条件
      if (inner.length < 2 || inner.length > 200) continue;
      if (!/[A-Za-z]{2,}/.test(inner)) continue;
      // 排除 import/require/模块路径
      if (/^(\.{1,2}\/|node:|[a-z-]+:)/.test(inner)) continue;
      if (/\.(js|ts|json|css|html|md|txt)$/.test(inner)) continue;
      // 排除纯标识符/变量/方法名
      if (/^[a-z][a-zA-Z0-9_]*$/.test(inner) && !/[A-Z]/.test(inner.slice(1))) continue;
      if (/^[a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+$/.test(inner)) continue;
      // 排除 URL
      if (/^https?:\/\//.test(inner)) continue;
      // 排除路径
      if (/^[~./\\]/.test(inner) && /[\\/]/.test(inner)) continue;
      // 排除 CSS 类名/十六进制颜色
      if (/^[#a-zA-Z0-9_-]+$/.test(inner) && !/\s/.test(inner)) continue;
      const key = s;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push(path.relative(DIST, f));
    }
  }
}
const items = [...found.entries()].sort((a, b) => {
  const an = a[1].length, bn = b[1].length;
  if (bn !== an) return bn - an;
  return a[0].localeCompare(b[0]);
}).filter(([s]) => {
  const inner = s.slice(1, -1);
  if (inner.length > 140 || inner.length < 4) return false;
  if (!/^[A-Za-z]/.test(inner)) return false;
  if (/^[a-z][a-zA-Z0-9_.]*$/.test(inner)) return false;
  if (/^https?:|^\/|^\.|^node:|^[a-z-]+:\/\//.test(inner)) return false;
  if (/\.(js|ts|json|md|txt|css|html)$/.test(inner)) return false;
  if (/\$\{/.test(inner) && !/\s/.test(inner)) return false;
  return true;
});
let out = `总候选字符串: ${items.length}\n`;
for (const [s, fs] of items) {
  out += JSON.stringify(s) + "  <" + [...new Set(fs)].join(",") + ">\n";
}
fs.writeFileSync(outFile, out);
console.log("写入", outFile, "共", items.length, "条");
