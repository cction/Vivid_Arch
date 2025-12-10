## v0.1.0 (2025-11-04)

- feat(layer-panel): 新增“合并图层为图片”按钮与回调，支持将选中或可见图层栅格化为单个图片元素，并写入历史以支持撤销/重做
- fix(rasterization): 移除 `flattenElementsToImage` 对组件内部 `elementsRef` 的依赖，修复 `ReferenceError: elementsRef is not defined`
- chore(version): 将 `package.json` 版本从 `0.0.0` 升级到 `0.1.0`

验证说明：
- 在画布添加若干非视频元素，打开图层面板，选择图层点击“合并图层”按钮
- 预期：原图层移除，生成一个新的 `ImageElement`（Merged Image），支持撤销/重做
- 注意：组会自动展开参与合并；视频元素不参与合并
## v0.2.0 (2025-11-05)

- feat(image-edit): 输入图任意边超过 `2048` 时，自动按原图比例缩小至不超过 `2048×2048`，不放大、不裁剪
- feat(mask-scale): 同步缩放遮罩，确保与缩放后的基图坐标一致
- fix(aspect-ratio): 编辑与生成分别调用 `/v1/images/edits` 与 `/v1/images/generations`，按原图比例传参，提升非 1:1 输出稳定性
- fix(letterbox-fallback): 若服务端返回比例与原图不一致，前端以透明边框进行信封式适配到目标比例
- chore(env): 新增并使用 `WHATAI_API_KEY` 与 `PROXY_VIA_VITE=true`；在 `.gitignore` 增加 `.env*` 防止提交密钥
- chore(version): 将 `package.json` 版本从 `0.1.0` 升级到 `0.2.0`

验证说明：
- 上传大图（如 `5000×3000`，比例 `5:3`）进行编辑或生成，控制台应打印缩放日志；服务端接收的基图不超过 `2048×2048`，输出宽高比与原图一致；有遮罩时与基图对齐

## v0.3.0 (2025-11-08)

- style(ui): 更新UI风格，换为黄灰配色，并优化UI细节，更精致细腻
## v0.3.1

- 默认描边颜色改为红色（RGB 255,0,0 / `#FF0000`），新创建的线条、箭头、形状使用该默认色。
- 工具栏颜色选择器改为圆形，并统一为紧凑尺寸 `w-7 h-7`，视觉更一致。
- 新增 `.pod-color-swatch-circle` 样式，移除浏览器默认边框并强制圆形显示（WebKit/Gecko）。
- 统一原生 `range` 滑杆强调色使用主题强调色（`accent-color: var(--text-accent)`），配合 PodUI 主题为黄色。
- 预览检查通过，终端无新增错误。

## v0.4.0 (2025-11-09)

- feat(models): 图像生成与编辑模型统一切换为 `nano-banana`，生成走 `/v1/images/generations`（JSON），编辑走 `/v1/images/edits`（FormData）
- feat(images): 生成接口支持多图参考数组 `image[]`；比例以“图1”计算并传入 `aspect_ratio`
- feat(size-check): 生成接口移除 `size` 传参以符合规范；客户端保留严格尺寸校验与“固定尺寸信封适配”保障输出与首图一致
- chore(logs): 控制台日志统一标注 `(Nano-banana)` 便于调试与核验请求/响应
- chore(version): `package.json` 从 `0.3.1` 升级到 `0.4.0` 并打标签

验证说明：
- 多选图片进行“生成编辑”，查看控制台 `[generations]` 与 `[editImage]` 日志，确认模型与端点、`aspect_ratio`、`image[]` 等参数正确；输出尺寸/比例与“图1”一致（严格模式下不一致将报错）
## v0.5.1 (2025-11-12)

- chore(version): `package.json` 版本升级为 `0.5.1`
- style(ui): 调整香蕉按钮的悬浮面板（Hover Panel）布局与排列，优化分组与间距，提升可读性与可点击性
- docs(changelog): 使用中文补充本次 UI 变更说明，便于团队协作与回溯

验证说明：
- 打开页面，鼠标悬停在香蕉按钮，查看悬浮面板布局与按钮排列是否更紧凑、分组更清晰；并确认点击热区无回归问题

## v0.5.2 (2025-11-12)

