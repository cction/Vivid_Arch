# BananaPod 项目状态记录

## 当前阶段：代理B（Grsai）生图超时占位符保留与任务ID重试（UI 优化阶段）

### 背景和动机

- 现状：代理B（Grsai）在网络抖动、服务端排队、Professional 模型耗时偏长等场景下，会出现“出图过慢 → 前端轮询超时/失败”。当前实现会在失败时移除占位符，用户丢失上下文，也无法基于服务端任务继续取回结果。
- 用户目标（体验）：第一次失败也不要“白等”，占位符应保留并清晰告知“任务ID/当前状态/下一步动作”，用户可在同一个占位符上反复“重新获取”直到成功或明确失败，同时仍然能手动删除该占位符。
- 新需求（必须满足）：
  - 仅当使用代理B相关模型（即 Grsai 提供方模型）时：
    - 生成图片时记录任务ID（taskId），并显示在占位符内。
    - 失败后占位符内提供“重新获取”按钮：点击按钮根据 taskId 再次查询生成图片信息。
  - 代理A（WHATAI）仅保留以下能力：
    - 首次生成失败时，占位符不消失，且占位符内显示失败原因。
    - 不显示 taskId，不提供“重新获取”按钮。
  - 通用结果处理：
    - 若确认生成成功：展示生成图片（替换占位符内容）。
    - 若确认生成失败：展示失败原因，占位符不消失，但可手动删除。
- 约束：
  - 所有新增元素的视觉风格与现有 PodUI 一致（背景/圆角/阴影/字体/按钮态）。
  - 不引入新第三方依赖。
  - 不输出敏感信息（API key、完整 prompt、完整图片 Base64）；但需要有足够调试信息（taskId、状态、耗时、尝试次数）。
- **用户反馈修正（UI）**：
  - 生成失败的信息和重试按钮在缩小时变得太小不可读。
  - 需改为与 `Generating` 状态一致的固定屏幕尺寸（不受 Zoom 影响）并居中显示。

### 关键挑战和分析

- 任务ID可得性与传播链路：
  - `grsaiService` 当前在 `pollDrawResult` 超时后抛异常，上层得到的是 “图像生成失败: 获取结果超时” 的文本，拿不到 taskId，导致无法“重新获取”。
  - 需要把“已获得 taskId，但结果未就绪（pending/timeout）”作为一种可返回的状态，携带 taskId 交给前端写入占位符。
- 占位符状态机（避免 UI/逻辑混乱）：
  - 需要明确占位符的状态集合与迁移：`creating -> generating -> timeout|failed|succeeded`，以及 `retrying -> generating` 的循环。
  - “仍在生成中（pending）”是有效状态：按钮点击后不应把它当成失败，只提示“仍在生成中”并保留占位符。
- 画布内可点击按钮的交互处理：
  - 占位符渲染在 SVG 内，按钮最好使用 `foreignObject`（嵌入 HTML）以复用现有 button 样式。
  - 需要 `stopPropagation`/`preventDefault`，避免触发画布拖拽、框选、缩放等手势。
- 刷新后的可恢复性（是否必须）：
  - 当前 `boardsStorage` 会瘦身图片元素字段，丢弃 `isGenerating/isPlaceholder/previewHref` 这类运行态字段。
  - 本需求中 taskId/失败原因属于“用户需要看到并可操作”的信息，建议作为可持久化字段写进 `ImageElement` 并被存储层保留。
- 调试与可观测性：
  - 需要在关键节点打印轻量日志，帮助定位“超时、失败原因、pending 未完成、重试次数”等问题。
  - 需要避免泄露敏感数据：日志只包含 taskId（可截断）、模型名、尝试次数、耗时。

### 目标定义（可验收）

- 生成中（两类提供方通用）：
  - 创建占位符后，进入 generating 状态，占位符内显示 “Generating...”。
  - 若为代理B（Grsai）：同时显示 `ID: <taskId>`（taskId 未获取到前可显示 `ID: -` 或隐藏该行）。
- 首次失败（两类提供方通用，尤其是超时）：
  - 占位符不被删除。
  - 占位符内显示错误提示（超时/失败原因）。
  - 若为代理B（Grsai）：占位符内同时显示 `ID: <taskId>`（若已获取）与“重新获取”按钮。
  - 若为代理A（WHATAI）：不显示 taskId，不出现“重新获取”按钮。
