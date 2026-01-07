# BananaPod 发布与版本更新规范（Playbook）

本文件是“唯一可执行规范”。每次发布/更新版本时，严格按此流程执行；不依赖临时口头提醒。

---

## 1. 目标与约束

### 目标（一次发布必须同时满足）
- 版本号升级：支持指定版本 `x.y.z`；未指定则在当前版本基础上 `patch + 1`（例：`1.3.3 -> 1.3.4`）。
- 更新说明（面向用户）：按 `CHANGELOG_GUIDELINES.md` 规范自动生成并写入 `CHANGELOG.md` 顶部版本块。
- 项目描述一致性：所有“对外展示版本号”的文件必须与最新版本一致（至少包含 `package.json`、`README.md`、`metadata.json`）。
- Git 交付：生成一次 commit + 一个 annotated tag（tag = `vX.Y.Z`），提交信息/Tag 信息为中文更新要点。
- 可选远程推送：必须显式确认后才推送；推送后同步“简介”文案为最新状态（无自动工具时给出可复制文案与手动步骤）。
- 调试可观测：输出必须包含关键调试信息（版本、替换命中次数、Git 命令结果/错误码、生成的 commit/tag）。

### 约束
- 不引入新的第三方依赖（优先 Node 内置模块 + 现有工具链）。
- 不使用任何 `--force` 类 git 强制操作。
- `CHANGELOG.md` 只写用户能感知的变化，不写技术细节（接口/文件名/命令/变量名/脚本名等都禁止）。
- 发布默认采用“全量提交”模式：本次发布会将当前工作区的全部改动一次提交（包含新增/修改/删除文件）。

---

## 2. 单一事实源与必改文件清单

### 单一事实源
- `package.json.version` 是版本号唯一权威来源。

### 必改文件（发布时必须对齐）
- `f:\Trae\BananaArch-main\package.json`
  - `version`: `x.y.z`
- `f:\Trae\BananaArch-main\CHANGELOG.md`
  - 顶部新增：`## vX.Y.Z (YYYY-MM-DD)` + 2–5 条要点
- `f:\Trae\BananaArch-main\README.md`
  - 标题行：`# ...（vX.Y.Z）`
  - “版本与发布”中的“当前版本：`x.y.z`”
  - “核心更新（vX.Y.Z）”标题（以及条目建议与本次 changelog 一致或为其子集）
- `f:\Trae\BananaArch-main\metadata.json`
  - `name` 中的 `(vX.Y.Z)`

### 自动衍生文件（保持一致，推荐纳入发布步骤）
- `f:\Trae\BananaArch-main\src\config\updateFeed.json`
  - 由 `scripts/generateUpdateFeed.mjs` 从 `CHANGELOG.md` 自动生成（项目已在 `predev/prebuild` 执行）
  - 发布前建议确保该文件已更新并纳入提交（它会影响设置面板“最近更新”展示）

---

## 3. 更新要点（Release Notes）的“自动补齐”策略

“按当前开发进度自动补齐”必须有可靠的数据源，否则脚本只能猜，且极易违反 `CHANGELOG_GUIDELINES.md`。

### 3.1 推荐方案（最稳定）：以 Git 提交信息为数据源（从上次 Tag 到当前）
- 规则：每个合入的 commit message body 至少包含 1 条面向用户的中文要点，格式固定：
  - 每条以 `- ` 开头
  - 建议以 `新增/优化/修复` 开头
  - 严禁技术细节（同 `CHANGELOG_GUIDELINES.md`）
- 发布时脚本提取范围：
  - `lastTag..HEAD` 的提交信息中所有满足规则的要点行
- 聚合规则（发布脚本必须执行）：
  - 去重
  - 最终取 2–5 条（优先取最新、最相关）
  - 若不足 2 条：发布失败并提示先补齐（不允许脚本“自动编造文案”）

说明：该方案无需额外新增“登记文件”，但要求提交信息长期规范。

### 3.2 备选方案（更强约束）：维护变更登记簿（机器可读）
- 维护一个机器可读的变更条目文件（例如 `release-notes.jsonl`），每完成一个用户可见改动就追加一条。
- 发布时脚本读取“自上次 tag 以来新增的条目”自动生成 changelog/README/commit/tag 文案。
- 优点：稳定性最高；缺点：需要新增文件与日常登记动作。

默认采用 3.1；若后续你决定启用 3.2，再补充本节细则与文件格式。

---

## 4. 标准发布命令（推荐自动化方式）

发布统一入口建议为（待实现/落地后强制使用）：
- `node scripts/release.mjs [--version x.y.z] [--dry-run] [--push]`

### 参数规范
- `--version x.y.z`：指定目标版本（严格校验 `数字.数字.数字`）
- 不传 `--version`：自动读取 `package.json.version` 并执行 patch +1
- `--dry-run`：只打印计划与差异，不写文件、不执行 git 变更
- `--push`：显式开启远程推送（默认不推送）

### 失败中止原则（必须）
任何一步失败立即中止，返回非 0；并打印：
- 失败原因（含命令与错误码）
- 当前已完成的步骤
- 建议的恢复动作（见第 7 节）

---

## 5. 标准发布步骤（脚本/人工等价流程）

本节定义“脚本必须做什么”，即使暂时人工执行也必须遵循同样顺序与结果。

### 步骤 0：预检（必须）
- 不要求工作区干净：发布默认“全量提交”，会把当前全部改动打包进一个 release commit
- 当前分支正确（例如 main/master 或你的发布分支）
- 确认上一次 tag 存在且可读（用于提取“开发进度范围”）
  - 若采用“全量提交”模式且只做 patch+1，可以不依赖 `lastTag..HEAD` 聚合策略

