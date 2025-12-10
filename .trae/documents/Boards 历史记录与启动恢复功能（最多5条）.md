## 设计原则
- 不把历史记录/启动恢复的逻辑写入 `App.tsx`。
- 通过独立的 Provider 与启动壳组件在 `index.tsx` 注入；`App.tsx`只消费状态，不承载持久化与弹窗逻辑。

## 结构调整
- 新增 `BoardsProvider`（React Context）：集中管理 `boards`、`activeBoardId` 与操作方法（含现有 `useBoardActions` 功能聚合），并向下游组件提供 Hook。
- 新增 `BoardsStorage`（IndexedDB 服务）：`saveLastSession`/`loadLastSession`/`pushHistoryBoard`/`getHistoryBoards`/`pruneHistory(max=5)`。
- 新增 `StartupGate`（启动壳组件）：在 `index.tsx` 里包裹 `App`，负责加载上次会话、展示启动弹窗并根据用户选择：继续或新建。
- 新增 `SessionRestoreDialog`（弹窗组件）：展示摘要与选择按钮。

## 数据持久化
- IndexedDB 数据模式：
  - `lastSession`: { timestamp, boards, activeBoardId }（用于启动恢复）
  - `history`: [{ id, name, elements, savedAt }]（最多保留5条，仅保存上次活动Board的快照）
- 会话恢复仅恢复当前态（elements、pan、zoom、背景色等），不恢复 Undo/Redo 历史，避免体量过大。

## 行为流程
- 启动时（`StartupGate`）：
  1. 调用 `BoardsStorage.loadLastSession()`；若有会话且当前无用户选择，则展示 `SessionRestoreDialog`。
  2. 选择“继续上次图版”：调用 Provider 方法写入 `boards/activeBoardId`，挂载 `App`。
  3. 选择“打开新图版”：从 `lastSession` 获取活动 Board 快照，`pushHistoryBoard` 后 `pruneHistory(5)`；Provider 创建一个空的新 Board 并挂载 `App`。
- 运行中（Provider）：
  - 监听 `boards/activeBoardId` 变化，防抖保存为 `lastSession`；`beforeunload` 兜底保存。

## `App.tsx` 适配（保持最小改动）
- 从 `BoardsProvider` 获取 `boards/activeBoardId` 与操作方法（替换其内部同名 state 与方法），不在其中编写任何持久化或弹窗代码。
- 其余渲染与工具逻辑不变。

## 验收标准
- 重启后展示启动弹窗；选择继续能恢复上次图版当前态；选择新建时将上次活动 Board 进入历史，历史最多保留 5 条，超出自动清理最旧。
- `App.tsx` 无持久化/弹窗逻辑；所有历史与恢复逻辑在 Provider/StartupGate/Storage 中实现。

## 实施步骤
1. 实现 `BoardsStorage` IndexedDB 服务。
2. 实现 `BoardsProvider`（聚合现有 `useBoardActions` 并对外暴露统一 Hook）。
3. 在 `index.tsx` 将挂载根改为 `StartupGate` 包裹 `BoardsProvider` 与 `App`。
4. 实现 `SessionRestoreDialog` 并接入选择流程。
5. Provider 内实现防抖保存与 `beforeunload` 兜底。
6. 手动验证启动恢复与历史上限逻辑（Electron 与浏览器开发）。