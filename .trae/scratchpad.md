# BananaPod 项目状态记录

## 当前阶段：boardsStorage.ts 精简重构（规划者）

### 背景和动机

- 现状：`src/services/boardsStorage.ts` 已超过 700 行，集中了 IndexedDB/localStorage/Node 文件写入、图片 Blob 入库与哈希、对象 URL 缓存、JSON 序列化 Worker、会话恢复逻辑以及 Perf 统计等多种职责，阅读和演进成本较高。
- 症结：文件内职责边界模糊，通用工具函数与 Board 会话业务强耦合，难以在不触碰核心逻辑的前提下做局部优化，也不利于后续复用（例如图片存储、JSON 大对象序列化）。
- 目标：在保持对外行为与 API 不变（`saveLastSession/loadLastSession/touchLastSessionPending` 等导出函数语义不变）的前提下，将通用能力抽离为独立模块，使 `boardsStorage.ts` 聚焦“Board 会话读写 + 行为配置”，将文件体积控制在 200–300 行级别。
- 范围：仅调整前端/Node 端会话存储相关代码的模块边界与文件结构，不改动 Canvas 交互层、不改历史存储语义、不改历史 v1/v2 行为开关，仅做“等价重构”。

### 关键挑战和分析（本阶段）

- 环境分支复杂：当前同时支持浏览器 IndexedDB、本地 localStorage 以及 Node/Electron 文件系统路径（`BANANAPOD_DATA_DIR`），抽离时需要确保三个环境的行为一致且可观测。
- 图片管线耦合：图片哈希（`sha256`/`fnv1a64`）、`hrefToBlob`、`putImageBlob/getImageBlob` 与 Board 元素结构（`ImageElement.href`）紧密耦合，拆分时容易引入循环依赖或破坏去重策略。
- JSON 序列化 Worker：`stringifyForStorage` 已经承担了性能关键路径的 off-main-thread 逻辑，抽离成通用模块时必须为 Perf 统计保留透传通道。
- Perf 统计与业务状态交织：`perfCounters` 与 `lastSessionPending/IdlePending/Timer` 状态互相关联，简单抽离可能导致调试信息缺失或出现难以理解的日志。
- 回归验证难度：会话保存涉及图片入库、Board 压缩、环境分支，稍有疏忽就会在极端场景（很多图片/切换环境）下出现恢复不完整或性能退化，需要规划清晰的验证步骤。

### 本阶段高层任务拆分

1. 梳理 boardsStorage.ts 现有职责与依赖关系
   - 列出当前文件中所有职责类别（环境判定、JSON Worker、图片存储、对象 URL 缓存、Board slim/inflate、会话保存、Perf 统计）。
   - 标记哪些可抽象为“通用工具/服务”，哪些应保留为“Board 会话业务”。

2. 设计 JSON 序列化工具模块边界
   - 将 `stringifyWorkerUrl/stringifyWorker/stringifyReqId/stringifyPending/canUseStringifyWorker/getStringifyWorker/stringifyForStorage` 抽象为独立模块（如 `src/utils/jsonStorage.ts`）。
   - 明确导出 API（至少包含 `stringifyForStorage`），并支持返回耗时与使用通道（Worker 或主线程）。
   - 在 `boardsStorage.ts` 内改为引用该模块，同时保留 Perf 统计计数逻辑。

3. 设计图片 Blob 存储与哈希模块边界
   - 把与 Board 结构无关的图片存储逻辑抽离到新模块（如 `src/services/imageStore.ts` 或 `src/utils/imageStore.ts`）：
     - `fnv1a64Hex`
     - `getBaseDir/ensureDirs/serverModules` 中与图片文件路径有关的部分
     - `sha256Hex`
     - `hrefToBlob/putImageBlob/getImageBlob`
     - 对象 URL 缓存映射：`imageHashToObjectUrl/objectUrlToImageHash/maxObjectUrlCache/rememberObjectUrl/getKnownImageHashFromObjectUrl/getObjectUrlForImageHash`
   - 设计模块导出 API，使 `boardsStorage.ts` 可以通过少量函数实现图片 slim/inflate，而不用关心具体存储细节。

4. 收敛 Board 会话存储核心逻辑
   - 在拆出 JSON 工具与图片存储模块后，精简 `boardsStorage.ts`：
     - 保留 `slimElement/slimBoardAsync/slimBoardForLocalStorage/inflateElementToDataUrl/pickRecentBoards` 等与 Board 直接相关的函数。
     - 保留 `saveLastSessionToIndexedDB/saveLastSessionToLocalStorage/saveLastSession/loadLastSession` 等对外行为关键函数。
     - 收拢环境判定逻辑，确保结构清晰（浏览器 vs Node/Electron）。

5. 共用与整理辅助工具
   - 统一 Blob → DataURL 实现：复用 `src/utils/fileUtils.ts`，在其中导出 `blobToDataUrl`，并在 `boardsStorage.ts` 与图片存储模块中统一使用。
   - 评估是否可以部分复用 `src/utils/image.ts` 中的 base64/Blob 工具，避免逻辑重复。

6. Perf 统计与日志路径梳理
   - 明确 Perf 计数器与日志结构，保留现有字段并视情况增加“模块来源”标记。
   - 把与 Perf 相关的状态和函数集中放在 `boardsStorage.ts` 顶部或单独区域，减少“业务逻辑中夹杂 Perf 细节”的视觉噪音。
   - 确保新的 JSON/图片模块在需要时可以向 Perf 统计透传关键信息（例如 stringify 耗时、图片 Blob 处理次数）。

7. 回归验证与风险管理
   - 设计一套简化但全面的回归用例：浏览器 + Node/Electron 场景，包含图片导入、Board 多次切换和删除。
   - 对比重构前后的会话恢复正确性、Perf 日志与性能表现，如有差异在本文件记录原因和权衡。

