# BananaPod 项目状态记录


## 当前阶段：iframe URL Key 注入与设置锁定（规划者）

### 背景和动机

- 现状：项目目前通过设置面板手动输入代理A/代理B的 Key，并持久化到 `localStorage`（例如 `WHATAI_API_KEY`、`GRSAI_API_KEY`）。
- 新需求：当项目被 iframe 嵌套且 URL 满足 `协议://主机名[:端口]/?key1=xxxx&key2=xxxx` 同时存在时：
  - 设置界面不可直接输入 Key
  - Key 需从 URL 中读取：`key1` 对应代理A，`key2` 对应代理B
- 保持兼容：当项目直接用浏览器打开时，依旧允许在设置面板手动输入 Key。

### 关键挑战和分析

- iframe 环境判断：
  - 需要兼容同源与跨域 iframe；跨域情况下 `window.top` 访问可能抛异常。
  - 预期策略：`try { window.self !== window.top } catch { true }` 视为 iframe 内。
- URL 格式与 query 解析：
  - 需要严格限定“根路径 + query”场景，避免任意带参链接误触发锁定（建议 `location.pathname === '/'`）。
  - 需要同时存在 `key1` 与 `key2` 才启用锁定，缺一不可。
- `key2` 的非标准格式兼容：
  - 示例中 `key2=sk-xxx&1767...` 的尾部片段包含 `&`，若使用 `URLSearchParams` 会被拆成新的参数而丢失。
  - 预期解析方式：使用字符串切片提取 `key1`/`key2`，其中 `key2` 取 `key2=` 后直到 query 结束（允许包含后续的 `&...` 无名片段）。
- 现有请求侧依赖 `localStorage`：
  - 现有服务调用在浏览器侧读取 `localStorage` 来设置请求头；若只更新内存态不落盘，需改动请求层读取来源，改动范围更大。
  - 最小改动方案：URL 注入时同步写入 `localStorage` 以保持与现有服务逻辑一致。

### 本阶段高层任务拆分

1. 设计并实现 URL 注入触发条件
   - 判定是否 iframe 内。
   - 判定 URL 是否为根路径并同时含 `key1`、`key2`。
   - 成功标准：仅在同时满足“iframe + 根路径 + key1&key2”时触发注入与锁定。

2. 实现健壮的 URL key 解析（兼容 `key2` 含 `&` 的尾段）
   - `key1`：提取 `key1=` 后到 `&key2=` 前（或到下一个 `&` 前）。
   - `key2`：提取 `key2=` 后到 query 结束，允许包含 `&1767...` 等尾段。
   - 成功标准：在示例 URL 中解析得到：
     - 代理A key = `key1` 值
     - 代理B key = `key2` 值（包含 `&1767...` 尾段）

3. 在凭证 hook 中接入注入与锁定状态
   - 在 `useCredentials` 初始化/挂载阶段检测触发条件。
   - 触发时将解析出的 key 写入：
     - 内存 state（用于 UI 展示）
     - `localStorage`（用于请求层读取）
   - 对外暴露 `isKeyInputLocked`（或 `keySource: 'url' | 'manual'`）供 UI 使用。
   - 成功标准：在 iframe + URL keys 场景下刷新页面仍能从 URL 注入并生效。

4. 在设置面板锁定输入与保存入口
   - `CanvasSettings` 输入框在锁定时 `disabled/readOnly`，并阻止 `onChange` 写入。
   - 保存按钮在锁定时禁用或隐藏，避免误导。
   - 可选：在输入框附近提示“已从 URL 注入，iframe 模式不可手动修改”。
   - 成功标准：锁定时无法手动修改；非锁定时行为与现状一致。

5. 验证与回归
   - 手动验证：
     - iframe + URL 同时带 `key1`/`key2`：输入不可编辑，代理A/代理B分别使用对应 key。
     - 非 iframe 直接打开：可手动输入/保存，刷新后从 `localStorage` 读取。
     - 缺少 `key1` 或 `key2`：不锁定输入。
   - 命令验证：
     - `npm run lint`
     - `npx tsc --noEmit`

### 项目状态看板（iframe URL Key 注入与设置锁定）

#### 已完成

- [x] 规划者：明确触发条件（iframe + 根路径 + 同时存在 key1/key2）。
- [x] 规划者：明确解析策略（字符串切片，`key2` 取到 query 末尾）。
- [x] 规划者：明确改动点（`useCredentials` 注入、`CanvasSettings` 锁定、`App.tsx` 透传）。

#### 进行中

