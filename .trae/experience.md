# BananaPod 经验与教训

## GitHub 认证与推送
- 经典 PAT（`ghp_...`）需启用完整 `repo` 权限才能创建与推送私有仓库；精细令牌需在“个人账户”范围授予“创建仓库”与 `Contents: Read & Write`，否则调用 v3 API 返回 `401 Unauthorized`。
- 推送时避免在远程 URL 中嵌入令牌；优先使用 `git -c "http.extraHeader=Authorization: Basic <base64(username:PAT)>" push` 临时注入认证头，推送完成后保持 `origin` 为纯 HTTPS。
- PowerShell 中对 `git` 的错误需要检查 `$LASTEXITCODE` 或解析标准输出/错误；`try/catch` 对非终止错误无法捕获，可能出现“失败但日志显示成功”的假象。
- 将令牌存放在 `.trae/githubPAT` 并通过 `.trae/.gitignore` 忽略，避免误提交与泄露。
- Windows 行尾：`CRLF/LF` 提示属正常；可在 `.gitattributes` 统一行尾，或设置 `core.autocrlf=true` 以减少提示。
- 若公司网络/代理导致 `github.com:443` 连接失败（如 `Failed to connect to github.com port 443` / `Recv failure: Connection was reset`），可切换 `origin` 为 SSH（`git@github.com:owner/repo.git`）并走 `github.com:22` 推送；若 `Permission denied (publickey)`，需先将 `~/.ssh/id_ed25519.pub` 添加到 GitHub 的 SSH keys。

## 打包与桌面应用（Electron）
- `electron-builder` 要求 `package.json.name` 使用规范 ASCII 名称（不支持 emoji/特殊符号）；可通过 `productName` 设置展示名。
- Vite 在 Electron 生产态需将 `base` 设为 `'./'`，否则 `file://` 协议下静态资源路径会指向根盘导致加载失败。
- `public/` 目录资源在组件中不要用绝对路径 `"/..."` 引用；改为 `${import.meta.env.BASE_URL}path` 或封装辅助函数，确保在 dev (`/`) 与 Electron (`./`) 两种 base 下均能正确解析。
- Windows 单文件建议使用 `portable` 目标，生成 `*.portable.exe`，便于分发与免安装使用。
- 若需要代码签名，需配置证书并启用 `win.certificateSubjectName` 或 `win.sign`；本次便携版未签名也可运行。
- 当 `package.json` 为 `type: "module"` 时：Electron 主进程若使用 `require`，需将入口文件改名为 `.cjs` 或改写为 ESM `import`；否则会出现“require is not defined in ES module scope”。同时确保打包写入的 `extraMetadata.main` 与 `main` 一致。

## 开发与调试
- 执行前先读取并核对目标文件内容（如 `.trae/scratchpad.md`），再进行编辑，保持文档结构一致。
- 所有外部调用输出需包含调试信息（状态码、错误消息、关键参数），便于快速定位问题。
- 网络错误（如 `Recv failure: Connection was reset`）需与认证错误区分；优先验证令牌权限与有效性，再排查网络或代理。

## 撤销历史（History）
- History v2 以 `patch` 记录增量（added/removed/updated + before/afterOrder），可通过 `localStorage.setItem('BANANAPOD_HISTORY_DIFF','1')` 启用；默认保持 v1 快照。
- 超过 `MAX_HISTORY` 时，v2 会把被裁剪后的首项物化为 `snapshot`，保证撤销链条可继续回放。

## UI 改动经验
- 透明度与不透明度：界面以 0–100 输入更直观，渲染与导出时需转换为 0–1（浮点），统一在 `<image>` 与 SVG 字符串中写入。
- 保兼容旧字段：替换工具栏功能时，保留既有 `borderRadius` 的渲染逻辑，避免破坏历史内容。
- 预览强校验：涉及视觉改动必须先启动本地服务器并打开预览页面验证实际效果与错误日志。

## v0.7.0 改动摘要（生图链路）
- 统一图片模型配置：新增 `WHATAI_IMAGE_MODEL`，生成与编辑共用同一模型值；读取优先级为 `localStorage > process.env > 默认`，默认设为 `gemini-2.5-flash-image`。
- 切换调用协议：图像“生成/编辑”改为使用 Chat(completions) `{ model, messages }`，不再依赖 `\v1\images\*` 端点，以便统一日志与链路。
- 强化输出约束：在文本指令中添加“只输出一行 `data:image/png;base64,<...>`，不要输出其它文字”，提高模型返回可解析图片的稳定性。
- Base64 归一化：统一对输入/输出进行去头、去空白、`-/_`→`+/` 转换与 `=` 补齐，避免 `atob` 报错与 `ERR_INVALID_URL`。
- 图片加载器优化：前端加载改为“Blob → ObjectURL”为主、`data:` 为辅；移除对 `data:` 的 `fetch`，绕开扩展拦截与跨域异常。
- 尺寸/比例解析稳健化：
  - 优先使用浏览器 `Image` 解析；失败时退回二进制解析（PNG/JPEG/GIF/WebP）提取宽高，不依赖图像解码。
  - 一致性处理：严格模式下尺寸不匹配直接报错；非严格模式进行信封式补齐（`letterboxToFixedSize/AspectRatio`）。
