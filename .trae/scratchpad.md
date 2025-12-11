# BananaPod 项目状态记录

## UI 设计标准（PodUI v1.x）


### UI 设计标准草案

#### 设计令牌（Design Tokens）

## 背景和动机

- 问题：单张图片拖入画布时偶发触发浏览器默认行为（直接打开/导航），而多图拖入不会出现该问题。
- 目标：在所有来源（本地文件、网页图片、有/无扩展名 URL）与所有落点（画布、SVG 内部 foreignObject 控件区域）下，稳定阻止浏览器默认导航，并正确导入图片到画布。

## 关键挑战和分析

- 浏览器默认行为差异：单文件拖拽更容易被浏览器识别为可导航目标，多文件通常不会触发导航。
- 事件传播与捕获：SVG 内部的 `foreignObject` 承载的原生 HTML（如上下文工具条、文本编辑区、视频控件）可能导致 `dragover/drop` 在冒泡阶段未到达 `<svg>`/根容器，错过 `preventDefault`。
- 全局拦截一致性：目前在 `document/window` 层有捕获拦截，但跨 `foreignObject` 的事件桥接在不同浏览器上存在偶发差异，需要加强本组件捕获阶段拦截。
- 数据来源多样：`dataTransfer.items/files` 与 `text/uri-list/text/plain`；URL 无扩展名但 `Content-Type: image/*` 的场景需兼容。
- 兼容与回归：拖拽预览布局、并发缩略生成、批量导入流程不可回归损坏。

## 成功标准

- 任意单图拖入不触发浏览器导航，均进入导入流程或明确错误提示。
- 支持从网页拖拽的图片 URL（即便无扩展名，只要响应为 `image/*`）。
- 在 `foreignObject` 子区域（上下文工具条、文本编辑、视频控件）落点也能稳定拦截默认行为。
- 多图拖入现有行为保持：预览、去重叠布局、并发预览与导入逻辑不回归。
- 覆盖 Chrome/Edge/Firefox/Safari 的人工验证清单全部通过。

## 高层任务拆分

1. 事件拦截策略强化（捕获阶段）
   - 在画布 `<svg>` 与应用根容器同时添加 `onDragOverCapture`/`onDropCapture`，于捕获阶段统一 `preventDefault`；冒泡阶段继续执行业务导入。
   - 保持 `document` 捕获拦截，评估 `window` 级监听必要性，避免冗余。

2. URL 单图导入兼容性增强
   - `handleDrop` 对 URL 场景：若扩展名不匹配，尝试 `fetch`，以 `Content-Type` 识别 `image/*` 并导入。

3. 调试与观测增强
   - 在关键分支（items/files/uri-list、foreignObject 落点）增加轻量日志，便于定位拦截与导入路径。

4. 验证矩阵与回归检查
   - 人工测试用例：本地单/多文件、网页图片拖拽、有/无扩展名 URL、不同画布子区域落点。
   - 多浏览器覆盖：Chrome/Edge/Firefox/Safari。
   - 回归：多图预览布局、并发缩略图生成与最终导入更新。

5. 经验沉淀
   - 将关键差异与拦截策略写入 `.trae/experience.md`，供后续类似交互参考。

## 项目状态看板


### 已完成
- [x] 统一 BoardPanel 顶部为 `pod-panel-header`（已完成）
-


### 进行中
- [ ] 规划修复方案与任务拆分（当前文档已建立，等待执行者推进）

### 待办

事件拦截策略强化（捕获阶段）：
- [x] 在 Canvas `<svg>` 添加捕获阶段拦截（onDragOverCapture/onDropCapture）
- [x] 在根容器添加捕获阶段拦截（onDragOverCapture/onDropCapture）
- [x] 审查并优化全局拦截（保留 document 捕获，评估 window 监听）

URL 单图导入兼容性增强：
- [x] 扩展 URL 导入：基于 `Content-Type: image/*` 兼容无扩展名链接

调试与观测增强：
- [x] 在 items/files/uri-list 与 foreignObject 落点分支添加调试日志

交互体验优化：
- [x] 禁用拖拽预览占位符渲染，保留导入阶段初始占位符

验证矩阵与回归检查：
- [x] 编写本地文件单图拖拽用例（画布/foreignObject/工具条落点）
- [x] 编写本地文件多图拖拽用例（画布/foreignObject/工具条落点）
- [x] 编写网页图片 URL 用例（有/无扩展名，多落点）
- [ ] 执行多浏览器验证（Chrome/Edge/Firefox/Safari）并记录结果
 - [x] 回归检查：预览布局无重叠且位置计算正确（算法审阅与本地预览验证）
 - [x] 回归检查：并发缩略生成与最终导入更新稳定（并发限制与内存探针日志审阅）

经验沉淀：
- [ ] 将拦截策略与差异记录到 `.trae/experience.md`

## 执行者反馈或请求帮助（占位）

- 由执行者在推进每个子任务时填写阻碍与里程碑，规划者审阅并补充。

### 当前状态/进度跟踪

- 预览服务已启动：`http://localhost:4173/`
- 已完成：Canvas/根容器捕获拦截、URL `image/*` 兼容、调试日志接入、lint/typecheck/build 验证
- 待完成：多浏览器验证、两项回归检查（预览布局与并发缩略/导入稳定性）

### 验证指引（人工）

- 本地文件单图拖拽：画布中心、foreignObject（上下文工具条/文本编辑）、视频控件区域；期望不导航，进入导入
- 本地文件多图拖拽：同上区域；期望出现矩阵预览并全部导入，无重叠
- 网页图片 URL 拖拽：含扩展名与无扩展名（响应 `image/*`），同上区域；期望预览后导入
- 控制台日志观察：
  - 全局：`[GlobalDND] dragover/drop <node>`（src/App.tsx:169）
  - 导入：`[DragImport] dragover/drop/anchor canvas point/url ...`（src/hooks/useDragImport.ts）

### 请求帮助

- 请在 Safari/Firefox/Edge 上按“验证指引”覆盖测试并反馈结果；重点关注：单图在 foreignObject 落点是否仍会默认导航