- 点击“重新获取”（仅代理B/Grsai 生效）：
  - 若任务已成功：占位符替换为真实图片；清除占位符标记与错误信息。
  - 若任务仍在生成：提示“仍在生成中，请稍后重试”，占位符继续保留（ID 不变）。
  - 若任务已失败：显示明确失败原因，占位符继续保留（ID 不变）。
  - 多次点击不会创建新元素，仅更新同一个占位符元素。
- 删除：
  - 用户通过现有删除逻辑可删除该占位符（无论生成中/失败/超时）。
- 风格一致：
  - 占位符内的提示条、文本、按钮使用现有 PodUI 的颜色/圆角/边框/阴影语义（沿用 `podui.css` 的 CSS 变量与已有按钮 class）。
  - **Failure Overlay**: 改为固定尺寸的居中卡片（180x140px），不受画布缩放影响（`scale(1/z)`），确保任何缩放比例下都清晰可读且可点击。

### 状态机与数据字段（规划约定）

- `ImageElement` 新增可选字段（需可持久化）：
  - `genProvider?: 'Grsai' | 'WHATAI'`
  - `genTaskId?: string`
  - `genStatus?: 'creating' | 'generating' | 'retrying' | 'pending' | 'timeout' | 'failed'`
  - `genError?: string`
- UI 展示规则（Canvas 占位符内）：
  - `isPlaceholder === true`：表示这是“生成占位符”（与普通 placeholder 图片区分）。
  - `isGenerating === true`：显示 spinner/Generating 样式。
  - `genTaskId`：仅在 `genProvider === 'Grsai'` 时展示为 `ID: ${taskId.slice(0, 8)}...`（避免过长）。
  - `genStatus in ['timeout','failed']`：显示 `genError`（截断）。
  - “重新获取”按钮：仅当 `genProvider === 'Grsai'` 且存在 `genTaskId` 时展示。
  - `genStatus in ['pending','generating','retrying']`：不显示失败文案；可在 `pending` 时显示“仍在生成中”提示（不作为 error toast）。

### 高层任务拆分（规划者 → 执行者实施顺序）

1. 扩展 `ImageElement` 以承载任务信息并接入存储层
   - 修改 `src/types/index.ts`：为 `ImageElement` 增加 `genProvider/genTaskId/genStatus/genError`。
   - 修改 `src/services/boardsStorage.ts`：在 `slimElement`/inflate 相关逻辑中保留上述字段（否则刷新后信息丢失）。
   - 成功标准：
     - 刷新页面后，占位符仍能看到失败原因；若为 Grsai 占位符且已有 taskId，则仍能看到 `ID`。

2. 改造 `grsaiService`：超时/未完成时也返回 taskId，并提供单次查询接口
  - 目标：让前端在“已获得 taskId 但轮询窗口没等到图”时，仍能拿到 `taskId` 进行重试。
  - 调整策略（建议）：
    - 将 `pollDrawResult` 从“超时抛错”改为“返回 `{ status: 'timeout'|'pending'|'failed'|'succeeded', taskId, ... }`”。
    - 新增 `getDrawResultOnce(taskId)`：调用 `/v1/draw/result` 一次，解析结果并返回三态（succeeded/failed/pending），供“重新获取”按钮使用。
  - 成功标准：
    - 生成接口返回 id 后，即使超时也能让前端拿到该 id。
    - “单次查询”能区分：有结果 / failed / pending。

3. 调整生成管线 `useGenerationPipeline`：失败不删占位符，写入任务ID与状态
  - 在两类 provider 的图片生成分支中，统一保证“失败不删除占位符 + 占位符内可见失败原因”。差异点如下：
    - 代理B（Grsai）：
      - 占位符创建后：写入 `genProvider='Grsai'`、`genStatus='generating'`。
      - 从服务层拿到 `taskId` 后立刻写入 `genTaskId`，使 UI 立刻可见。
      - timeout/failed/pending：保留占位符；`isGenerating=false`；写入 `genStatus` 与 `genError`（pending 可不写 genError）。
    - 代理A（WHATAI）：
      - 占位符创建后：写入 `genProvider='WHATAI'`、`genStatus='generating'`。
      - 失败时：保留占位符；`isGenerating=false`；写入 `genStatus='failed'|'timeout'` 与 `genError`；不写 `genTaskId`。
    - 通用成功路径：
      - 成功：替换 `href/mimeType/width/height`，并清理 `isGenerating/isPlaceholder/gen*` 字段。
  - 成功标准：
    - 首次失败后占位符仍在画布上：Grsai 显示 taskId 与重试入口；WHATAI 仅显示失败原因。