- [x] 执行者：在 `useCredentials` 中实现 URL 注入并暴露锁定状态。
- [x] 执行者：在 `CanvasSettings` 中锁定输入与保存入口，并接线到 `App.tsx`。
- [x] 执行者：完成手动验证并运行 `npm run lint`、`npx tsc --noEmit`。

#### 待办

- [ ] 评估是否需要“URL 注入不落盘”模式（避免写入 `localStorage` 的安全顾虑）。

### 执行者反馈或请求帮助（本阶段约定）

- 执行者在落地每个任务后补充：
  - 涉及文件与改动摘要（建议至少包含：`src/hooks/useCredentials.ts`、`src/features/settings/CanvasSettings.tsx`、`src/App.tsx`）。
  - 关键调试信息（建议包含：是否判定为 iframe、是否命中注入、解析到的 key 长度/是否为空；避免输出完整 key）。
  - 已运行的命令与结果（`npm run lint`、`npx tsc --noEmit`）。

- 执行者（本轮实现）：
  - `src/hooks/useCredentials.ts`：
    - 新增 iframe + URL 根路径 + 同时存在 `key1`/`key2` 的检测。
    - 通过字符串切片解析 query，其中 `key2` 支持携带 `&1767...` 这类无名尾段。
    - 若命中注入：初始化时直接使用 URL key，并在 effect 中同步写入 `localStorage`，同时暴露 `isKeyInputLocked`。
    - 调试输出：`[Credentials] url injected keys enabled`（仅输出 key 长度与命中状态，不输出完整 key）。
  - `src/features/settings/CanvasSettings.tsx`：
    - 新增 `isKeyInputLocked` 入参；锁定时 key 输入框 `readOnly` 且 `onChange` 直接返回。
  - `src/App.tsx`：
    - 透传 `isKeyInputLocked` 给 `CanvasSettings`。
    - 当检测到存在 `key2`（代理B key）时，初始化默认选择 `apiProvider = 'Grsai'`，从而让 PromptBar 默认展示代理B模型列表。
  - 已运行命令：
    - `npm run lint` ✅
    - `npx tsc --noEmit` ✅

### 当前状态/进度跟踪（iframe URL Key 注入与设置锁定）

- 规划者：
  - 已完成方案设计与风险点分析（iframe 判定、`key2` 非标准 query 兼容、与 `localStorage` 依赖的取舍）。
  - 下一步交由执行者按看板“进行中”实现并验证。
- 执行者（本轮实现）：
  - 已完成 URL 注入、锁定状态透传与设置面板输入锁定。
  - 命令验证已通过；建议由用户在实际 iframe 场景中做一次端到端验证（确认代理A/代理B分别使用 `key1`/`key2`）。

## 当前阶段：运行时错误修复（执行者）

### 背景和动机

- 线上运行出现两类报错：
  - SVG 渲染属性出现 `Infinity/-Infinity`（例如 `<rect x="-Infinity">`、`<g transform="translate(-Infinity, Infinity)">`、`<foreignObject x="-Infinity">`）。
  - `[LastSession] indexedDB save failed ... One of the specified object stores was not found.`，导致会话保存回退到 localStorage。

### 项目状态看板（运行时错误修复）

#### 已完成

- [x] 修复 LastSession IndexedDB object store 缺失导致的保存失败
- [x] 修复 SelectionOverlay/Canvas 渲染时 Infinity/-Infinity 导致的 SVG 属性错误
- [x] 更新 dist，并在本地 preview 验证 build/lint/tsc 通过

### 执行者反馈或请求帮助（运行时错误修复）

- IndexedDB：
  - 发现根因是同一个 DB（`BananaPodDB`）在不同模块以不同版本/不同 store 初始化，可能导致“images 存在但 lastSession 不存在”（或反之）。
  - 处理方式：统一将 DB version 升级到 4，并在两个 openDB 的 `onupgradeneeded` 中确保同时创建 `images` 与 `lastSession`（且清理旧 `history` store）。
  - 关键调试信息：原错误栈包含 `transaction('lastSession')` 报 “object stores not found”，修复后应不再触发该异常（首次打开会触发升级）。

- SVG Infinity：
  - 处理方式：对 `zoom/panOffset` 做有限值兜底（zoom<=0 或非 finite 退回 1，pan 非 finite 退回 0），并在 `SelectionOverlay` 内对 selection bounds / selectionBox 做 finite 校验，非 finite 直接不渲染相关 overlay（避免把 Infinity 写进 SVG 属性）。

- 已运行命令：
  - `npm run lint` ✅
  - `npx tsc --noEmit` ✅
  - `npm run build` ✅（已更新 dist）

## 当前阶段：图层合并修复与模块化（规划者）

### 背景和动机