- 日志增强：
  - 请求侧输出 `[editImage] 路径: chat/completions(修改图片) { model, partsCount }` 与内容预览（`preview` 截断显示 `data:image/...` 或 `http...`）。
  - 返回侧输出 `kind/hint`，帮助定位模型是否返回了图片数据（`inlineData.data/b64_json/image_url.url`）。

## API 调取生图相关经验（gemini-2.5-flash-image）
- 调用协议选择：
  - 推荐使用 Chat(completions) 并在 `messages[0].content` 里同时传 `text` + `image_url(data:image/...;base64,...)`；文本中加入输出约束，避免文字描述干扰解析。
- 模型配置与覆写：
  - 一处生效：`localStorage.setItem('WHATAI_IMAGE_MODEL','gemini-2.5-flash-image')`，统一生成与编辑模型。
  - 兼容旧键：若存在 `WHATAI_IMAGE_GENERATION_MODEL/WHATAI_IMAGE_EDIT_MODEL`，优先从 `WHATAI_IMAGE_MODEL` 回退覆盖。
- 比例与尺寸：
  - 视口比例映射到常用集合（`16:9/9:16/4:3/3:2/...`），减少模型回退到 `1:1`。
  - 编辑链路：若提供遮罩，追加 `[mask:provided]`，并将首图尺寸作为目标尺寸以确保输出一致。
- 返回数据解析：
  - 优先解析 `data:image/...;base64,...`；否则解析 `inlineData.data`；再次尝试 `image_url.url`（`http` 链接时拉取为 Blob 再转 Base64）。
  - 仅对匹配到的 Base64片段归一化与解码，避免混入 Markdown 标记或尾随字符。
- 浏览器环境注意：
  - 扩展会拦截 `fetch` 或消息通道，导致“message channel closed”；使用隐身模式或禁用扩展进行验证。
  - 避免对 `data:` 执行 `fetch`；统一走 Blob → ObjectURL 或直接设置 `data:` URL。
- 调试建议：
  - 保留链路日志（模型名、分片数量、预览截断、返回内容 hint）；一旦出现“未找到输出”，先检查模型是否遵循输出约束、是否返回了图片数据。
  - 使用 `runSizeProbe()` 进行本地尺寸解析自检：应返回 `{ png: { width: 1, height: 1 } }`。

## 常见问题与处理
- 仅返回文字：加强输出约束，提示“只输出 data:image/png;base64”，并减少说明性文本。
- `InvalidCharacterError/ERR_INVALID_URL`：检查是否未做 Base64 归一化或混入非 Base64字符；统一走归一化与 Blob 加载。
- 非图像响应：对 `http` 返回先校验 `content-type`，非 `image/*` 直接提示并中止尺寸解析。

## 拖拽导入与导航拦截经验

- 捕获阶段优先：在画布 `<svg>` 与根容器添加 `onDragOverCapture/onDropCapture`，捕获阶段统一 `preventDefault` 与 `dropEffect='copy'`，避免单图触发浏览器默认导航。
- 全局兜底：在 `document/window` 捕获阶段绑定 `dragenter/dragover/dragleave/drop` 并输出轻量日志 `[GlobalDND]`，覆盖 `foreignObject` 内部控件的事件路径差异。
- `foreignObject` 差异：SVG 内部 `foreignObject` 承载的 HTML 区域可能导致冒泡阶段监听失效；捕获阶段拦截可消除该差异的影响。
- URL 兼容策略：除扩展名匹配外，尝试 `fetch(url)` 后以 `blob.type` 判断是否为 `image/*`，支持无扩展名 CDN/签名链接的图片拖拽导入。
- 数据提取稳健性：优先使用 `dataTransfer.items` 获取 `File`，无则回退 `dataTransfer.files`；仅当无文件时解析 `text/uri-list/text/plain`。
- 并发与内存控制：按 `navigator.hardwareConcurrency` 计算并发；当总字节超过 200MB 时降为 1，避免大图批量拖入导致内存峰值过高。
- 预览布局防重叠：在拖拽预览与批量导入布局中计算现有元素边界，尝试网格偏移避免重叠（dragover 尝试 60 次，导入尝试 200 次），确保矩阵预览与最终位置不冲突。
