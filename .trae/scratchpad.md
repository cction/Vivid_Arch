# BananaPod 项目状态记录

## 新阶段：香蕉按钮工作台界面重设计（规划中）

### 背景和动机

- 现状：香蕉按钮目前仅弹出小型天气预设卡片菜单，承载能力有限，无法将“提示词生成/收集（外部网页）”与“PromptBar 编辑/生成”形成一体化工作流。
- 用户目标（体验）：
  - 点击香蕉按钮后出现一个“尽可能大”的固定尺寸工作台框，左侧为天气预设竖向列表，右侧上方嵌入网页 `https://p.vividai.com.cn/`，右侧下方复用现有 PromptBar（保留全部功能与布局）。
  - 网页内点击“复制”按钮后，提示词自动填入 PromptBar；提示词较多时按现有 PromptBar 展开逻辑向上展开，挤压网页空间，但整体工作台框大小不变化。
  - 保持现有 `src/styles` 与 `src/ui` 的 PodUI 风格一致，不影响其它功能模块。

### 关键挑战和分析

- 跨域 iframe 的交互限制（核心可行性风险）：
  - 应用无法直接读取/监听 iframe 内部 DOM 或按钮点击（同源策略）。
  - 仅依赖剪贴板读取实现“自动填入”在浏览器中通常不可行（权限与用户手势限制），且稳定性差。
- 嵌入限制风险（CSP/X-Frame-Options）：
  - 目标站点可能通过 `frame-ancestors` 或 `X-Frame-Options` 禁止被 iframe 嵌入，导致右上方“网页区域”无法显示。**必须作为前置验证项（Task 0）**。
- PromptBar 状态同步与单一数据源（关键体验）：
  - 工作台内的 PromptBar 与主界面的 PromptBar 必须共享同一份状态（prompt text, attachments）。
  - **防止数据丢失**：用户在工作台输入内容后误触关闭，内容应保留在主界面 PromptBar 中；反之亦然。这要求将 PromptBar 的状态提升（Lift State Up）至 `App.tsx` 或全局 Context。
- PromptBar 展开与布局挤压（体验一致性）：
  - 需要复用现有 PromptBar 的展开/收起与文本框高度控制逻辑，不在工作台中重写，避免回归风险。
  - 工作台整体尺寸固定，但右上 iframe 区域需随 PromptBar 高度动态缩放且不溢出。
- 模块化与不影响现有功能：
  - PromptBar 当前内部持有 `isExpanded` 等 UI 状态；若粗暴外提可能牵涉大量重构。
  - 必须保证不打开工作台时，原 PromptBar 交互、生成、菜单 portal、画布交互不受影响。
- 安全与可控：
  - 外部网页通过消息通信注入提示词属于输入通道，需要严格校验来源与内容长度，避免被其它页面恶意 postMessage 注入。

### 目标定义（可验收）

- 交互与布局：
  - 点击香蕉按钮打开工作台；工作台为固定尺寸的大框（不随 PromptBar 展开改变外框尺寸）。
  - 工作台三分区：
    - 左：天气预设竖向列表（复用 `bananaCards` 数据），**增加顶部微型搜索框**，允许更紧凑以让出网页视野。
    - 右上：iframe 显示 `https://p.vividai.com.cn/`（第一优先级区域）。**增加 iframe 加载中（Loading Skeleton）与加载失败的明确反馈 UI**。
    - 右下：复用现有 PromptBar 的界面与全部功能（长 prompt 时向上展开并挤压 iframe）。
  - 布局比例（网页优先，默认值可调）：
    - 外框尺寸：`width: min(96vw, 1440px)`；`height: min(90vh, 860px)`；保持固定，不随内部内容增高而改变。
    - 左侧预设列：默认 200px；`min 160px / max 240px`；可折叠为 56px（仅图标/缩写），折叠时网页区域获得最大空间。
    - 右侧列：占剩余宽度；内部上下结构：
      - iframe 区域：`flex: 1; min-height: 240px; overflow: hidden`，始终优先保留可视高度。
      - PromptBar 区域：`flex: none`，其自身展开增高时只挤压 iframe，不改变外框尺寸。
