# BananaPod 项目状态记录


## 当前阶段：生成按钮与生图取消能力改造（规划者）

### 背景和动机

- 现状：当前 PromptBar 底部使用文字按钮触发生图，请求开始后仅通过全局 Loading 提示进度，无法在同一入口执行“取消本次生成”，且按钮文案与图标在不同语言下不一致。
- 症结：
  - 生图过程中，用户如果发现提示词写错，只能等待请求结束或刷新页面，缺乏“立即中断”的控制点。
  - 生成按钮缺少明确的状态切换（空输入/可触发/生成中），交互不直观，视觉上也没有统一的图标化设计。
  - 前端生成管线 `useGenerationPipeline.ts` 为一次性流程，没有显式的“取消信号”或令牌机制，难以在中途停止后续副作用（占位图插入、元素替换等）。
- 目标：设计并实现一个图标化的生成按钮，具备清晰的三态（未激活/可生成/生成中），并在生成过程中支持点击同一按钮取消本次生图，请求结束后不再更新画布或状态。
- 范围：仅涉及前端交互与状态管理，包括 PromptBar 组件、App 容器和 `useGenerationPipeline` 生成管线，不调整服务端 API 行为。

### 关键挑战和分析（本阶段）

- 按钮状态机设计：
  - 需要用最少的状态表达三个维度：输入是否为空、是否在生成中、是否存在可取消的请求。
  - 按钮颜色保持不变，仅依靠图标和启用/禁用态传达含义，避免破坏现有视觉规范。
- 取消语义与实现方式：
  - 后端 API 未必提供硬中断能力，因此前端至少要做到“软取消”：即便请求在后台继续，前端不再消费结果、不更新画布。
  - 需要一个简单可靠的机制（令牌 token / generationId）区分不同批次的生成，确保取消后旧请求的结果不会覆盖新状态。
- 与现有生成管线的兼容性：
  - `useGenerationPipeline.ts` 同时支持文本生图、编辑生成和掩膜重绘，取消机制必须对三种模式统一生效。
  - 要兼顾占位图插入/替换逻辑，避免在取消后仍残留“生成中”占位元素或错误的选中状态。
- 用户体验与键盘操作：
  - 保持 Enter 快捷键仍能触发生图，且在生成中按 Enter 不应再次触发新的请求。
  - 按钮的 aria-label 与 title 需要随着状态切换（生成/取消）以兼顾可访问性。

### 本阶段高层任务拆分

1. 需求澄清与现状盘点
   - 梳理当前 PromptBar 中生成按钮的渲染逻辑、文案来源以及启用/禁用条件。
   - 盘点 `App.tsx` 与 `useGenerationPipeline.ts` 中关于 `isLoading`、错误提示和占位符的状态流转。

2. 设计按钮状态机与图标方案
   - 定义按钮三态：
     - 未激活：输入为空，按钮禁用，仍展示统一背景色。
     - 可生成：输入非空，显示向上箭头图标，点击触发生图。
     - 生成中：显示暂停/停止图标，点击触发取消。
   - 明确 aria-label/title 文案切换规则，保证中英文下行为一致。

3. 生成管线取消机制设计
   - 选择令牌模式：为每次生成分配递增 token，保存在 `useRef` 中。
   - 设计 `handleCancelGenerate` 接口：将当前 token 作废并清理 `isLoading` 与进度提示。
   - 在管线内所有异步结果落地前检查 token，一旦不匹配则直接丢弃结果。

4. 前端接线与实现方案
   - 在 `useGenerationPipeline.ts` 中实现 token + 取消逻辑，并返回 `{ handleGenerate, handleCancelGenerate }`。
   - 在 `App.tsx` 中接入新的取消函数，将 `isLoading` 与按钮状态关联起来。
   - 在 `PromptBar.tsx` 中重构生成按钮为图标按钮，拆分点击逻辑（生成 / 取消）。

5. 测试与验证策略
   - 手动场景：空输入、正常生图、中途取消、取消后立即重新生成、连续多次生成等。
   - 异常注入：结合 `localStorage('debug.gen.fail')` 模式，验证取消后不会出现“卡在生成中”的假状态。
   - 回归检查：确认不影响占位符插入与替换、图层选中行为以及键盘快捷键。

### 项目状态看板（生成按钮与取消能力）

#### 已完成

- [x] 规划者：整理生成按钮与取消能力的背景、问题与目标（本文件）。
- [x] 规划者：给出按钮三态与生成管线取消机制的高层方案。

#### 进行中


#### 待办

- [x] 在 `PromptBar.tsx` 中重构生成按钮为图标按钮（向上箭头 / 停止）。
- [x] 在 `useGenerationPipeline.ts` 中实现 token 驱动的取消逻辑，并导出 `handleCancelGenerate`。
- [x] 在 `App.tsx` 中将取消函数接入 PromptBar，并统一管理 `isLoading` 与按钮状态。

