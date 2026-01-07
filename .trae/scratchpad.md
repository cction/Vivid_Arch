# BananaPod 项目状态记录

## 当前阶段：失败提示卡片“重试按钮终止条件”优化（规划中）

### 背景和动机

- 现状：失败提示卡片在“重新获取”后仍可能持续展示重试按钮，即便服务端已经明确返回失败，容易误导用户继续重试无意义操作。
- 用户目标（体验）：当结果已经明确失败时，卡片只呈现失败原因，不再提供重试入口；当未明确失败且未返回图片时，允许持续重试直到成功出图。

### 关键挑战和分析

- 现有 `genStatus='failed'` 语义不够细：可能代表“首次失败但仍可重试”，也可能代表“重试后已明确失败应禁止重试”，需要区分以避免误伤现有能力。
- 服务端返回差异：存在 `status` 明确失败但 `failure_reason` 缺失的情况，需要兜底错误文案，同时保留足够调试信息（taskId/status）。
- 状态持久化：一旦进入“明确失败不再重试”，刷新后也应保持一致，避免按钮“复活”。
- 并发点击：用户可能连续点击“重新获取”，需要在一次请求进行中临时禁用按钮，避免并发请求覆盖状态。

### 目标定义（可验收）

- 仅对 `genProvider === 'Grsai'` 的失败提示卡片生效。
- 点击“重新获取”后：
  - 若结果 `status` 明确为失败（`failed`）：卡片只显示错误信息，不显示“重新获取”按钮。
  - 若未明确失败且未返回正确图片（`pending/timeout` 或解析后无图片但也非 `failed`）：始终保留“重新获取”按钮，允许持续点击直到成功出图。
- 成功出图后：占位符替换为真实图片，清理生成态字段与错误提示。

### 状态机与数据字段（规划约定）

- `ImageElement` 新增可选字段（需可持久化）：
  - `genRetryDisabled?: boolean`
- 语义：
  - `genRetryDisabled === true`：明确失败终态，不再允许“重新获取”按钮出现。
  - `genRetryDisabled !== true`：允许“重新获取”按钮出现（在 Grsai 且存在 taskId 前提下）。
- 重试时的临时状态约定：
  - 点击后将元素置为 `genStatus='retrying'` 且 `isGenerating=true`，用于临时禁用按钮与展示加载态。

### 判定标准（必须明确）

- 明确失败：
  - `getDrawResultOnce(taskId).status === 'failed'` 且文本提示为服务端失败（例如 `textResponse` 以“图像生成失败：”开头）
  - 若失败原因缺失：展示兜底文案（如“生成失败（服务返回 failed）”）
- 明确成功：
  - `status === 'succeeded'` 且返回结构中包含可用图片信息（例如 `imageUrl/base64` 之一可被成功解析）
- 非明确失败且无图：
  - `status === 'pending' || status === 'timeout'` 或返回结构缺少图片但也不是 `failed`
  - `status === 'failed'` 但属于“查询失败/非 JSON 返回”等非服务端明确失败的情况
  - 该场景：保留重试按钮，并允许多次重试

### 高层任务拆分（规划者 → 执行者实施顺序）

1. 扩展 `ImageElement` 并接入存储层持久化
  - 修改 `src/types/index.ts`：为 `ImageElement` 增加 `genRetryDisabled?: boolean`。
  - 修改 `src/services/boardsStorage.ts`：在瘦身/还原逻辑中保留该字段。
  - 成功标准：
    - 刷新页面后，“明确失败”卡片仍不展示重试按钮。

2. 调整重试回调：在“明确失败”时写入终态禁用标记
  - 修改 `src/App.tsx`（重试处理函数）：
    - 发起请求前写入：
      - `genStatus='retrying'`
      - `isGenerating=true`
    - 当 `getDrawResultOnce` 返回 `status === 'failed'` 时写入：
      - `genStatus='failed'`
      - `genError=...`（优先服务端 failure_reason；缺失时用兜底文案）
      - `genRetryDisabled=true`
      - `isGenerating=false`
    - 当返回 `pending/timeout/无图无失败` 时写入：
      - `genStatus='pending' | 'timeout'`（与返回对齐）
      - `genRetryDisabled` 保持 `false/undefined`
      - `isGenerating=false`
    - 当返回 `succeeded` 且解析出图片时：
      - 替换占位符为图片并清理 `gen*` 字段
  - 成功标准：
    - “明确失败”后按钮立即消失，仅剩错误信息。