- 状态管理与数据安全：
  - **单一数据源**：`App.tsx` 持有 `prompt` 和 `setPrompt`，同时传递给主界面和工作台的 PromptBar。
  - **误操作保护**：关闭工作台（点击遮罩或 ESC）时，不销毁 Prompt 数据，用户可无缝在主界面继续编辑。
- 联动：
  - 点击左侧天气预设：PromptBar 自动填入对应提示词并展开（不自动触发生成）。
  - 网页内复制按钮触发：提示词自动填入 PromptBar 并展开；长文本导致 PromptBar 增高时，挤压右上 iframe 可视区域，但外框尺寸不变。
- 风格一致与快捷键：
  - 工作台容器与分区视觉使用 PodUI 既有样式体系。
  - 支持 **ESC 键关闭工作台**。
- 不影响其它功能：
  - 不打开工作台时，原有 PromptBar/画布/图层/设置/生成流程行为完全一致。

### 方案可靠性论证与风险规避

- 可靠消息通道（推荐方案：站点配合 postMessage）：
  - 需要 `p.vividai.com.cn` 在用户点击“复制”按钮时，同时向父窗口发送消息：
    - `window.parent.postMessage({ type: 'VIVIDAI_PROMPT', prompt: '...' }, '*')`（或指定父域）
  - 应用侧只接受来自 `https://p.vividai.com.cn` 的消息：
    - 校验 `event.origin === 'https://p.vividai.com.cn'`
    - 校验 payload 结构（type/prompt 字段）与长度上限（例如 20k 字符）以及类型为 string
    - 通过统一入口 `setPrompt(prompt)` 写入并触发展开
  - 该方案不依赖剪贴板权限、也不需要跨域 DOM 访问，符合浏览器安全模型，稳定性最高。
- iframe 嵌入可用性预检与降级：
  - 预检：在开发环境先验证 `https://p.vividai.com.cn/` 是否允许 iframe 嵌入（若被阻止则 iframe 区域无法展示）。
  - 降级 A（无需站点配合）：工作台右上区域改为“打开网页”按钮（新标签页），工作台底部提供“从剪贴板粘贴到 PromptBar”按钮（需要用户额外点击一次）。
  - 降级 B（需要较多工程与安全评审）：同域反向代理 + 注入脚本（可能涉及合规与维护成本，不作为首选）。
- PromptBar 展开挤压 iframe 的可靠实现路径：
  - 不重写 PromptBar 的高度/展开算法，仅通过容器布局让其“自然挤压”：
    - 右侧容器 `display:flex; flex-direction:column; height:100%`
    - iframe 容器 `flex:1; min-height:0; overflow:hidden`
    - PromptBar 容器 `flex:none`
  - 触发展开使用最小侵入接口：
    - 通过新增 `expandRequestKey`（递增数字）或 `requestExpand()` 回调，让 PromptBar 内部 `useEffect` 触发 `setIsExpanded(true)`，避免将 `isExpanded` 全量外提造成大范围改动。
- 网页优先的布局稳定性与响应式规避：
  - 左侧预设列采用“紧凑+可折叠”策略，确保在 1366 宽度及以下仍可给 iframe 保留足够宽度。
  - iframe 容器设置 `min-height` 与 `min-width`，避免 PromptBar 展开导致网页区过小不可用；必要时在极窄窗口下自动切换为“折叠左侧预设列”。
  - 预设列表项由“卡牌”调整为“紧凑 list item”（缩略图/图标 + 名称），降低单项高度，减少滚动占用，提高网页区域可视占比。