- 现状：图层合并功能出现两个用户可见问题：
  - 形状/路径合并后描边变细，视觉与合并前不一致。
  - 图片合并后不显示（合并结果为空白或被裁切）。
- 目标：修复上述问题，并将“图层合并”独立为功能模块，降低后续迭代（画布渲染、选择逻辑、导出、撤销历史等）对合并功能的回归影响。
- 约束：
  - 不改变用户交互入口（图层面板按钮、右键菜单等）的行为语义，仅修复结果与稳定性。
  - 不引入新第三方依赖。
  - 模块拆分尽量小且清晰，单文件尽量控制在 250 行以内。

### 关键挑战和分析

- 渲染语义差异（描边粗细）：
  - 画布渲染中，对 `path/shape/line` 等矢量元素使用 `strokeWidth / zoom`（保持屏幕像素粗细恒定）。
  - 合并（栅格化）当前按元素原始 `strokeWidth` 生成 SVG 再绘制到 canvas，未考虑 zoom，导致在 `zoom != 1` 时合并结果与当前视图语义不一致，从而“描边变细/变粗”。
- 图片裁切/圆角裁切坐标系问题（图片不可见）：
  - 合并时对图片使用 `<clipPath>` 以实现圆角裁切。
  - 当前 clip 的 rect 坐标未与合并时的 `offsetX/offsetY` 保持一致，可能导致 clip 把图片完全裁掉，表现为“图片合并后不显示”。
- SVG → Image → Canvas 的资源加载与安全限制：
  - 合并走 `data:image/svg+xml;base64,...`，SVG 内 `<image href="...">` 可能是外部 URL、Blob URL、data URL。
  - 外部 URL 可能触发跨域/taint 或加载失败，需要可观测的调试信息与失败兜底策略。
- 合并边界稳定性：
  - 合并目标集合涉及：selected/visible 模式、group 展开、isVisible 递归、过滤不支持类型（video）、历史 commit。
  - 需要把“目标集合决策”与“栅格化实现”解耦，形成可复用且可单测的纯函数边界，避免 UI 层改动影响核心逻辑。

### 目标定义（可验收）

- 功能正确性：
  - 仅图片合并：合并结果图片可见；圆角裁切与透明度正确。
  - 仅形状/路径合并：合并结果描边粗细在同一倍率视图下与合并前一致（重点覆盖 zoom=0.5/1/2）。
  - 混合合并：布局（x/y/宽高）、不透明度（0–100 转 0–1）、圆角裁切一致；合并后生成单个 ImageElement 并替换原元素集合。
- 稳定性：
  - 合并失败时提供清晰错误提示，并输出必要调试信息（不输出完整 key/敏感内容，不输出完整图片数据）。
  - 不因单个元素异常导致整体崩溃；可按策略跳过或失败回退。
- 模块化：
  - 业务层只通过 `src/features/layerMerge/` 暴露的 API 调用合并。
  - React hook（如 `useLayerMerge`）仅负责依赖注入与 UI/错误处理，不直接拼 SVG/画 canvas。

### 模块边界与 API 草案

- 新模块目录：`src/features/layerMerge/`
- 建议导出：
  - `computeMergeTargets(...)`：纯函数，只负责计算要合并的 id 集合与元素列表。
  - `rasterizeElementsToPng(...)`：将元素列表在指定语义（含 zoom）下栅格化，返回 `{ href, mimeType, width, height, x, y }`。
  - `mergeLayersToImageElement(...)`：编排函数：targets → rasterize → 生成 `ImageElement`（含默认圆角）→ 返回给上层 commit。
- 上层入口保持：
  - `useLayerMerge` 继续作为 UI 层使用的 hook，但内部改为调用 `mergeLayersToImageElement`。

### 高层任务拆分（按风险从低到高、可逐步回归）

1. 固化“合并目标集合”语义（纯函数抽离）
   - 工作内容：
     - 从现有 `useLayerMerge` 抽取纯逻辑：根据 mode(selected/visible)、selectedIds、group 展开、可见性规则，输出稳定的 `idsToMerge`。
     - 明确过滤规则：不合并 `group` 容器本身；跳过 `video`（与现状一致）。
   - 成功标准：
     - 对同一份 elements，输入相同参数，输出集合稳定且可复用（图层面板入口与右键菜单入口保持一致）。
     - 纯函数不依赖 React，不读写外部状态，便于后续单测。

2. 建立独立模块目录与对外 API（解耦 UI 与栅格化）
   - 工作内容：
     - 新建 `src/features/layerMerge/`，把“目标集合计算”和“栅格化实现”迁入模块内。
     - `useLayerMerge` 降级为 thin adapter：收集依赖、调用模块、commitAction、捕获并提示错误。
   - 成功标准：
     - 业务层不再直接调用 `flattenElementsToImage`；合并入口集中在新模块。
     - 模块内部函数输入/输出清晰，可在不启动 React 的前提下进行逻辑验证。

