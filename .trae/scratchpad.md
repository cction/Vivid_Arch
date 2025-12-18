# BananaPod 项目状态记录

## UI 设计标准（PodUI v1.x）

### UI 设计标准草案

#### 设计令牌（Design Tokens）

## 背景和动机

- 现状：代理 A/代理 B 在接入层可选模型数量偏多，PromptBar 展示名称与实际接入模型名耦合，维护与沟通成本高。
- 目标：收敛每个代理在接入层的模型数量，同时仅调整 PromptBar 展示名称（后台接入模型名称不变），避免影响后端路由与计费/权限等逻辑。

## 关键挑战和分析

- “后台接入模型名称不更改”约束：需要区分“展示名（UI label）”与“真实模型 id（backend/model key）”，避免重命名导致请求参数变化。
- 配置来源不唯一风险：模型列表可能同时存在于前端常量、后端配置、环境变量、远端配置或 feature flag 中，需先梳理“单一事实来源”。
- 兼容性：若历史会话/本地存储记录了旧的展示名或旧配置结构，需要保证升级后仍能映射到正确的 backend 模型 id。
- 可观测性：需要能在调试信息中明确看到“用户选择的展示名”与“实际发起请求的模型 id”。

## 成功标准

- 代理 A：接入层仅保留 `nano-banana`、`nano-banana-2` 两个模型可选；PromptBar 展示分别为 `Standard_A`、`Professional_A`；请求仍使用原模型名。
- 代理 B：接入层仅保留 `nano-banana`、`nano-banana-pro` 两个模型可选；PromptBar 展示分别为 `Standard_B`、`Professional_B`；请求仍使用原模型名。
- 回归：切换代理/切换模型/发起对话不报错；请求 payload/日志中模型 id 与后台保持一致；不存在“选择项显示正确但请求模型错误”的情况。

## 高层任务拆分

1. 梳理接入模型定义位置与数据流
   - 找到代理 A/代理 B 的模型列表来源（前端 PromptBar、后端路由、默认配置、存储恢复）。
   - 明确“展示名字段”与“真实模型字段”的结构与传递路径。

2. 收敛代理 A/代理 B 的模型列表
   - 代理 A：仅保留 `nano-banana`、`nano-banana-2`。
   - 代理 B：仅保留 `nano-banana`、`nano-banana-pro`。

3. 调整 PromptBar 展示名称映射（不改后台模型名）
   - PromptBar 中将 `nano-banana` 显示为 `Standard_A`（代理 A）与 `Standard_B`（代理 B）。
   - PromptBar 中将 `nano-banana-2` 显示为 `Professional_A`（代理 A）。
   - PromptBar 中将 `nano-banana-pro` 显示为 `Professional_B`（代理 B）。
   - 确保提交请求时仍使用 backend 模型名（原始模型 id）。

4. 兼容与迁移（如有存储）
   - 若本地存储/会话中持久化了“展示名”，增加映射回退到真实模型 id。
   - 若仅持久化“真实模型 id”，确保新展示名不影响读取。

5. 验证与回归
   - 覆盖：代理切换、模型切换、刷新恢复、历史会话恢复（如存在）、错误兜底路径。
   - 记录：在调试输出中打印展示名与真实模型 id（不输出任何敏感信息）。

## 项目状态看板

### 已完成
- [x] 梳理代理 A/B 模型配置来源与引用点
- [x] 收敛代理 A 模型为 `nano-banana`/`nano-banana-2`
- [x] 收敛代理 B 模型为 `nano-banana`/`nano-banana-pro`
- [x] PromptBar 显示名映射为 `Standard_*`/`Professional_*`
- [x] 补齐存储兼容回退与回归验证

### 进行中
- [x] 更新版本为 v1.2.0 并补齐中文变更记录
- [x] 构建并打包 dist 产物
- [x] 提交并推送 git tag v1.2.0

### 待办
- [ ] 无

## 回滚方案

- 配置回滚：恢复原代理 A/B 模型列表与 PromptBar 映射配置即可。
- 兼容回滚：保留旧展示名映射分支以支持旧会话/存储读取。
- 发布回滚：构建产物回退到上一版本，确保请求模型 id 未变更。

## 执行者反馈或请求帮助（占位）

- 执行者每完成一个待办项，更新“项目状态看板”的勾选状态，并记录：改动点、验证结果、潜在风险。

### 当前状态/进度跟踪

- 已完成：代理 A/代理 B 模型选项收敛与 PromptBar 展示名映射（后台模型 id 不变），并增加对旧存储模型值的回退归一化。
- 已完成：同步版本号到 `v1.2.0`，补齐中文变更记录；并验证 `npm run lint`、`npx tsc --noEmit`、`npm run build` 通过。
- 已完成：构建并打包 `dist`，产物为 `dist.zip`。
- 进行中：已本地提交 `chore(release): v1.2.0` 并创建 tag `v1.2.0`，正在推送到 GitHub。
- 已完成：API 修复已落代码（WHATAI 生图走 `/v1/images/generations` 并透传 `image_size`；GRSAI 编辑输入图归一化），并通过 `npm run lint`、`npx tsc --noEmit`、`npm run build`；等待手动出图验证（Network payload/尺寸）。
- 已完成：已在本地 Network 验证 WHATAI 请求体包含 `image_size`（示例 `nano-banana-2` + `4K`）；未配置令牌时返回 `401 Unauthorized` 属预期。

