# pi-zh-patch · Pi 中文汉化补丁

> **适用于 Pi 版本：`0.83.0`**
> **项目日期：2026 年 7 月 31 日**

将 [Pi](https://pi.dev) 编码代理的 TUI / CLI 界面中的展示文案汉化为中文的社区补丁。

Pi 官方目前没有 i18n / 本地化机制（主题只能改颜色，不能改文字），所有界面文字均硬编码在安装目录的 JS 文件中。本项目通过精确字符串替换的方式，将界面中**用于显示说明的文字**翻译为中文，并对 pi 升级后的重新打补丁提供了完整的脚本支持。

开源精神永存！🎉

---

## ✨ 特性

- 🈶 覆盖全部主要界面：设置菜单、所有选择器（会话/会话树/资源/模型/信任/OAuth/登录/主题）、帮助表格、启动提示、状态消息、更新通知、压缩/分支摘要、bash 执行、错误/警告消息
- 🈶 覆盖命令系统：`/help` 全部命令描述、所有按键绑定（keybindings）描述
- 🈶 覆盖 CLI：`pi --help` 全文（选项/示例/环境变量/内置工具）、全部 CLI 错误消息、包管理器帮助
- 🛡️ **安全设计**：只替换纯展示字符串；与代码逻辑耦合的字符串（如 `"Compaction cancelled"`、`"Image reading is disabled."`）、工具 schema 描述（发给 LLM 的指令）、系统提示、模型 ID、键位名、环境变量名、第三方库均**有意保留英文**，避免产生 bug
- 🔁 **幂等补丁**：脚本可重复运行，pi 升级后一键恢复汉化
- ✅ 补丁应用后自动对全部 JS 文件执行 `node --check` 语法校验

## 🖼 效果预览

| 界面 | 说明 |
|------|------|
| TUI 主界面 | 底部状态栏、帮助表格、启动提示均为中文 |
| 设置菜单 `/settings` | 全部设置项名称与描述为中文 |
| 命令菜单 `/help` | 全部命令与快捷键描述为中文 |
| CLI | `pi --help`、`pi auth`、`pi list` 等输出为中文 |

## 📦 目录结构

```
pi-zh-patch/
├── patch.js                  # 补丁应用脚本（自动探测 Pi 目录，幂等可重复运行）
├── translate-cli-help.js     # 汉化 cli/args.js 的 --help 大文本（自动探测，幂等）
├── find-dist.js              # Pi 安装目录自动探测模块（支持 PI_DIST 环境变量覆盖）
├── help-zh.txt               # --help 的中文文本（translate-cli-help.js 使用）
├── map-1-settings.json       # 设置界面（settings/thinking/theme/show-images/first-time-setup）
├── map-2-selectors.json      # 选择器（tree/session/config/model/scoped-models/trust/oauth/login 等）
├── map-3-interactive.json    # 主交互界面状态消息
├── map-4-theme.json          # 主题系统错误消息
├── map-5-core.json           # core 目录（slash 命令描述、按键描述、错误消息）
├── map-6-cli.json            # CLI（main、credential-print、list-models、llama 扩展）
├── map-7-pkgcli.json         # 包管理器 CLI 消息
├── map-8-pkghelp.json        # 包管理器帮助块
├── map-9-export-html.json    # HTML 导出模板
├── map-10-misc.json          # 其余遗漏项
└── extract.js                # 字符串提取工具（开发者用）
```

## 🚀 使用方法

### 1. 应用补丁

```bash
cd pi-zh-patch
node patch.js map-*.json
node translate-cli-help.js
```

补丁会**自动探测** Pi 的安装目录（`dist`），无需手动修改路径。探测优先级：

1. 环境变量 `PI_DIST`（显式指定，最灵活）
2. `npm root -g` 下的 `@earendil-works/pi-coding-agent/dist`（Windows 的 pi-node 与 Linux/macOS 全局安装均适用）
3. Windows：`%LOCALAPPDATA%\pi-node\current\node_modules\...`
4. 从 `where pi` / `which pi` 定位的可执行文件向上查找
5. `require.resolve` 解析

如果自动探测失败（例如自定义安装目录），设置环境变量即可：

```bash
# Windows (PowerShell)
$env:PI_DIST = "D:\path\to\@earendil-works\pi-coding-agent\dist"
node patch.js map-*.json

# macOS / Linux
PI_DIST=/path/to/@earendil-works/pi-coding-agent/dist node patch.js map-*.json
```

### 2. 重新启动 Pi

重启 `pi` 后即可看到中文界面。

### 3. Pi 升级后重新打补丁

Pi 升级（`pi update`）会覆盖 `dist` 目录导致汉化失效，重新运行上述两条命令即可恢复。

## ⚠️ 注意事项

- **适用版本**：本补丁针对 **Pi 0.83.0** 编写。Pi 升级后部分字符串可能变化，`patch.js` 会列出未命中的映射（通常只是"已翻译过"的旧键，属正常现象），可据此更新映射表。
- **界面对齐**：中文为双宽字符，个别表格（如帮助表格）对齐可能轻微错位，属正常现象。
- **有意保留英文的内容**：
  - 被代码逻辑比较的字符串（`"Compaction cancelled"`、`"Image reading is disabled."`、`"Failed to load extension"`、`"Using custom model id"` 等）
  - 工具 schema 描述（`core/tools/*.js` 中的参数说明）——这些是发给 LLM 的模型指令而非界面文字
  - 系统提示（`core/system-prompt.js`、`core/skills.js`）、模型 ID、命令名、键位名、环境变量名、第三方库（highlight.min.js 等）
  - 设置项中的逻辑值（如 `"true"`/`"false"`、`"one-at-a-time"`、`"tree"`/`"fork"`/`"none"`）

## 🤝 贡献

欢迎提交 PR 补充遗漏的翻译或适配新版本。开发者流程：

```bash
# 提取当前版本 dist 中的候选字符串（开发用）
node extract.js <目录> <输出文件>
```

## 📄 许可证

MIT