4. 调整 `Canvas`：占位符内显示 ID、失败原因与“重新获取”按钮（PodUI 风格）
  - 在图片占位符渲染分支中新增 UI：
    - generating：在现有提示条里增加 `ID: ...` 行或同一行右侧（仅 Grsai）。
    - failed/timeout：提示条替换为错误态（沿用当前深色底+轻边框+文字）；仅 Grsai 显示“重新获取”按钮，WHATAI 不显示按钮。
  - 交互要求：
    - 按钮点击 `stopPropagation`，不触发选择框/拖拽。
    - 视觉要求：使用现有 PodUI button class（例如 `pod-btn-*` 或 `PodButton`）与 CSS 变量，圆角与阴影与现有控件一致。
  - 成功标准：
    - UI 风格一致；按钮可点；不会导致画布误操作。

5. 新增“重新获取”回调与透传：完成基于 taskId 的闭环更新
  - 新增 `handleRetryGrsaiTask(placeholderId)`（仅 Grsai 占位符可触发）：定位元素 → 读 `genTaskId` → 调用 `getDrawResultOnce` → 更新元素。
  - 状态更新：
    - 点击后将元素标记为 `genStatus='retrying'`、`isGenerating=true`（显示 loading）。
    - 返回 succeeded：加载图片并替换占位符。
    - 返回 failed：写入 `genStatus='failed'` 与 `genError`，保留占位符。
    - 返回 pending：写入 `genStatus='pending'`，保留占位符，并在提示条显示“仍在生成中”。
  - 成功标准：
    - 多次点击不创建新元素；同一个占位符逐步从 pending → succeeded 或 pending → failed。

6. 回归验证与调试信息（必须可复现与可定位）
  - 手动用例：
    - 代理B（Grsai）：
      - 触发超时：占位符保留 + 显示 taskId + 可重试。
      - 任务最终成功：重试后能拿到图并替换。
      - 任务明确失败：显示 failure_reason 并保留占位符。
    - 代理A（WHATAI）：
      - 触发失败：占位符保留 + 显示失败原因；不显示 taskId；不出现“重新获取”按钮。
      - 正常成功：行为与现状一致。
  - 日志要求（示例，执行者实现时遵循）：
    - `[GrsaiTask] created { placeholderId, taskId, model }`
    - `[GrsaiTask] poll timeout { taskId, tries, elapsedMs }`
    - `[GrsaiTask] retry { taskId } -> { status }`
   - 命令验证：
     - `npm run lint`
     - `npx tsc --noEmit`

### 项目状态看板（代理B 生图超时占位符保留与任务ID重试）

#### 已完成

- [x] 规划者：明确目标、状态机与 UI 交互语义（占位符保留、taskId 展示、重新获取闭环）
- [x] 规划者：明确风险点（taskId 透出、SVG 内按钮交互、存储层字段保留、调试与安全）
- [x] 执行者：扩展 `ImageElement` 生成任务字段并接入存储层持久化
- [x] 执行者：改造 `grsaiService` 返回结构（超时/未完成也带 taskId）并新增单次查询接口
- [x] 执行者：调整 `useGenerationPipeline`（Grsai 失败不删占位符，写入任务状态/原因）
- [x] 执行者：调整 `Canvas`（占位符内显示 ID、失败原因与“重新获取”按钮，风格一致）
- [x] 执行者：增加重试回调并透传到画布，完成“重新获取”闭环
- [x] 执行者：完成手动回归与 `lint/tsc` 验证，并整理调试信息
- [x] 规划者：验收并结束本阶段任务
- [x] 执行者：(UI Hotfix) 修复 Failed Overlay 在缩小画布时过小的问题，改为固定尺寸卡片。
- [x] 执行者：(UI Enhancement) 调整 Failure Overlay 背景为紫色磨砂玻璃效果，与 UI 风格一致。

#### 进行中