### 验证指引（人工）

- 代理 A：模型下拉仅有 2 项，显示 `Standard_A`/`Professional_A`，实际请求模型分别为 `nano-banana`/`nano-banana-2`。
- 代理 B：模型下拉仅有 2 项，显示 `Standard_B`/`Professional_B`，实际请求模型分别为 `nano-banana`/`nano-banana-pro`。

### 请求帮助

- 若模型列表由远端配置/环境变量注入且不可静态收敛，需要提供配置入口位置与发布流程说明，以便规划迁移与灰度策略。
- 当前 GitHub 推送阻塞：本机到 `github.com:443` 无法建立 TCP（`Test-NetConnection github.com -Port 443` 失败），已切换到 SSH 推送（`origin=git@github.com:cction/Vivid_Arch.git`）。但 `ssh -T git@github.com` 返回 `Permission denied (publickey)`，需要将本机公钥添加到 GitHub 账号的 SSH keys 后重试推送。

## API 调用排查与修复（WHATAI/GRSAI）

### 背景和动机

- 现状：WHATAI 生图在选择 `2K/4K` 时仍返回 `1K`；GRSAI 在 `pro` 编辑模式下疑似参考图未生效（需要确认输入图是否被正确传入/上传）。
- 目标：让 UI 的 `2K/4K` 选择在支持的模型与端点上真实生效；确保 GRSAI 编辑/生图时参考图输入稳定可用，并能用调试信息快速判断“输入图是否成功传入”。

### 关键挑战和分析

- WHATAI：当前生图函数未把 `imageSize` 传入请求体，导致 `2K/4K` 选择无效。
- GRSAI：当前编辑链路会把画布中的图片 `href` 直接当作 Base64 拼进 `data:image/...;base64,<...>`；当 `href` 为 `blob:` 或 `image:`（存储引用）时会构造出无效的 `data:` URL，表现为“参考图没上传/没生效”。
- 可观测性：需要在不泄露敏感信息的前提下输出关键调试字段（模型名、端点、imageSize、urls 形态、图片尺寸探测结果、状态码与返回片段），避免“看起来成功但实际传错”。

### 成功标准

- WHATAI：当模型为 `nano-banana-2` 且选择 `2K/4K` 时，请求侧能携带对应尺寸参数，返回图片尺寸与期望等级一致（或由服务端返回明确错误提示）。
- GRSAI：编辑/生图在存在参考图时，发送给接口的 `urls` 均为 `https://...` 或 `data:image/...;base64,...`，不会出现 `...base64,blob:` 或其它无效内容；失败时能在错误提示与调试输出中定位到具体原因（传参/鉴权/内容违规/超时）。
- 回归：WHATAI 与 GRSAI 两条链路在无参考图、单参考图、多参考图三种情况下均可出图；不影响现有视频生成与局部重绘（mask）逻辑。

### 高层任务拆分

1. 复盘 UI 到请求的参数映射
   - 确认 `imageSize` 仅在 `nano-banana-2`/`nano-banana-pro` 时可选，其他模型强制回退到 `1K`。
   - 明确“生图/编辑”分别走哪些端点与参数格式（JSON vs FormData）。

2. 修复 WHATAI 生图 `imageSize` 未生效
   - 对 `nano-banana`/`nano-banana-2` 生图优先使用 `POST /v1/images/generations`，并在 `nano-banana-2` 时透传 `image_size`。
   - 其他模型不走兼容分支，直接提示“不支持该生图协议”，避免参数不一致导致误判。

3. 修复 GRSAI 参考图输入不稳定（blob/image 引用归一化）
   - 在进入 `grsaiService.editImage/generateImageFromText` 前，将所有输入图 `href` 归一化为可用的 `dataUrl`（或可直接访问的 `https://...`）。
   - 覆盖 `blob:`、`data:`、`image:` 三类来源，确保最终 `urls` 符合 GRSAI 文档要求。

4. 增强调试信息与错误提示（不输出任何密钥）
   - 请求侧输出：provider、model、endpoints、imageSize、urlsCount、urlsKind 统计（`data/https/blob/other`）与首段预览截断。
   - 响应侧输出：状态码、任务 id、轮询次数、失败原因字段（`error/failure_reason`）。

5. 验证与回归
   - 用 DevTools Network 检查请求 payload：WHATAI 是否带 `image_size`；GRSAI `urls` 是否为合法形态。
   - 用前端尺寸探测验证出图尺寸（读取 `img.naturalWidth/naturalHeight`），并记录在调试输出中。
   - 运行 `npm run lint`、`npx tsc --noEmit`、`npm run build` 确保无回归。

### 项目状态看板（API 调用修复）

#### 已完成
- [x] 修复 WHATAI 生图 `imageSize` 透传与端点选择
- [x] 修复 GRSAI 参考图输入归一化（支持 blob/image/data）

#### 已完成
- [x] 增强请求/响应调试信息并回归验证
- [x] WHATAI 生图仅走 generations（透传选中模型），并输出实际宽高调试信息