- style(card-title): 卡片标题居中显示，中文标题应用“阿里妈妈数黑体 Bold”，字号提升为 1.2 倍，增加文字阴影与字距（0.06em），在深色背景下可读性更佳
- i18n(preset-label): 卡片右侧徽标文案改为本地化的“预设/Preset”，并移除描边样式；在 `translations.ts` 新增 `bananaSidebar.presetLabel`
- i18n(weather-prompts): 为中文天气卡片 7 个预设提示词统一添加前缀“保持画面主体和结构不变，将天气氛围改为…”，并为英文卡片同步添加等效前缀“Keep the main subject and composition unchanged; change the weather ambiance to …”
- feat(font): 在 `index.html` 全局引入阿里妈妈数黑体的 `@font-face`，用于中文标题显示（英文自动回退到默认字体）
- chore(version): 将 `package.json` 与 `metadata.json` 版本更新为 `0.5.2`

验证说明：
- 进入页面，查看香蕉预设卡片：标题应居中显示，中文标题使用阿里妈妈数黑体，字号更大且有阴影与字距；右侧徽标应显示“预设/Preset”且无描边
- 切换中英文界面，点击 7 个天气卡片，生成或编辑时应看到提示词前缀分别为中文与英文的等效语句

## v0.5.3 (2025-11-12)

- feat(image-toolbar): 将图片工具栏中的“圆角”控制替换为“透明度”控制（范围 0–100，默认 100 不透明）。
- feat(image-type): 在 `ImageElement` 类型新增 `opacity?: number` 字段，添加图片时默认写入 `opacity: 100`。
- feat(render/export): 画布渲染 `<image>` 标签与合并/缩略图导出 SVG 字符串均写入 `opacity`，按 0–1 浮点转换（如 60 → 0.6）。
- i18n(contextMenu): 在 `translations.ts` 增加 `contextMenu.opacity` 的中英文文案，界面标题与提示完整显示。
- compat(borderRadius): 保留历史图片的圆角裁切逻辑（`clipPath` 生效）；矩形的“圆角大小”控制不变，仅图片改为透明度控制。
- chore(version): 将 `package.json` 与 `metadata.json` 更新为 `0.5.3`。

验证说明：
- 打开 `npm run dev` 预览（自动端口，如 `http://localhost:3001/`）。上传或选中一张图片；在工具栏移动滑块或输入数值调整透明度。
  - 期望：默认值为 100，不透明；变更后图片透明度即时更新；`0` 为全透明，`100` 为不透明。
- 合并/导出验证：合并若干元素生成图片或导出包含图片的 SVG，查看生成内容的 `<image>` 标签是否包含 `opacity="..."`，值与当前设置一致（如 `0.6`）。
- 兼容性：已有图片若设置了圆角，仍可正常裁切；矩形仍显示圆角控制；界面文案显示“透明度/Opacity”无缺失。
## v0.8.2 (2025-11-19)

- feat(models): 接入 `nano-banana` 图像生成与编辑接口；生成调用 `/v1/images/generations`（返回 `b64_json` 或 `url`），编辑调用 `/v1/images/edits`（`multipart/form-data` 上传 `image[]`）
- fix(aspect-ratio): 编辑时按首图比例映射到支持枚举（如 `1:1`、`4:3`、`16:9` 等），并附带 `size=WxH`；启用 `WHATAI_STRICT_SIZE=true` 时进行像素一致性校验
- ui(settings): 设置面板模型选择更新为 `nano-banana`；价格显示调整：`gemini-2.5-flash-image` 为 `¥0.08/次`，`nano-banana` 为 `¥0.16/次`
- compat(gemini): 保持 `gemini-2.5-flash-image` 现有聊天完成方式 `/v1/chat/completions` 不变
- chore(version): `package.json` 版本更新至 `0.8.2`

验证说明：
- 在设置面板选择 `nano-banana`，执行编辑：输出比例与首图一致（非枚举比例将映射到就近支持项）；如需像素级一致，设置 `WHATAI_STRICT_SIZE=true`
- 生成与编辑在服务端返回 `b64_json` 或 `url` 均可被解析显示

## v0.9.0 (2025-11-20)

- feat(models): 接入 `gemini-3-pro-image-preview`，调用方式同 `gemini-2.5-flash-image` 的多模态 `/v1/chat/completions`；设置面板新增模型选项并显示价格 `¥0.2/次`
- fix(parse): 解析字符串结果支持 Markdown 图片与裸 URL，非 `image/*` 响应自动回退为通过 `Image` + `Canvas` 转 `base64` 显示；`image_url.url` 分支亦加入同样的容错逻辑
- chore(lint): 修复未使用变量，`npm run lint` 通过
- chore(version): `package.json` 升级到 `0.9.0` 并打标签

验证说明：
- 在设置面板选择 `gemini-3-pro-image-preview`，进行生成或编辑：当返回为 `!{image}(https://...)` 等字符串形式时，客户端可正确提取链接并显示图片；非 `image/*` 响应将自动回退为 `Canvas` 转图像显示

