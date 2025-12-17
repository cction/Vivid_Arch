# BananaPod｜图像生成与编辑工作台（v1.1.9）

轻量、可扩展的图像生成与编辑工作台，采用 PodUI 主题。统一第三方 API 为 OpenAI 风格接口（基于 `whatai.cc`），支持图层系统、裁剪与合并、双语界面、iPad/Apple Pencil 场景。

## 核心更新（v1.1.9）
- 变更：取消“历史图版/历史记录”设置，仅持久化最近更新的 5 个图版的最新状态
- 性能：保存改为“防抖 + 空闲落盘”，降低绘制/拖拽/缩放时的卡顿风险
- 兼容：部署环境 IndexedDB 不可用时自动降级到 `localStorage`，避免会话无法保存
- 修复：WebCrypto 不可用时哈希计算降级，避免 `crypto.subtle.digest` 为 `undefined` 导致保存失败
- 验证：通过 `npm run lint`、`npx tsc --noEmit`、`npm run build`

## 核心更新（v1.1.8）
- 修复：单图拖入画布可能直接在浏览器打开的问题；在捕获阶段拦截 `dragover/drop` 并统一阻止默认行为，确保导入流程
- 兼容：扩展 URL 导入，基于 `Content-Type: image/*` 自动识别无扩展名图片链接
- 体验：禁用拖拽预览占位符渲染，保留导入阶段初始占位符
- 调试：在 `items/files/uri-list` 与 `foreignObject` 落点分支增加调试日志
- 验证：通过 `npm run lint` 与 `npm run build`；预览交互与导入流程回归正常

## 核心更新（v1.1.7）
- 香蕉按钮迭代为“仅 Logo + 轻交互”的极简扁平风格，点击热区保持 `40×40`
- 去除背景与装饰层，悬停轻微放大并提亮，按下轻微缩小
- `BananaSidebar.tsx` 直接渲染 `BananaIcon`；`podui.css` 简化交互样式（透明背景、轻交互）
- 文档与版本号统一到 `v1.1.7`

## 核心更新（v1.0.2.1）
- 容器编排优化：`src/App.tsx` 仅注入依赖，交互/选择/裁剪/合并等逻辑下沉到 Hooks 与组件
- 模块化重构完成：抽取并接入 `useCanvasInteraction/useSelection/useBoardActions/useBoardManager/useClipboard/useKeyboardShortcuts/useLayerMerge/useCrop/useTextEditing/useContextMenuActions/useDragImport/useGenerationPipeline/useUserEffects/useI18n/useCredentials/useCanvasCoords/useElementOps`
- 统一 `t` 返回类型为 `string`，移除类型断言，国际化接线更稳定
- 清理重复与废弃：移除重复 `LayerPanel` 与旧版 `useI18n`，统一路径到 `src/*`

## 模型与接口
- 生图（Generations）：`nano-banana`、`nano-banana-hd`、`nano-banana-2`
  - 路径：`POST /v1/images/generations`
  - 返回：`{ data: [{ url }] }`
- 编辑（Edits）：`nano-banana`、`nano-banana-2`
  - 路径：`POST /v1/images/edits`
  - NB2 专属：`image_size`（`1K` | `2K` | `4K`），输入图自动裁剪为最近枚举比例
- 兼容：`gemini-3-pro-image-preview` 走 `generateContent` 接口，统一解析图片输出

## 枚举比例
- 支持：`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9`
- 当模型为 `nano-banana-2` 且输入图不在枚举内时，自动裁剪为最近枚举，避免服务端报错

## 快速开始
- 环境：Node.js 18+（建议 LTS）
- 安装：`npm install`
- 启动：`npm run dev`，访问 `http://localhost:3001/`
- 预览构建：`npm run preview`（默认尝试 `4173`，占用时自动递增）
- API 密钥：在应用内“设置”面板填写后保存（保存在 `localStorage('WHATAI_API_KEY')`）

## 常用命令
- 开发：`npm run dev`
- 构建：`npm run build`
- 预览：`npm run preview`
- Lint：`npm run lint`
- 类型检查：`npx tsc --noEmit`
- Electron 构建：`npm run build:electron`、`npm run dist:win`
- 测试生图与编辑：`npm run test:banana`
  - 环境变量运行：`$env:WHATAI_API_KEY='<你的key>'; npm run test:banana`
  - 输出包含 `url/mime/size` 与下载校验结果

## 开发与代理
- 代理：开发模式下通过 Vite 代理到 `WHATAI_BASE_URL`（默认 `https://api.whatai.cc`）
- 头信息：若请求未带 `Authorization`，代理自动附加 `Bearer <WHATAI_API_KEY>`
- 端口：`3001`（Local/Network 多地址，支持局域网调试）

## 环境变量（可选）
- `WHATAI_API_KEY`：接口令牌（优先使用设置面板）
- `WHATAI_BASE_URL`：默认 `https://api.whatai.cc`
- `WHATAI_IMAGE_MODEL`/`WHATAI_IMAGE_GENERATION_MODEL`/`WHATAI_IMAGE_EDIT_MODEL`：默认 `gemini-2.5-flash-image`
- `PROXY_VIA_VITE`：默认 `true`（Electron 构建时可设为 `false`）

## 使用说明
- 生图（图片模式）：输入提示词，选择模型与比例。NB2 支持 `image_size`（`1K/2K/4K`）。
- 编辑（选择元素后）：对选中元素进行组合或遮罩重绘。NB2 自动裁剪输入图到最近枚举比例。
- 图层：支持选择、合并、栅格化、分组与对齐等操作。

## 目录结构（简）
```
BananaPod/
├── src/
│  ├── App.tsx                 # 容器编排（仅依赖注入与组合）
│  ├── components/             # 画布相关组件（Canvas/SelectionOverlay/ContextMenuOverlay 等）
│  ├── features/               # 业务功能（toolbar/prompt/settings/boards 等）
│  ├── hooks/                  # 交互/选择/裁剪/合并/生成等逻辑 Hooks
│  ├── ui/                     # 通用 UI 组件（Panel/IconButton/Loader 等）
│  ├── services/               # API 与存储（api/geminiService、boardsStorage）
│  ├── utils/                  # 工具函数（canvas/fileUtils/image/retry）
│  ├── i18n/                   # 语言与文案（translations）
│  ├── styles/                 # 样式（tailwind.css/podui.css）
│  └── types/                  # 类型定义
├── public/api调用方式/        # 接口对接说明（OpenAI 风格）
├── vite.config.ts             # 开发代理与别名配置
├── index.tsx                  # 应用入口（挂载 App）
└── README.md
```

## 安全与合规
- 请勿提交 `.env*`、令牌等敏感信息（已在 `.gitignore` 忽略）
- 应用内密钥保存在 `localStorage`，不会在日志中打印；仅在请求头附加

## 版本与发布
- 当前版本：`1.1.9`
- 关键变更：
  - 取消“历史图版/历史记录”，仅保存最近更新的 5 个图版的最新状态
  - 保存流程改为防抖+空闲落盘，降低主线程阻塞
  - IndexedDB 不可用时降级 `localStorage` 保存会话
  - WebCrypto 不可用时哈希计算降级，避免保存报错
  - 同步 `README.md`、`CHANGELOG.md`、`metadata.json` 与 `package.json` 到 `v1.1.9`

## 致谢
- 模型：`nano-banana` 系列、`gemini-3-pro-image-preview`
- 平台与文档：`whatai.cc`（OpenAI 风格统一接口）