### 执行者反馈或请求帮助（本阶段约定）

- 执行者在开始实现前，应从“待办”中选中一个任务，将其拆分为 1–3 个可执行的小步骤，并在本节补充：
  - 涉及的文件与核心改动点。
  - 可能的风险（如对现有占位符逻辑的影响、与键盘快捷键冲突等）。
- 实现完成后，执行者需要：
  - 更新“项目状态看板（生成按钮与取消能力）”中对应条目为已完成。
  - 在本节记录：实际改动摘要、运行过的命令（如 `npm run lint`、`npx tsc --noEmit`）以及手动测试结论。
  - 若发现现有生成管线结构不利于引入取消机制，应在此提出重构建议由规划者评估。

### 当前状态/进度跟踪（生成按钮与取消能力）

- 规划者：
  - 已完成生成按钮三态与取消交互的整体设计，明确了状态机、图标方案以及与生成管线的边界。
  - 已将实现工作拆分为 PromptBar UI 重构、生成管线取消机制、App 接线与测试三个主要方向，并落入看板待办。
- 执行者（本轮实现）：
-  - 已在 `PromptBar.tsx` 中将文字生成按钮重构为三态图标按钮：空输入禁用、可生成时显示向上箭头、生图过程中显示圆圈 + 方块停止图标，并通过同一入口触发生成 / 取消。
-  - 已在 `useGenerationPipeline.ts` 中引入基于 `useRef` 的递增 token 机制，封装 `safeSetIsLoading/safeSetError/safeCommitAction/safeSetSelectedElementIds` 等方法，并在所有异步回调和占位符替换逻辑前检查 token，确保取消后旧请求不会继续修改画布或状态，同时导出 `handleCancelGenerate`。
-  - 已在 `App.tsx` 中接入新的 `handleCancelGenerate`，并将其传递给 `PromptBar`，使主生成按钮具备取消当前生图的能力；同时保持原有 `isLoading` 与 Loader 行为不变。
-  - 已运行 `npm run lint` 与 `npx tsc --noEmit`，当前无新增 lint 或类型错误。

---

## 当前阶段：设置面板右侧增加更新面板（规划者）

### 背景和动机

- 现状：设置面板 `CanvasSettings` 只展示基础偏好与 API 设置，没有将最近版本的功能更新可视化呈现给用户。
- 痛点：
  - 用户不清楚近期版本新增了哪些能力或 UI 改动，只能阅读 `CHANGELOG.md` 等开发文档。
  - 产品迭代频率较高，但缺少一个“就近可见”的轻量版本日志入口。
- 目标：
   - 在设置界面右侧增加一个“更新面板（Update Panel）”，自动展示最近三个版本的功能更新摘要，支持滚动查看且整体高度不超过当前设置面板高度。
  - 更新内容从 `CHANGELOG.md` 中自动提取，前端只消费结构化摘要，无需在浏览器中解析 Markdown。

### 关键挑战和分析

- 数据来源与抽取方式：
  - 必须基于现有 `CHANGELOG.md`，不能引入额外的手工维护更新文案，避免信息不一致。
  - Markdown 结构存在多种类型条目（feat/fix/ui/docs/chore 等），需要筛选出对最终用户有价值的“高亮”项。
- 构建流程与前端解耦：
  - 不宜在浏览器侧做复杂正则解析，影响首屏性能并增加错误面。
  - 更合适的方式是在构建前使用 Node 脚本，生成一个轻量 JSON（最近 3 个版本），供前端直接 `import`。
- 布局与交互：
  - 设置面板当前宽度约 `w-80`，需要在不破坏现有视觉的前提下调整为左右两列布局。
  - 左侧继续展示原有设置项，右侧为更新面板；两侧内部分别滚动，外层 Panel 保持单一高度限制。
- 国际化与文案：
  - 标题与描述需要支持中英文切换；版本号与日期保持原样即可。
  - 更新摘要本身主要来自中文 `CHANGELOG`，短期内先以中文展示为主，后续如有英文 changelog 再扩展。

### 高层任务拆分

1. 基于 CHANGELOG 生成更新摘要 JSON
   - 编写 Node 脚本（如 `scripts/generateUpdateFeed.mjs`），读取项目根目录 `CHANGELOG.md`。
   - 解析版本段落：以 `## v...` 作为版本头，截取到下一个 `##` 或文件末尾。
   - 在每个版本块中筛选以 `- feat(`、`- ui(`、`- style(`、`- fix(`、`- perf(`、`- compat(`、`- refactor(` 开头的条目，裁剪前缀和模块名，只保留自然语言部分。
   - 每个版本保留前 3 条高亮，组装为 `{ version, date?, highlights[] }` 结构。
   - 仅输出最近 3 个版本，写入 `src/config/updateFeed.json`。
   - 在 `package.json` 中配置 `"predev"` 和 `"prebuild"` 钩子自动生成该 JSON，避免手工执行。

