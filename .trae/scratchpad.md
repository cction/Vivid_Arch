# 🍌 BananaPod 项目工作区 (Scratchpad)

## 🎯 当前焦点：工作区标题栏与折叠模式 (Compact Mode)

### 1. 背景与动机
用户希望增强工作区的空间管理能力，引入“标题栏”与“折叠模式”。在折叠模式下，工作区高度收缩，隐藏网页内容，仅保留 PromptBar 和紧凑的预设选择区（Sidebar），以便在不遮挡背景的情况下进行创作。

### 2. 交互逻辑详细设计（规划者方案）

#### A. 标题栏 (Title Bar)
- **位置**: 位于工作区顶部，左侧栏搜索框的右侧（即覆盖主内容区域顶部）。
- **内容**: 
  - 标题文本: "Prompt Lab"（与嵌入网页标题一致）。
  - 样式: 保持与嵌入网页标题一致的视觉风格。
  - 控件: 收缩/展开箭头按钮（Chevron Up/Down）。
  - **改进点 (+)**: 将全局关闭按钮 (`XIcon`) 整合至标题栏最右侧，确保视觉统一，避免悬浮按钮遮挡内容。
- **一致性策略（避免回归）**:
  - 标题文本来源必须是“单一真实来源”，避免出现 Header、iframe `title`、页面标题不一致的分叉。
  - 优先方案：在工作区组件内定义 `WORKSPACE_WEB_TITLE` 常量，同时用于 Header 与 iframe `title`。
  - 备选方案：在 iframe 成功加载后读取 `document.title`（仅当同源可访问），否则回退到常量。
- **交互**: 点击箭头按钮切换 `isCompactMode`。
- **键盘可用性**:
  - 按钮需具备 `aria-label` 与 `aria-expanded`，且可被 Tab 聚焦与回车触发，避免仅鼠标可用。

#### B. 折叠模式 (Compact Mode) 行为
| 属性 | 展开状态 (Normal) | 折叠状态 (Compact) | 备注 |
| :--- | :--- | :--- | :--- |
| **工作区高度** | `min(90vh, 860px)` | 自适应 (约 400px) | **改进点 (+)**: 采用 `min-height` 或 `auto`，确保 PromptBar 输入多行文本变高时，整体容器能向上生长，不出现内部滚动条截断输入框。 |
| **Iframe (网页)** | 显示 | **隐藏** (保留 DOM) | **改进点 (+)**: 使用 `height: 0; opacity: 0; pointer-events: none;` 而非 `display: none`，防止 Iframe 重新加载导致状态/上下文丢失。 |
| **左侧栏布局** | 垂直列表 (图+文) | **网格布局** (仅图片) | "内部卡片预设仅显示图片按钮，三个一排布置"。 |
| **左侧栏交互** | 可水平折叠 | **强制展开且锁定** | **改进点 (+)**: 进入 Compact Mode 时强制 `setIsSidebarCollapsed(false)` 并隐藏水平折叠按钮，避免"既垂直折叠又水平折叠"导致预设区不可用的死角状态。 |
| **左侧栏宽度** | 220px (或 64px) | 固定 220px | 配合网格布局。 |
| **PromptBar** | 显示 | 显示 | 核心功能保留。 |
| **状态记忆** | - | - | **改进点 (+)**: 将 `isCompact` 状态写入 localStorage，保持用户偏好。 |
| **焦点保持** | - | - | **改进点 (+)**: 点击 Header 的折叠按钮不应打断输入；切换后应把焦点还给 PromptBar 的 textarea（必要时用 `requestAnimationFrame`）。 |
| **ESC 关闭** | 生效 | 生效 | **改进点 (+)**: Compact 模式下仍需能 ESC 关闭；且切换 Compact 不应移除 ESC 监听。 |
| **搜索框状态** | 当前实现为打开时清空 | 当前实现为打开时清空 | **改进点 (+)**: 切换 Compact 不应清空搜索词；仅在 `open` 从 false->true 时重置。 |
| **网页消息同步** | postMessage 同步 prompt | 保持同步 | **改进点 (+)**: Compact 仅隐藏 iframe，不禁用 message 监听；避免“网页复制 prompt 失效”。 |