- [ ] (空)

#### 待办

- [ ] (空)

### 执行者反馈或请求帮助（本阶段约定）

- 改动摘要与调试信息：
  - **核心改动**：
    - `ImageElement` 增加 `genProvider/genTaskId/genStatus/genError` (types/index.ts) 并持久化 (boardsStorage.ts)。
    - `grsaiService` 新增 `getDrawResultOnce` 并更新 `pollDrawResult` 返回结构。
    - `useGenerationPipeline` 失败时不再删除占位符，而是写入错误状态与 TaskID (Grsai)。
    - `Canvas` 新增 Failure Overlay，仅 Grsai 显示 TaskID 与 Retry 按钮。
    - `App.tsx` 实现 `handleRetryGenerate`，处理重试逻辑（Pending/Failed/Succeeded 状态流转）。
    - **(New)** `Canvas.tsx` Failure Overlay UI 调整：改为 `scale(1/z)` 的固定尺寸卡片 (180x140)，避免缩小不可读；背景改为紫色磨砂玻璃效果。
  - **验证结果**：
    - `npm run lint`: Passed.
    - `npx tsc --noEmit`: Passed.
  - **调试参考**：
    - 首次生成失败（超时）：ImageElement 会有 `genStatus='timeout'`, `genTaskId='...'`. UI 显示“生成超时”与重试按钮。
    - 重试 Pending：点击按钮 -> `genStatus='pending'` -> UI 显示“仍在生成中”。
    - 重试成功：`getDrawResultOnce` 返回 succeeded -> 图片加载 -> 占位符被真实图片替换，gen* 字段清除。

### 当前状态/进度跟踪（代理B 生图超时占位符保留与任务ID重试）

- 规划者：
  - 已完成：验收完毕，确认所有功能点符合需求。
  - 状态：本阶段任务关闭。
- 执行者：
  - 已完成：代码已合入并验证通过。

---

## 项目：项目更新脚本（发布流程）

### 背景和动机

- 现状：版本号分散在多处（`package.json` / README / `metadata.json` / `CHANGELOG.md` 等），容易出现“已升级但文档仍旧”的不一致问题。
- 目标：用一个脚本把“版本升级 → 更新说明（Changelog）→ 文档同步 → Git 提交/打 Tag → 可选推送 → 远程简介同步”串成一次性流程，减少遗漏。
- 约束：
  - 不引入新的第三方依赖（优先使用 Node 内置模块与现有工具链）。
  - 输出必须包含足够调试信息（版本号、命中替换次数、Git 命令结果/错误码）。
  - 不在 `CHANGELOG.md` 写入技术细节（严格遵守 `CHANGELOG_GUIDELINES.md`）。
  - 在执行任何“强制型 git 操作”前必须二次确认（例如涉及 `--force` 的场景默认不支持）。

### 关键挑战和分析

- 版本号一致性与单一事实源：
  - `package.json.version` 应作为唯一权威源；其它文件仅做“展示位同步”。
  - README / `metadata.json` 当前存在旧版本残留，需要脚本能稳定定位并替换“展示位”，避免误伤正文中其它数字。
- Changelog 写作规则的自动校验：
  - 更新要点必须面向用户、简短、中文、避免内部术语与接口/脚本/文件名。
  - 脚本需要对“要点条目”做基本校验与拦截，防止不合规内容被写入。
- Git 操作可靠性（Windows/PowerShell）：
  - 需要严格检查退出码与输出，避免“失败但脚本继续走”的假成功。
  - Tag 采用 annotated tag 以承载中文更新要点，便于回溯与发布记录。
- 可选推送与远程简介同步：
  - 推送是破坏性更强的动作，必须询问并确认后才执行。
  - “简介同步”优先考虑 GitHub 仓库 description（若环境无 `gh` 或未登录，则降级为提示人工操作）。

### 目标定义（可验收）

- 版本号：
  - 若未指定版本号：在当前 `x.y.z` 上执行 patch +1（例如 `1.3.3 → 1.3.4`）。
  - 若指定版本号：严格使用指定版本（必须符合 `x.y.z` 数字格式）。
  - 生成 Git tag：`vX.Y.Z`。