2. 定义前端类型与 UpdatePanel 组件
   - 在前端定义 `VersionUpdate` 与 `UpdateFeed` 类型，约束 `updateFeed.json` 结构。
   - 新增 `src/features/settings/UpdatePanel.tsx` 组件：
     - 接收 `updates: VersionUpdate[]`、`language: 'en' | 'ZH'`、`t`。
     - 在有限高度内以卡片形式展示最近 3 个版本，内部支持纵向滚动。
     - 每个版本卡片内容包含：版本号、可选日期、最多 3 条高亮描述。
   - 处理空数据兜底：无更新时展示“暂无更新记录”文案或静默隐藏。

3. 调整 CanvasSettings 布局接入更新面板
   - 修改 `src/features/settings/CanvasSettings.tsx`：
     - 将原有内容区改为左右布局：左侧为原设置项，右侧为 `UpdatePanel`。
     - 适度增大 Panel 宽度（如 `w-[720px] max-w-[95vw]`），保证两侧内容可读。
     - 左右列设为 `h-full` + `overflow-y-auto`，使两侧各自滚动，整体高度仍由 Panel 的 `max-h-[85vh]` 控制。
   - 在 CanvasSettings 中 `import updates from '@/config/updateFeed.json'`，将其与 `language`、`t` 一并传入 `UpdatePanel`。
   - 根据需要在小屏幕隐藏右侧更新面板（如 `hidden md:block`），防止窄屏拥挤。

4. 国际化文案补充与 UI 微调
   - 在 `src/i18n/translations.ts` 的 `settings` 下新增：
     - `updatePanelTitle`：`'Latest updates'` / `'最近更新'`
     - `updatePanelFromChangelog`（可选）：说明“基于 CHANGELOG.md 总结”。
   - 在 UpdatePanel 中使用 `t('settings.updatePanelTitle')` 等文案，保持与现有设置面板风格一致。
   - 调整右侧卡片的字体大小、间距与滚动条样式，复用 `pod-scrollbar`。

5. 验证与回归测试
   - 手动验证：
     - 启动 `npm run dev`，打开设置面板，确认右侧展示最近 3 个版本的更新摘要，支持滚动且高度不超出 Panel。
     - 修改 `CHANGELOG.md` 新增一个版本号，重新运行 dev/build，确认右侧自动更新，且只保留最新 3 个版本。
   - 命令验证：
     - 运行 `npm run lint`、`npx tsc --noEmit`、`npm run build`，确保新脚本与组件无 lint/类型/构建错误。

### 项目状态看板（设置面板右侧更新面板）

#### 已完成

- [x] 规划者：梳理设置面板右侧更新面板的需求背景与约束条件。
- [x] 规划者：输出基于 CHANGELOG 的数据抽取方案与前端组件整体设计。
- [x] 执行者：设计并实现 `generateUpdateFeed` Node 脚本，从 `CHANGELOG.md` 生成结构化 `updateFeed.json`。
- [x] 执行者：实现 `UpdatePanel` 前端组件，并在 `CanvasSettings` 中完成布局改造。
- [x] 执行者：补充 i18n 文案与样式，执行 lint/typecheck/build 与手动验证。
- [x] 执行者：根据用户反馈调整布局（左侧宽度固定 200px，优化紧凑度）。
- [x] 执行者：优化 API Key 设置区布局，改为纵向排列，防止窄屏下溢出。
- [x] 执行者：将保存按钮调整为右对齐紧凑样式，符合整体 UI 设计。
- [x] 执行者：统一保存按钮圆角样式 (rounded-md)，与设置面板其他元素保持一致。
- [x] 执行者：调整更新摘要生成逻辑，仅展示最近 2 个版本。

#### 进行中

- [ ] 评估后续是否需要英文 `CHANGELOG` 或更精细的高亮规则，以提升英文界面的可读性。

#### 待办

- [ ] (可选) 优化脚本以支持更多格式的 Changelog 标题或自定义高亮标签。

### 执行者反馈或请求帮助（设置面板右侧更新面板）

- 执行者（本轮实现）：
  - 已编写 `scripts/generateUpdateFeed.mjs` 并配置 `predev/prebuild` 钩子，实现了从 `CHANGELOG.md` 提取并按版本号倒序生成最近 3 个版本的 JSON 数据。
  - 已新增 `src/features/settings/UpdatePanel.tsx` 组件，并调整 `CanvasSettings.tsx` 为左右分栏布局（左侧设置，右侧更新面板）。
  - 已更新 `src/i18n/translations.ts` 添加中英文标题文案。
  - 运行 `npm run lint` 和 `npx tsc --noEmit` 均通过；脚本生成的 JSON 数据准确无误。
  - 注意：`UpdatePanel` 在宽度小于 `md` (768px) 时会自动隐藏，以适应移动端/小屏布局。
