# BananaPod 项目状态记录

## UI 设计标准（PodUI v1.x）


### UI 设计标准草案

#### 设计令牌（Design Tokens）

## 项目状态看板


### 已完成
- [x] 统一 BoardPanel 顶部为 `pod-panel-header`（已完成）
- [x] 清理 `ContextMenuOverlay.tsx` 内联样式（已完成）
- [x] 在 `podui.css` 补全 `.pod-context-menu` 与 overlay 工具类（已完成）
- [x] 修复 `.pod-primary-button` 样式断裂（已完成）
- [x] 扩展 Toolbar 与主面板的断点适配（已完成）
- [x] 创建 UI 预览页（已完成）
- [x] 添加 PromptBar 样式到标准库（已完成）
- [x] 修复 UI Preview 白屏问题（已完成）
- [x] 限定动效边界（已完成）
- [x] 调大背景网格（已完成）
- [x] 移除按钮加粗（已完成）
- [x] 画布背景颜色设置（已完成）
- [x] 统一 PromptBar 底色（已完成）
- [x] 更新默认画布背景色为 `#0F0D13`（已完成）
- [x] 菜单去透明度（已完成）
- [x] 修复网格渲染兼容性（已完成）
- [x] 更新 grid 令牌并同步 `Canvas.tsx`（已完成）
- [x] 添加 `.pod-prompt-*` 到样式库（已完成）
- [x] 在 UI 预览页展示 PromptBar（已完成）
- [x] 全局组件样式更新为 Prompt Bar 风格（已完成）
- [x] 移除 PromptBar `overflow-hidden` 裁剪（已完成）
- [x] 保存自定义效果按钮与快捷效果并列（已完成）
- [x] 菜单使用不透明背景（`pod-bg-solid`）（已完成）
- [x] 胶囊状态香蕉按钮点击弹出菜单（已完成）
- [x] PromptBar 展开动画优化（第一版）（已完成）
- [x] PromptBar 展开动画二次优化（已完成）
- [x] QuickPrompts 与 BananaSidebar 添加 `pod-bg-solid`（已完成）
- [x] 香蕉按钮添加点击反馈与状态高亮（已完成）
- [x] 快捷菜单与香蕉菜单使用 Portal 渲染（已完成）
- [x] 视觉修正：稳定展开高度与宽度（已完成）
- [x] Toolbar 子菜单通过 Portal 解除遮挡（已完成）
- [x] 调整菜单与 Toolbar 间距（已完成）
- [x] 在 BoardPanel 与 HistoryList 之间加入 `pod-separator`（已完成）
- [x] 移除 HistoryList 冗余间距（已完成）
- [x] PromptBar 内联样式清理（willChange/contain/isolation）（已完成）
- [x] 清理 `BananaSidebar.tsx` 内联样式（已完成）
- [x] 清理 `SelectionOverlay.tsx` 内联样式（已完成）
- [x] 清理 `Canvas.tsx` 内联样式并使用变量（已完成）
- [x] 在 `PodUIPreview.tsx` 添加滚动条与 Chip 测试用例（已完成）
- [x] 最小化 PromptBar/QuickPrompts 内联样式（已完成）
- [x] 归一化设计令牌命名与分层（已完成）
    - [x] 重构 `podui.css` 变量为 Primitive/Semantic 分层
    - [x] 处理 `--brand-yellow` 命名问题（创建 `--brand-primary` 别名）
    - [x] 替换 `podui.css` 中的硬编码颜色
    - [x] 替换 `App.tsx` 中的硬编码颜色 (保留 Hex 以兼容 Canvas API)
    - [x] 替换 `PromptBar.tsx`、`QuickPrompts.tsx` 中的硬编码颜色
    - [x] 验证全局样式一致性（PodPanel, Preview, Sidebar 均已对齐）
- [x] 验收 Selection Overlay 定位与尺寸（已完成）
    - [x] 添加 `--color-blue-500` 到 `podui.css`
    - [x] `SelectionOverlay.tsx` 颜色硬编码替换为 Token
    - [x] 验证 `ContextToolbar` 尺寸计算逻辑
- [x] 发布 v1.1.4（已完成）
    - [x] 提交所有未提交的更改
    - [x] 创建标签 v1.1.4
    - [x] 推送更改和标签

- [x] 引入并并行接入 Grsai_API（已完成）
    - [x] 新增 `src/services/api/grsaiService.ts` 并实现生成与编辑
    - [x] 更新 `vite.config.ts` 增加 `proxy-grsai` 与环境变量
    - [x] 添加 `scripts/test-grsai.mjs` 用于接口验证

### 进行中
- [ ] (无当前任务，等待下一步指示)

### 待办
> 总计：43 项（已完成 43，进行中 0，待办 0）