- 文档一致性：
  - README 标题中的版本号、README 的“当前版本”字段与 `package.json.version` 一致。
  - `metadata.json.name` 中的 `(vX.Y.Z)` 与 `package.json.version` 一致。
  - `CHANGELOG.md` 顶部新增 `vX.Y.Z (YYYY-MM-DD)` 版本块。
- Changelog 合规：
  - 2–5 条中文更新要点，每条约 10–25 字。
  - 每条以 `- ` 开头，建议用“新增/优化/修复”开头。
  - 不包含接口路径、参数、数据结构名、脚本名、文件名、终端命令等技术细节。
- Git 交付：
  - 生成一次 commit（提交信息含版本号），提交正文包含中文要点。
  - 创建 annotated tag `vX.Y.Z`，tag message 同中文要点。
- 可选推送：
  - 询问用户是否推送；确认后推送当前分支与 tag。
  - 推送后“简介”与最新状态一致（优先给出推荐简介文案与手动更新步骤，不强依赖 `gh` 等额外工具）。

### 高层任务拆分（规划者 → 执行者实施顺序，可稳定执行版本）

1. 建立整体发布流的分工与约定
  - 单一事实源：始终以 `package.json.version` 作为版本号权威来源。
  - 文案维护：`CHANGELOG.md` 顶部版本块与 README 中“核心更新”由执行者手动编辑，规划者只约束结构与规范。
  - 自动化职责：新增一个 Node 脚本专门负责“版本号同步 + Git 提交与打 Tag”，不做交互式提问，所有参数通过命令行传入。
  - 远程推送与简介更新：保持为显式动作，默认不自动推送、不自动改远程简介，仅在明确传入参数或执行者确认后执行。

2. 确定发布脚本形态与入口（纯 CLI，无交互）
  - 新增文件：`scripts/release.mjs`（与现有 `scripts/generateUpdateFeed.mjs` 等保持风格一致）。
  - 调用方式：
    - 基本：`node scripts/release.mjs`（自动在当前版本上 patch +1）。
    - 指定版本：`node scripts/release.mjs --version x.y.z`。
    - 干跑模式：任一命令加 `--dry-run` 时只打印计划改动，不真正写文件或提交。
    - 可选推送：通过 `--push` 显式开启推送行为（否则只在本地提交+打 Tag）。
  - 安全约束：
    - 不从标准输入读取任何内容，不依赖交互式确认。
    - 不调用 `git push --force` 等强制命令。

3. 版本解析与计算（脚本可稳定处理）
  - 读取 `package.json.version` 作为 `cur`。
  - 若传入 `--version x.y.z`：
    - 校验格式必须为纯数字的 `x.y.z`，否则直接退出并提示。
    - 使用该版本作为 `next`，不做自动 +1。
  - 若未传入 `--version`：
    - 将 `cur` 解析为 `major.minor.patch`，在 `patch` 上 +1，得到 `next`。
  - 生成：
    - `tag = v${next}`。
    - `date = YYYY-MM-DD`（使用本地日期，格式与现有 `CHANGELOG.md` 保持一致）。
  - 输出调试信息：
    - 当前版本 `cur`、目标版本 `next`、生成的 `tag`、`date`，全部打印到控制台。

4. 文案与版本块维护策略（人工 + 简单机器校验结合）
  - 人工编辑责任：
    - 发布前由执行者在 `CHANGELOG.md` 顶部手动新增一个版本块：
      - 形如：`## vX.Y.Z (YYYY-MM-DD)` 后跟 2–5 条以 `- ` 开头的中文更新要点。
      - 遵守 `CHANGELOG_GUIDELINES.md` 中的写作规范。
    - 同步更新 README 中“核心更新（vX.Y.Z）”一节的标题与条目，使其与本次 `CHANGELOG` 要点一致或为其子集。
  - 脚本读取责任（只读不改写文案）：
    - 从 `CHANGELOG.md` 顶部第一个版本块中解析本次更新要点：
      - 从 `## vX.Y.Z ...` 向下扫描，收集连续的以 `- ` 开头的行作为 `highlights`，直到遇到空行或下一个版本块。
    - 对每条 `highlight` 做轻量校验：
      - 若包含明显技术细节（如 `.ts`、`.tsx`、`/v1/`、`npm `、`node `、`` ` `` 等），打印警告但不中断流程，由执行者自行修正。
    - 这些 `highlights` 将用于：
      - Git 提交正文。
      - Git annotated tag 的 message。
  - 稳定性考虑：
    - 文案的正确性由人工保证，脚本只负责解析与复用，避免复杂的自动生成逻辑导致发布失败。

5. 版本号统一更新（脚本自动完成）
  - 更新目标始终以 `next` 版本为准：
    - `package.json.version = next`。
    - `README.md`：
      - 第一行标题中的 `(v...)` 更新为 `v${next}`。
      - “版本与发布”章节中的“当前版本：\`x.y.z\`”更新为 `\`${next}\``。
      - 如存在“核心更新（v...）”的版本号，也同步替换为 `v${next}`。
    - `metadata.json`：
      - `name` 字段中的 `(v...)` 更新为 `(v${next})`。
  - 每个文件修改时：
    - 限定替换范围：通过具体行匹配或正则仅命中上述展示位，尽量避免误改其它数字。
    - 打印：
      - 是否发生修改。
      - 命中次数。
      - 修改后包含版本号的行（截断显示），方便调试。