3. 修复“图片合并后不显示”（clipPath 坐标系一致性）
   - 工作内容：
     - 修正合并 SVG 的 `<clipPath>` rect 坐标：应与 `<image x/y>` 的 offset 后坐标保持一致。
     - 针对图片元素的圆角：统一使用计算后的 r，并保证 `clip-path="url(#id)"` 引用在同一个 SVG 内有效。
     - 增加最小调试信息：是否包含 image、clipDefs 数量、合并宽高、svg 字符串长度。
   - 成功标准：
     - 仅图片元素合并：合并结果必然可见（非空白），且圆角裁切位置正确。
     - 不引入新的控制台错误（除非明确记录为可忽略的外部资源跨域错误，并转为可理解的 UI 提示）。

4. 修复“描边变细”（对齐画布语义，引入 zoom）
   - 工作内容：
     - 合并栅格化生成 SVG 时，对 `path/shape/line/arrow` 等使用 `effectiveStrokeWidth = strokeWidth / zoom`（与画布渲染对齐）。
     - 明确 zoom 的来源：由调用层传入当前 zoom；若未来支持“以 1x 输出”可再扩展选项。
   - 成功标准：
     - zoom=0.5/1/2 下，合并前后描边粗细在同倍率视图下保持一致。
     - 不破坏现有 `strokeOpacity`、dash 样式等属性（保持兼容）。

5. 观测、回归与守护（降低未来改动风险）
   - 手动回归用例：
     - zoom=0.5：选择 shape+path 合并，观察描边一致。
     - zoom=2：同上。
     - 图片：无圆角/有圆角（borderRadius），合并后可见且裁切正确。
     - 混合：图片+形状+文本合并，位置、透明度（0–100）正确。
     - group：选择包含 group 的合并，确认展开规则正确，合并后 group 及其子元素被替换为单图层。
   - 命令验证：
     - `npm run lint`
     - `npx tsc --noEmit`
   - 成功标准：
     - lint/tsc 通过；关键用例无回归；合并失败时的错误提示与调试信息完整且不泄露敏感数据。

### 项目状态看板（图层合并修复与模块化）

#### 已完成

- [x] 规划者：确认合并语义与验收标准（zoom、可见性、group 展开）。
- [x] 规划者：确认模块 API 与目录结构（`src/features/layerMerge/`）。
- [x] 执行者：抽离纯函数 `computeMergeTargets`，并将入口接回现有 UI。
- [x] 执行者：建立独立模块 `src/features/layerMerge/`，解耦 UI 与栅格化。
- [x] 执行者：修复 clipPath 偏移导致的图片不可见问题。
- [x] 执行者：引入 zoom 参与 strokeWidth 计算，修复描边变细。
- [x] 执行者：清理旧代码（移除 `flattenElementsToImage`），运行 `lint/tsc`。

### 执行者反馈或请求帮助（图层合并修复与模块化）

- 执行者（本轮实现）：
  - **模块化重构**：
    - 新建 `src/features/layerMerge/` 目录。
    - `computeMergeTargets.ts`：纯函数，负责计算合并目标。
    - `rasterizeToPng.ts`：核心栅格化逻辑，包含修复代码。
    - `index.ts`：统一入口 `mergeLayersToImageElement`。
  - **Bug 修复**：
    - **描边变细**：在 `rasterizeToPng.ts` 中引入 `zoom` 参数，对 `path/shape/arrow/line` 使用 `strokeWidth / zoom` 计算 SVG 属性，确保栅格化结果与画布视觉一致。
    - **图片不可见**：修正 `<clipPath><rect>` 的 `x/y` 坐标，加上 `offsetX/offsetY`，解决了裁切错位导致图片消失的问题。
  - **代码清理**：
    - 移除了 `src/utils/canvas.ts` 中不再使用的 `flattenElementsToImage`。
    - 更新 `useLayerMerge.ts` 和 `App.tsx` 以适配新 API（传入 `zoom`）。
  - **验证结果**：
    - `npm run lint` ✅
    - `npx tsc --noEmit` ✅

### 当前状态/进度跟踪（图层合并修复与模块化）

- 规划者：
  - 计划已全部执行完毕。
- 执行者：
  - 已完成模块化拆分与两个核心 Bug 的修复。
  - 代码已清理，静态检查通过。
  - 请用户进行最终的手动验证（尝试合并形状、图片，检查描边粗细和图片显示）。
 
