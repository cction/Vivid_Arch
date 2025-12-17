# BananaPod 项目状态记录

## UI 设计标准（PodUI v1.x）

### UI 设计标准草案

#### 设计令牌（Design Tokens）

## 背景和动机

- 现状：代理 A/代理 B 在接入层可选模型数量偏多，PromptBar 展示名称与实际接入模型名耦合，维护与沟通成本高。
- 目标：收敛每个代理在接入层的模型数量，同时仅调整 PromptBar 展示名称（后台接入模型名称不变），避免影响后端路由与计费/权限等逻辑。

## 关键挑战和分析

- “后台接入模型名称不更改”约束：需要区分“展示名（UI label）”与“真实模型 id（backend/model key）”，避免重命名导致请求参数变化。
- 配置来源不唯一风险：模型列表可能同时存在于前端常量、后端配置、环境变量、远端配置或 feature flag 中，需先梳理“单一事实来源”。
- 兼容性：若历史会话/本地存储记录了旧的展示名或旧配置结构，需要保证升级后仍能映射到正确的 backend 模型 id。
- 可观测性：需要能在调试信息中明确看到“用户选择的展示名”与“实际发起请求的模型 id”。

## 成功标准

- 代理 A：接入层仅保留 `nano-banana`、`nano-banana-2` 两个模型可选；PromptBar 展示分别为 `Standard_A`、`Professional_A`；请求仍使用原模型名。
- 代理 B：接入层仅保留 `nano-banana`、`nano-banana-pro` 两个模型可选；PromptBar 展示分别为 `Standard_B`、`Professional_B`；请求仍使用原模型名。
- 回归：切换代理/切换模型/发起对话不报错；请求 payload/日志中模型 id 与后台保持一致；不存在“选择项显示正确但请求模型错误”的情况。

## 高层任务拆分

1. 梳理接入模型定义位置与数据流
   - 找到代理 A/代理 B 的模型列表来源（前端 PromptBar、后端路由、默认配置、存储恢复）。
   - 明确“展示名字段”与“真实模型字段”的结构与传递路径。

2. 收敛代理 A/代理 B 的模型列表
   - 代理 A：仅保留 `nano-banana`、`nano-banana-2`。
   - 代理 B：仅保留 `nano-banana`、`nano-banana-pro`。

3. 调整 PromptBar 展示名称映射（不改后台模型名）
   - PromptBar 中将 `nano-banana` 显示为 `Standard_A`（代理 A）与 `Standard_B`（代理 B）。
   - PromptBar 中将 `nano-banana-2` 显示为 `Professional_A`（代理 A）。
   - PromptBar 中将 `nano-banana-pro` 显示为 `Professional_B`（代理 B）。
   - 确保提交请求时仍使用 backend 模型名（原始模型 id）。

4. 兼容与迁移（如有存储）
   - 若本地存储/会话中持久化了“展示名”，增加映射回退到真实模型 id。
   - 若仅持久化“真实模型 id”，确保新展示名不影响读取。

5. 验证与回归
   - 覆盖：代理切换、模型切换、刷新恢复、历史会话恢复（如存在）、错误兜底路径。
   - 记录：在调试输出中打印展示名与真实模型 id（不输出任何敏感信息）。

## 项目状态看板

### 已完成
- [x] 梳理代理 A/B 模型配置来源与引用点
- [x] 收敛代理 A 模型为 `nano-banana`/`nano-banana-2`
- [x] 收敛代理 B 模型为 `nano-banana`/`nano-banana-pro`
- [x] PromptBar 显示名映射为 `Standard_*`/`Professional_*`
- [x] 补齐存储兼容回退与回归验证

### 进行中
- [x] 更新版本为 v1.2.0 并补齐中文变更记录
- [x] 构建并打包 dist 产物
- [ ] 提交并推送 git tag v1.2.0

### 待办
- [ ] 无

## 回滚方案

- 配置回滚：恢复原代理 A/B 模型列表与 PromptBar 映射配置即可。
- 兼容回滚：保留旧展示名映射分支以支持旧会话/存储读取。
- 发布回滚：构建产物回退到上一版本，确保请求模型 id 未变更。

## 执行者反馈或请求帮助（占位）

- 执行者每完成一个待办项，更新“项目状态看板”的勾选状态，并记录：改动点、验证结果、潜在风险。

### 当前状态/进度跟踪

- 已完成：代理 A/代理 B 模型选项收敛与 PromptBar 展示名映射（后台模型 id 不变），并增加对旧存储模型值的回退归一化。
- 已完成：同步版本号到 `v1.2.0`，补齐中文变更记录；并验证 `npm run lint`、`npx tsc --noEmit`、`npm run build` 通过。
- 进行中：构建并打包 `dist`，随后提交并推送 `v1.2.0` 标签。

### 验证指引（人工）

- 代理 A：模型下拉仅有 2 项，显示 `Standard_A`/`Professional_A`，实际请求模型分别为 `nano-banana`/`nano-banana-2`。
- 代理 B：模型下拉仅有 2 项，显示 `Standard_B`/`Professional_B`，实际请求模型分别为 `nano-banana`/`nano-banana-pro`。

### 请求帮助

- 若模型列表由远端配置/环境变量注入且不可静态收敛，需要提供配置入口位置与发布流程说明，以便规划迁移与灰度策略。
