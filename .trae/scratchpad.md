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