6. Git 提交与打 Tag（脚本负责执行，结果可追踪）
  - 预检：
    - 确认 `git status --porcelain` 有改动，且包含至少一个目标文件（`package.json`、`CHANGELOG.md`、`README.md`、`metadata.json`）。
    - 若没有改动或缺少目标文件改动，则退出并提示先完成文案编辑及版本同步。
  - 提交规范：
    - subject：`chore(release): vX.Y.Z`。
    - body：使用第 4 步解析得到的 `highlights`，逐行写入。
  - Tag 规范：
    - 创建 annotated tag：`git tag -a vX.Y.Z -m "<逐行 highlights>"`。
  - 输出调试信息：
    - 当前分支名。
    - 新提交的短哈希。
    - 创建的 tag 名称。

7. 远程推送与简介同步（显式开启，默认不推送）
  - 推送控制：
    - 仅当传入 `--push` 时，脚本才执行：
      - `git push`（推送当前分支）。
      - `git push --tags`（推送新建的 tag）。
    - 若未传入 `--push`：只在本地完成提交与 Tag 创建，终端输出提示“需手动执行 git push / git push --tags”。
  - 简介同步策略（不强依赖外部工具）：
    - 脚本根据 `metadata.json.description` 和 README 开头段落生成一段推荐的仓库简介文案，并打印到终端。
    - 执行者可以：
      - 登录 Git 托管平台（如 GitHub）手动将简介修改为该文案。
      - 或在未来扩展：由另一个专门脚本/命令行工具（如 `gh repo edit -d`）执行自动更新。

8. 校验与安全检查（与现有项目规则对齐）
  - 发布前后建议执行的命令：
    - `npm run lint`。
    - `npx tsc --noEmit`。
    - 视情况执行 `npm run build`，以确保生成产物可用（会顺带更新 `updateFeed.json`）。
  - 安全相关：
    - 若在终端或依赖相关输出中发现潜在漏洞提示，优先执行 `npm audit` 并查看结果，再决定是否继续发布。
  - 结束摘要：
    - 脚本在成功结束时打印：
      - 变更文件清单。
      - 版本号（cur → next）。
      - 提交哈希与 tag。
      - 是否已推送，以及建议的后续人工操作（如更新仓库简介）。

### 项目状态看板（项目更新脚本）

#### 已完成

- [ ] (空，规划者仅完成方案设计与约束，具体实现待执行者阶段推进)

#### 进行中

- [ ] (空)

#### 待办

- [ ] 实现 `scripts/release.mjs`（版本计算 + 文件版本号同步）
- [ ] 接入 `CHANGELOG.md` 顶部版本块解析，并复用要点生成提交与 Tag 文案
- [ ] 打通 Git 提交与 annotated tag 流程（含 dry-run 支持）
- [ ] 支持 `--push` 可选推送，并输出仓库简介推荐文案与手动更新指引
- [ ] 完成一轮端到端发布演练，并通过 lint/tsc/build 与 npm audit 校验

### 执行者反馈或请求帮助（项目更新脚本）

- 需要确认“简介同步”的目标系统：
  - 默认：GitHub 仓库 description（自动优先走 `gh`，无则输出人工步骤）。
  - 若目标为其它平台或应用内 About 文案，需要补充对应字段来源与写入位置。