- 安全边界：
  - 严格 origin 校验：只接受 `https://p.vividai.com.cn`。
  - 只写入 prompt 文本，不执行任何脚本，不解析 HTML。
  - 记录调试信息但不包含敏感数据（不记录用户密钥/令牌，不打出完整 prompt，必要时只记录长度与摘要）。

### 高层任务拆分（规划者 → 执行者实施顺序）

0. **前置验证（Task 0）** [已完成]
   - 验证 `https://p.vividai.com.cn/` 的 iframe 嵌入可行性（X-Frame-Options/CSP）。
   - **结果**：验证通过。响应头包含 `Content-Security-Policy: frame-ancestors *`，允许任意来源嵌入。无 `X-Frame-Options` 限制。

1. 新增工作台 Dialog 与布局骨架（不接 iframe 通信）
   - 新增 `BananaWorkspaceDialog`（三分区布局 + 固定尺寸 + 关闭逻辑 + **ESC 支持**）。
   - 左侧天气列表：**实现搜索框**，复用数据，支持折叠。
   - 右上 iframe 区域：**实现 Loading 状态与加载失败 UI**。
   - 右下 PromptBar 占位。
   - 成功标准：UI 骨架完整，响应式行为（折叠/展开）符合预期。

2. 连接香蕉按钮触发与 App 状态（**状态提升重构**）
   - 在 `App.tsx` 引入 `isBananaWorkspaceOpen` 状态。
   - **关键**：将 PromptBar 的 `prompt` 状态提升至 `App.tsx`，确保主界面与工作台共享同一份数据（避免关闭丢失）。
   - 成功标准：在工作台输入内容，关闭后主界面 PromptBar 保留内容。

3. 实现“天气预设 → PromptBar”联动与展开请求
   - 点击左侧列表项后：`setPrompt(value)` 并触发展开。
   - 成功标准：点击预设，PromptBar 立即展示完整文本并进入展开态。

4. iframe 嵌入与消息桥（postMessage）
   - 右上区域嵌入 iframe：默认指向 `https://p.vividai.com.cn/`。
   - 应用侧监听 `message`，完成 origin + payload 校验后写入 PromptBar。
   - 成功标准：站点发送 `VIVIDAI_PROMPT` 后，PromptBar 自动填入并展开。

5. 降级策略与空状态体验
   - 若 iframe 被阻止或长时间加载失败：展示“打开网页/复制粘贴”降级 UI。
   - 成功标准：即使无法 iframe 嵌入，用户仍可完成提示词导入到 PromptBar 的主流程。

6. 回归验证与性能边界
   - 手动验证：不打开工作台时所有功能不变；打开时 iframe 挤压与 PromptBar 展开行为符合预期。
   - 验证：快捷键是否冲突，Tab 键焦点循环是否正常。
   - 命令验证：`npm run lint`, `npx tsc --noEmit`。
   - 调试信息要求：`[VividAI] message { origin, type, promptLength }`。

### 项目状态看板（香蕉按钮工作台界面重设计）

#### 已完成

- [x] 规划者：确认 postMessage 方案与 iframe 可嵌入性
- [x] 执行者：新增工作台 Dialog 三分区布局骨架 (Task 1)
- [x] 执行者：连接 App 状态与香蕉按钮触发入口（Task 2）
- [x] 执行者：实现预设列表与 PromptBar 联动展开（Task 3）
- [x] 执行者：实现 iframe 与 postMessage 安全消息桥 (Task 4)
- [x] 执行者：实现 iframe 不可用时的降级交互 (Task 5)
- [x] 执行者：回归验证并运行 lint/typecheck (Task 6)
- [x] 规划者：项目验收

#### 进行中

#### 待办

### 当前状态/进度跟踪（香蕉按钮工作台界面重设计）

- 规划者：
  - 状态：所有任务已完成。项目验收通过。
  - 下一步：无。项目结束。
- 执行者：
  - 状态：所有代码已提交并验证通过（lint/tsc Clean）。
  - 下一步：建议用户进行最终手动测试。