#### C. 视觉动效
- 使用 `framer-motion` 实现高度平滑过渡。
- 侧边栏列表项从 "Row (Img+Text)" 到 "Grid Cell (Img)" 的平滑切换。
- **改进点 (+)**: 确保 PromptBar 在布局切换时位置稳定（锚定底部），避免跳动。
- **动效安全边界（避免影响使用）**:
  - 动画不得改变外层遮罩的点击关闭逻辑（点击遮罩关闭、点击容器不关闭）。
  - 动画不得引入“隐藏但可点击”的区域：Compact 时 iframe 必须 `pointer-events: none`。
  - 动画不得造成滚动条闪烁：优先只对高度/透明度做过渡，避免频繁重排。

### 3. 执行计划 (Task Breakdown)

#### 阶段 1: 结构重组与标题栏 (BananaWorkspaceDialog.tsx)
- [ ] **组件重构**:
    - 将 `XIcon` 关闭按钮移入新的 `WorkspaceHeader` 区域。
    - 在 Right Content 顶部插入 `WorkspaceHeader`。
- [ ] **状态管理增强**:
    - `isCompact`: 增加 localStorage 持久化。
    - 联动逻辑: `useEffect` 监听 `isCompact`，若为 true 则 `setIsSidebarCollapsed(false)`。
    - **回归边界**: `open` 变化时的 reset effect 仅在打开时触发，不被 Compact toggle 误触发。

#### 阶段 2: 侧边栏适配 (Sidebar Adaptation)
- [ ] **侧边栏样式响应**:
    - 根据 `isCompact` 切换 Class。
    - Normal: `flex-col space-y-1`。
    - Compact: `grid grid-cols-3 gap-2 auto-rows-min content-start` (确保图片紧凑排列)。
- [ ] **水平折叠互斥**:
    - 在 `isCompact` 模式下隐藏 Sidebar 底部的水平折叠按钮。
- [ ] **点击命中区**:
    - Compact 网格中每个图片按钮必须具备最小可点击尺寸（建议 ≥ 36px），避免误触。

#### 阶段 3: 布局与动效 (Layout & Animation)
- [ ] **Iframe 隐身术**:
    - 实现 `height: 0` 动画，同时保持 DOM 存活。
- [ ] **容器自适应**:
    - Compact 模式下容器高度设为 `auto` (或根据内容计算)，但需限制最大高度避免遮挡屏幕太多。
- [ ] **性能与稳定性**:
    - 防止在动画/resize 中重复 setState 导致抖动；必要时节流到 rAF。

### 4. 项目状态看板
- [x] 已完成：结构重组与标题栏 (含关闭按钮整合)
- [x] 已完成：侧边栏网格适配 (含状态互斥)
- [x] 已完成：Iframe 无损隐藏与动效 (高度自适应/底部固定)
- [x] 已完成：收起模式下宽度调整与画布编辑支持
- [ ] 待验证：回归用例检查与防影响验收

### 5. 防影响验收清单（待用户验证） 
- [ ] 进入工作区后：ESC 关闭正常，点击遮罩关闭正常，点击容器不关闭。
- [ ] 切换 Compact：PromptBar 输入焦点不丢失（或自动回焦），输入文本不被截断。
- [ ] Compact 下：左侧预设为 3 列网格，仅显示图片按钮，可点击切换预设。
- [ ] Compact 下：网页区域不可点击且不抢焦点；返回 Normal 后网页仍保持加载状态（不刷新）。
- [ ] 网页端复制/同步 prompt：Normal 与 Compact 均可触发 prompt 同步（message listener 不失效）。
- [ ] 搜索框：仅在打开工作区时清空；切换 Compact 不清空，不重置滚动位置。
- [ ] **新增验证**：Compact 模式下工作区底部固定，高度随 PromptBar/侧边栏内容自适应。

---