3. 调整 Failure Overlay 展示逻辑：按钮显示条件增加终态判断
  - 修改 `src/components/Canvas.tsx`：将“重新获取”按钮显示条件调整为：
    - `genProvider === 'Grsai' && genTaskId && genRetryDisabled !== true`
  - 成功标准：
    - 非明确失败（pending/timeout/无图无失败）仍可重试；明确失败不再显示按钮。

4. 回归验证与调试信息（必须可定位）
  - 手动用例：
    - 重试返回 failed：按钮不显示，仅显示错误信息。
    - 重试返回 pending/timeout/无图无失败：按钮一直可点击，直到成功出图。
    - 重试最终成功：占位符替换为图片并清理错误/禁用标记。
    - 重试请求进行中：按钮临时不可点击（避免并发），返回后恢复到上述规则。
  - 命令验证：
    - `npm run lint`
    - `npx tsc --noEmit`
  - 日志要求（不含敏感信息）：
    - `[GrsaiTask] retry result { taskId, status, hasImage, hasFailureReason }`

### 项目状态看板（失败提示卡片“重试按钮终止条件”优化）

#### 已完成

- [ ] (空)

#### 进行中

- [ ] 规划者：确认“明确失败”判定标准与兜底文案

#### 待办

- [x] 执行者：新增终态禁用字段并持久化
- [x] 执行者：重试回调写入终态并更新卡片展示
- [x] 执行者：回归验证并补充调试日志

### 执行者反馈或请求帮助（本阶段约定）

- 进度与验证记录：
  - 步骤 1 完成：新增 `genRetryDisabled` 字段并在存储瘦身流程中持久化。
  - 验证：IDE 诊断无新增报错。
  - 步骤 2/3 完成：重试回调按 `status` 写入终态并发控制；失败卡片在 `pending/timeout/failed` 下保持可见，且在 `genRetryDisabled===true` 时隐藏重试按钮。
  - 修复：Canvas 失败浮层重复渲染，已移除 SVG 内重复 overlay，仅保留绝对定位 overlay。
  - 验证：
    - IDE 诊断：无新增报错。
    - `npm run lint`：退出码 0。
    - `npx tsc --noEmit`：退出码 0。
    - `node scripts/test-placeholder.mjs`：`placeholder-size-tests ok 144`。
    - 调试日志：已加入 `[GrsaiTask] retry result { taskId, status, hasImage, hasFailureReason }`（不含敏感信息）。
    - 结构校验脚本（可选）`node scripts/validate-structure.mjs`：当前仓库在 `translations.ts` 与 `components/BoardPanel.tsx` 校验项上失败（与本次改动无关）。

### 当前状态/进度跟踪（失败提示卡片“重试按钮终止条件”优化）

- 规划者：
  - 状态：已完成方案整理，等待进入执行。
- 执行者：
  - 状态：步骤 1-4 已完成，等待规划者确认验收。

---

## 下一阶段：拖拽拦截逻辑收敛（规划中）

### 背景和动机

- 现状：当前存在多层拖拽拦截（全局捕获 + 根容器 capture + Canvas SVG capture + 业务 drop 处理），形式上重复，且全局层强制设置 `dropEffect='copy'` 可能干扰应用内“移动类拖拽”（如图层面板重排）。
- 目标：在不影响现有功能的前提下，收敛“防浏览器默认行为”的拦截点，保留“导入业务逻辑”的单一入口，减少重复与潜在冲突面。

### 关键挑战和分析

- 拖拽事件源的差异：外部（文件/URL）拖入与应用内拖拽（如 LayerPanel reorder）共享同一套 drag 事件，需要精准区分，否则会误把 move 变成 copy，或阻断内部拖拽交互。
- foreignObject 的事件路径差异：Canvas 内部的 HTML 区域（`foreignObject`）可能导致冒泡监听不稳定，捕获阶段全局兜底能覆盖，但也更容易误伤内部拖拽。
- 导入链路依赖：真正的导入解析与落点计算在 `useDragImport`，不能被“只做全局 preventDefault”替代。

### 目标定义（可验收）

- 外部拖入（文件/URL）：
  - 浏览器不发生默认导航/打开文件行为。
  - 拖入画布仍能正常导入图片（保留现有 `useDragImport` 行为与日志）。
- 应用内拖拽（如图层面板重排）：
  - `effectAllowed/move` 等语义不被全局逻辑强制改写为 copy。
  - 不新增不可预期的 `stopPropagation` 导致拖拽失效。