### 步骤 1：计算版本号
- 读取 `package.json.version = cur`
- 目标版本 `next`：
  - 指定版本：`next = --version`
  - 未指定：`next = bumpPatch(cur)`
- 生成：
  - `tag = v${next}`
  - `date = YYYY-MM-DD`

输出调试信息（必须打印）：
- `cur -> next`
- `tag`
- `date`

### 步骤 2：收集更新要点（自动补齐）
- 从 `lastTag..HEAD` 的 commit message body 中提取符合规则的要点行（见 3.1）
- 聚合并得到 2–5 条 `highlights`
- 若不足 2 条：中止发布并提示补齐提交信息（不允许生成不合规文案）

### 步骤 3：更新 CHANGELOG.md（写入顶部）
- 在 `CHANGELOG.md` 顶部插入新版本块：

  - `## vX.Y.Z (YYYY-MM-DD)`
  - 空行
  - `- ...`（2–5 条）

- 再次校验：不得出现技术细节（按 `CHANGELOG_GUIDELINES.md` 的“禁止项”进行扫描）
  - 命中则中止（默认中止；除非明确提供 `--allow-guideline-warn` 这种扩展开关，默认不支持）

### 步骤 4：同步其它展示位版本号
- `package.json.version = next`
- `README.md`：
  - 标题版本号替换为 `v${next}`
  - “当前版本”替换为 `${next}`
  - “核心更新（v...）”替换为 `v${next}`
- `metadata.json.name` 中 `(v...)` 替换为 `(v${next})`

输出调试信息（必须打印）：
- 每个文件：命中次数、变更后的关键行（截断展示）

### 步骤 5：生成 updateFeed.json（确保 UI 最近更新一致）
- 执行 `node scripts/generateUpdateFeed.mjs`
- 确认 `src/config/updateFeed.json` 顶部版本是 `v${next}`

### 步骤 6：质量与安全校验（必须）
至少执行：
- `npm run lint`
- `npx tsc --noEmit`

若出现安全风险提示或依赖异常，优先执行：
- `npm audit`

说明：是否继续发布由执行者判断，但 audit 结果必须记录（终端输出保留）。

### 步骤 7：Git 提交与打 Tag（annotated）
- `git add -A`（全量加入：新增/修改/删除文件全部纳入）
- `git commit`
  - subject：`chore(release): vX.Y.Z`
  - body：逐行写入 `highlights`
- 确保 tag 指向本次提交（允许重建 tag；不使用 force 推送）：
  - 删除本地旧 tag（若存在）：
    - `git tag -d vX.Y.Z`
  - 创建 annotated tag：
    - `git tag -a vX.Y.Z -m "<highlights>"`

输出调试信息（必须打印）：
- 分支名
- commit 短哈希
- tag 名称
 - tag 指向校验：
   - `git show -s --format="%h %s" vX.Y.Z`

### 步骤 8：可选远程推送（显式确认）
- 默认不推送
- 仅在明确确认（或提供 `--push`）后执行：
  - 推送分支：
    - `git push`
  - 推送 tag（保证远程 tag 指向本次提交）：
    - 若远程已存在同名 tag，先删除远程 tag（非强制推送）：
      - `git push origin :refs/tags/vX.Y.Z`
    - 再推送本地 tag：
      - `git push origin vX.Y.Z`

### 步骤 9：推送后简介同步（不依赖额外工具）
- 简介来源优先级：
  1) `metadata.json.description`
  2) README 首段摘要
- 输出一段“推荐简介文案”（可复制粘贴）：
  - 包含项目一句话定位 + 关键能力（不含技术细节）
- 给出手动操作路径：
  - GitHub：Repo -> About -> Description（粘贴即可）

---

## 6. Windows 本地执行命令清单（人工模式）

在仓库根目录执行：

```bat
npm run lint
npx tsc --noEmit
node scripts/generateUpdateFeed.mjs
npm audit
```

Git 常用：

```bat
git status
git add -A
git commit -m "chore(release): vX.Y.Z" -m "新增：..." -m "优化：..." -m "修复：..."
git tag -d vX.Y.Z
git tag -a vX.Y.Z -m "新增：..." -m "优化：..." -m "修复：..."
git push
git push origin :refs/tags/vX.Y.Z
git push origin vX.Y.Z
```

---

## 7. 回滚与恢复（失败时怎么处理）

### 未提交前失败
- 直接回退工作区改动：
  - `git restore --staged .`
  - `git restore .`

### 已提交但未推送
- 允许本地回滚：
  - `git reset --hard HEAD~1`
  - `git tag -d vX.Y.Z`

### 已推送（危险操作，默认不支持自动化）
- 不使用 `--force` 推送。
- 处理方式：
  - 通过新增一个修复提交与新版本发布解决（推荐）
  - 或由你明确指示后再讨论远程回滚策略（本 playbook 不覆盖强制回滚）

---

## 8. 成功验收（发布完成必须满足）
- `package.json.version == next`
- `CHANGELOG.md` 顶部是 `## vnext (date)`，且 2–5 条要点符合规范
- `README.md` 标题版本、当前版本、核心更新标题与 `next` 一致
- `metadata.json.name` 中版本一致
- `src/config/updateFeed.json` 顶部版本是 `vnext`，且 highlights 与 changelog 顶部一致/子集
- 存在 commit：`chore(release): vnext`
- 存在 annotated tag：`vnext`
- 若选择推送：远程可见该 commit 与 tag，并完成简介同步（自动或手动）