### 项目状态看板（boardsStorage.ts 精简）

#### 已完成

- [x] 明确 boardsStorage.ts 职责过载问题，并给出精简目标与范围（规划者视角）。
- [x] 梳理 boardsStorage.ts 现有职责和依赖图（执行者已完成初步分析）。
- [x] 设计并创建通用 JSON 序列化模块（包含 stringify Worker 实现与 API），并在 boardsStorage.ts 中接入。
- [x] 设计并创建图片 Blob 存储与哈希模块（IndexedDB + Node 文件系统），并在 boardsStorage.ts 中接入（imageStore.ts）。
- [x] 收敛并整理 boardsStorage.ts 内的 Board 会话逻辑（抽离 boardSession.ts，保留 slimElement/inflateElementToDataUrl 等与 Board 直接相关的函数）。
- [x] 共用 blobToDataUrl 等辅助工具，删除重复代码（统一由 imageStore.ts 导出）。
- [x] 初步整理 Perf 统计结构（移除图片专用 Perf 字段，保留会话相关计数与日志）。

#### 进行中

#### 待办
- [ ] 按“回归验证与风险管理”小节执行浏览器与 Node/Electron 场景测试。

### 执行者反馈或请求帮助（本阶段约定）

- 执行者在开始实现前，从“进行中/待办”中选择一个任务，将其拆分为 1–3 个具体操作步骤，并在此处记录。
- 每完成一个任务：
  - 在“项目状态看板（boardsStorage.ts 精简）”中将对应条目标记为已完成。
  - 在本节补充：改动点、验证方式与结果，以及潜在风险。
- 如在拆分过程中遇到“模块边界不清晰”或“某个依赖可能需要重新建模”，在此提出，由规划者补充方案。

### 当前状态/进度跟踪（boardsStorage.ts 精简）

- 规划者：已给出 boardsStorage.ts 精简的高层任务拆分与状态看板，当前阶段主要关注“行为等价前提下的模块边界重组”和“验证”。
- 执行者：已完成对 `src/services/boardsStorage.ts` 的主要职责梳理，并基于此完成多轮等价重构。当前责任分布大致如下：
  - 环境与能力探测：`boardsStorage.ts` 仍负责 `isBrowserEnv/canUseIndexedDB` 等，用于区分浏览器与 Node/Electron 环境，以及可用的存储能力。
  - 性能统计与调试：`boardsStorage.ts` 中的 `isPerfEnabled/schedulePerfLog/perfCounters/perfLast*` 现在主要记录会话保存相关的次数、耗时和后端类型，并在 `BANANAPOD_DEBUG_PERF=1` 时输出 `[Perf][LastSession]` 日志，已移除图片专用计数。
  - JSON 序列化：通用实现已迁移到 `src/utils/jsonStorage.ts`，`boardsStorage.ts` 通过 `stringifyForStorage` 获取 JSON 字符串及耗时信息，并在 Perf 中记录 stringify 路径（Worker/主线程）。
  - 图片哈希与 Blob 存储：通用实现已迁移到 `src/services/imageStore.ts`，负责 `hrefToBlob/putImageBlob/getImageBlob/blobToDataUrl` 以及图片文件/IndexedDB 存储和对象 URL 缓存；`boardsStorage.ts` 只通过 `slimElement/inflateElementToDataUrl` 使用这些能力。
  - Board 会话变换：`src/services/boardSession.ts` 负责 `slimBoardAsync/slimBoardForLocalStorage/pickRecentBoards/inflateBoardsForSession` 等与 Board 结构相关的通用变换；`boardsStorage.ts` 在保存/加载时调用这些函数，并注入图片 slim/inflate 逻辑。
  - 会话保存实现与调度：`boardsStorage.ts` 继续负责 `saveLastSessionToIndexedDB/saveLastSessionToLocalStorage/saveLastSession` 以及 `touchLastSessionPending/saveLastSessionDebounced/scheduleLastSessionSaveInIdle/flushLastSessionSave`，用于在交互过程中对会话保存进行 debounce 与 `requestIdleCallback` 调度，并提供 flush 能力（页面关闭或定时器触发时同步保存）。
  - 会话加载实现：`boardsStorage.ts` 中的 `loadLastSession` 负责从 IndexedDB/localStorage/Node 文件中读取 lastSession 数据，调用 `inflateBoardsForSession` 和图片 inflate 逻辑，并通过 `pickRecentBoards` 再次裁剪到最多 5 个 Board。

> 注：上方“当前文件包含的核心职责包括”段落部分描述的是重构前的状态，已在本节中用新的模块划分进行了更新说明，保留旧描述以便追踪演进过程。

### 验证指引（人工，针对本阶段）

- 浏览器场景：
  - 在当前版本基础上导入多张图片和多个 Board，执行若干编辑操作（创建/删除/重命名 Board，添加图片和图形元素），刷新页面，确认会话恢复结果与操作前一致。
  - 设置 `localStorage.setItem('BANANAPOD_DEBUG_PERF','1')`，做数次编辑/切换/刷新，查看 Console 中 `[Perf][LastSession]` 输出是否仍然存在，字段是否合理。
- Node/Electron 场景（如适用）：
  - 设置 `BANANAPOD_DATA_DIR`，运行应用并生成会话数据，确认该目录下的 `images` 和 `lastSession.json` 正常写入。
  - 修改 Board 后再次退出/启动应用，确认会话恢复与预期一致。

> 已运行 `node scripts/validate-structure.mjs`：boardsStorage.ts 结构检查通过，但缺少 `translations.ts` 与 `components/BoardPanel.tsx` 文件，这两项属于其它模块/阶段的工作范围，暂不在本次重构内处理。

---
