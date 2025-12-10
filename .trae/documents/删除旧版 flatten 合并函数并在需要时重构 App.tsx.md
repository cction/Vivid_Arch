## 背景
- 目前 `App.tsx` 已改为调用 `@/utils/canvas` 的 `flattenElementsToImage`，旧版 `_flattenElementsToImageDeprecated` 函数依然保留（约在 86–204 行）。
- 保留旧实现会增加维护成本并混淆真实执行路径，删除后不改变行为。

## 目标
- 彻底删除 `App.tsx` 中旧版 `_flattenElementsToImageDeprecated` 函数块（从声明到结尾）。
- 若删除因文本匹配导致失败，使用文件替换的方式对 `App.tsx` 进行最小重构：移除旧函数、保持其余逻辑与导出完全一致。
- 删除后运行检查与本地验证，确保行为不变。

## 删除实施方案
1. 精确定位并删除范围：
   - 起始：`export const _flattenElementsToImageDeprecated = (`（`App.tsx` 中唯一匹配）
   - 结束：该函数块对应的闭合 `};`，下一段函数为 `const rasterizeMask = (`（不删除后续内容）
2. 代码修改：
   - 仅移除上述函数块，不改动任何导入、类型或其他函数。
3. 验证：
   - 运行 `npm run lint -- --quiet App.tsx` 与 `npm run lint`；应无语法/未使用项报错。
   - 启动预览/开发（预览已在运行），手动合并操作应正常（图层合并仍走 `@/utils/canvas`）。

## 失败备选：文件替换重构
1. 在无法可靠删除时，采用文件替换方式重构 `App.tsx` 的最小差异版本：
   - 移除 `_flattenElementsToImageDeprecated`
   - 保留当前所有已有变更：
     - `useBoardActions` 抽离与使用
     - 别名导入（`@/types`, `@/utils/canvas`）
     - hooks 依赖治理
     - JSX 类型修复
   - 任何 UI、数据流与导出契约保持不变。
2. 验证同上：lint 全量通过、页面合并功能正常。

## 风险与回滚
- 风险：误删边界导致下一段函数（`rasterizeMask`）损坏。
- 控制：按起止标记删除，删除后立即运行 lint 检查。
- 回滚：保留当前文件快照；若验证失败，立即还原。

## 验证步骤
- Lint：`npm run lint -- --quiet App.tsx`、`npm run lint`
- 交互检查：在预览环境尝试图层合并与导出（实际执行路径为 `@/utils/canvas`）。

## 交付物
- 删除旧函数后的 `App.tsx`（仅删除函数块，无其他改动）。
- 若需文件替换，则提供完整替换后的 `App.tsx`（和差异说明）。

请确认上述计划；确认后我将执行删除（或按需进行文件替换重构），并完成验证与汇报。