## v0.9.1 (2025-11-21)

- feat(promptbar): 提示词输入面板新增图片尺寸选择（`1K/2K/4K`），仅在 `nano-banana-2` 且图片模式下显示
- feat(services): 在编辑端 `/v1/images/edits` 针对 `nano-banana-2` 追加 `image_size` 参数，值来源于面板选择
- ui(app): 新增 `imageModel` 与 `imageSize` 状态，并传入 `PromptBar`；监听 `localStorage('WHATAI_IMAGE_MODEL')` 变更以保持同步
- fix(promptbar): 修复运行时缺少属性解构导致的异常
- chore(version): `package.json` 与 `metadata.json` 版本更新为 `0.9.1`

验证说明：
- 在设置面板选择 `nano-banana-2`，切换到“图片”模式：提示条显示 `1K/2K/4K` 尺寸按钮；选择尺寸后进行编辑，网络请求的 `FormData` 应包含 `image_size`（仅 `nano-banana-2`）；其它模型不显示尺寸按钮且不传该参数

## v0.9.7

- feat(api): 图片接口统一返回 `url`（优先解析 `url`，`b64_json` 兜底）
- feat(nano-banana-2): 强制枚举比例，输入图非枚举时自动居中裁剪到最近枚举比例
- fix(api): `images/edits` 移除 `size` 参数，避免与 `aspect_ratio` 冲突
- test(script): 新增脚本 `npm run test:banana` 验证生图与编辑链路（含 `url` 下载校验）

## v1.0.2

- docs: 同步项目文档与元数据版本至 1.0.2
- chore(version): 统一各文件版本号

## v1.1.0(2025-12-04)

- refactor(app-container): 优化 `src/App.tsx` 为纯容器，仅进行依赖注入与组件组合；交互/选择/裁剪/合并等逻辑下沉到 Hooks 与组件
- feat(hooks): 抽取并接入 `useCanvasInteraction/useSelection/useBoardActions/useBoardManager/useClipboard/useKeyboardShortcuts/useLayerMerge/useCrop/useTextEditing/useContextMenuActions/useDragImport/useGenerationPipeline/useUserEffects/useI18n/useCredentials/useCanvasCoords/useElementOps`
- fix(i18n): 统一 `t` 函数返回类型为 `string`，移除使用处类型断言，组件接线更稳定
- chore(cleanup): 移除重复的 `LayerPanel` 与旧版 `useI18n`，统一引用路径到 `src/*`
- docs(readme): 更新目录结构、端口说明与常用命令（新增 `npm run lint` 与 `npx tsc --noEmit`）

验证说明：
- 运行 `npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过；启动 `npm run preview` 可在本地验证交互（右键菜单、裁剪、选择、对齐、缩放/拖拽、生成管线）。

## v1.1.1 (2025-12-04)

- docs(scratchpad): 新增 UI 设计标准与任务看板，统一 Design Tokens/组件规范/交互状态/A11y/动效边界
- style(podui): 在 `:root` 增加令牌别名与焦点环（`--pod-panel-bg`, `--pod-border-color`, `--pod-text-primary`, `--pod-radius-xs`, `--pod-transition-fast`, `--pod-ring-color/width/ring`, `--pod-accent`, `--toolbar-bg-color`），保证组件变量完备
- fix(i18n): `BananaSidebar/QuickPrompts` 不再通过 `t()` 读取数组，改为 `translations[language]`；向 `PromptBar` 传 `language` 并下游接线，修复 `(p || []).slice(...).map is not a function`
- verify: 通过 `npm run lint`、`npx tsc --noEmit`、`npm run build`；预览交互正常

## v1.1.7 (2025-12-11)

- style(banana-button): 多次迭代完成香蕉按钮设计，最终采用“仅 Logo + 轻交互”的极简扁平风格；保持点击区域 40px 不变
- feat(banana-sidebar): 增大 Logo 尺寸，移除背景与装饰层，交互为悬停轻微缩放与亮度调整；`BananaSidebar.tsx` 直接渲染 `BananaIcon`
- style(podui): 早期尝试“五彩斑斓的黑”暗色渐变，后统一为透明背景以更贴合整体 UI 的扁平化与极简方向
- docs/release: 同步 `README.md`、`CHANGELOG.md`、`metadata.json` 与 `package.json` 到 `v1.1.7`

验证说明：
- 打开页面，查看侧边香蕉按钮：仅显示 Logo，悬停略微放大（约 1.06×）并轻微提亮；按下缩小（约 0.96×）；点击热区仍为 `40×40`
- 运行 `npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过，预览交互正常