- 代码收敛：
  - “防默认行为”的拦截点收敛到单一位置（优先全局捕获）。
  - “导入业务逻辑”的事件挂载收敛到单一组件层级（优先根容器）。

### 现状梳理（代码位置）

- 全局拦截（捕获阶段）：
  - `src/App.tsx`：`document/window addEventListener('drag*', prevent, { capture: true })`
- 组件 capture 拦截：
  - `src/App.tsx` 根容器：`onDragOverCapture/onDropCapture`
  - `src/components/Canvas.tsx`：`<svg onDragOverCapture/onDropCapture ...>`
- 导入业务逻辑（单一来源）：
  - `src/hooks/useDragImport.ts`：`handleDragOver/handleDrop/handleDragLeave`

### 高层任务拆分（规划者 → 执行者实施顺序）

1. 引入“外部拖入”判定函数并收敛全局拦截的适用范围
  - 修改 `src/App.tsx` 的全局 `prevent`：
    - 仅当判定为“外部拖入”（例如包含 `Files` 或 `text/uri-list`）时才执行 `preventDefault` 与 `dropEffect='copy'`。
    - 对于疑似应用内拖拽：不设置 `dropEffect`，避免破坏 `move`。
  - 成功标准：
    - 外部拖入仍不会触发浏览器默认行为；
    - 图层面板拖拽重排仍为 move 语义且可用。

2. 统一“导入业务逻辑”的事件挂载位置，移除重复 capture 拦截
  - 方案 A（优先）：仅保留根容器的 `onDragEnter/onDragOver/onDragLeave/onDrop`（来自 `useDragImport`）
    - 移除 `Canvas.tsx` `<svg>` 的 `onDragOverCapture/onDropCapture`，并评估是否也移除 `<svg>` 的 `onDragEnter/onDragOver/onDragLeave/onDrop`（避免重复触发与日志噪音）。
    - 保留全局捕获作为兜底，覆盖 `foreignObject` 与不可控区域的默认行为。
  - 成功标准：
    - 导入事件只触发一套逻辑（不重复清理预览、不重复打印 drop 日志）；
    - 不影响 Canvas 内原有鼠标交互（选择/拖拽/缩放）与 `foreignObject` 内按钮交互。

3. 回归验证清单与观测点（必须可定位）
  - 手动用例：
    - 外部拖入本地图片到画布：不导航、能导入、预览元素正常清理。
    - 外部拖入图片 URL：符合现有 `useDragImport` 的 URL 处理逻辑。
    - 图层面板拖拽重排：仍能拖动排序，不出现 copy 光标或无响应。
    - 在 Canvas 的 `foreignObject` 区域拖入/释放：不导航，导入行为一致。
  - 调试信息（不含敏感信息）：
    - 保留 `[GlobalDND]` 日志，但建议仅在“外部拖入”判定为真时输出，避免噪音与误判。
    - 保留 `useDragImport` 的 `[DragImport]` drop/mem/anchor 日志用于定位导入问题。
  - 命令验证：
    - `npm run lint`
    - `npx tsc --noEmit`

### 需要注意与可完善点（避免迁移影响现有功能）

- 全局捕获要避免“一刀切”：
  - 不应对所有 drag 事件都强制 `dropEffect='copy'`，否则会干扰应用内 move/重排。
- 事件冒泡与 stopPropagation 的边界：
  - `useDragImport` 当前会 `stopPropagation()`；收敛挂载位置后要确保不会阻断 LayerPanel 等内部拖拽区域的事件链。
- 逐步迁移策略：
  - 优先做“全局拦截范围收敛”（低风险、可快速验证）。
  - 再做“Canvas 捕获拦截移除/事件挂载收敛”（需要更全面的 UI 回归）。

### 项目状态看板（拖拽拦截逻辑收敛）

#### 已完成

- [x] 规划者：整理收敛目标与迁移方案

#### 进行中

- [ ] 规划者：确认“外部拖入”判定规则
- [ ] 规划者：确认保留/移除的事件挂载点范围

#### 待办

- [ ] 执行者：收敛全局 prevent 到外部拖入
- [ ] 执行者：移除 Canvas SVG capture 拦截
- [ ] 执行者：评估移除 SVG 冒泡拖拽挂载
- [ ] 执行者：回归验证外部拖入与图层重排
- [ ] 执行者：运行 lint 与 typecheck

### 当前状态/进度跟踪（拖拽拦截逻辑收敛）

- 规划者：
  - 状态：方案已补全，等待确认判定规则与迁移边界。
- 执行者：
  - 状态：未开始（等待规划者确认后按任务看板执行）。
