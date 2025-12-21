import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');
const OUTPUT_PATH = path.join(__dirname, '../src/config/updateFeed.json');
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

try {
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  
  // 匹配版本头: 
  // ## v1.2.3 (2025-12-19) 
  // ## v1.1.0(2025-12-04)
  // ## v0.9.7
  const versionRegex = /^##\s+(v\d+\.\d+\.\d+)\s*(?:\(([^)]+)\))?/gm;
  
  const matches = [];
  let match;
  while ((match = versionRegex.exec(content)) !== null) {
    matches.push({
      version: match[1],
      date: match[2] || '', // 可能没有日期
      index: match.index,
      fullMatch: match[0]
    });
  }

  const updates = [];
  const MAX_VERSIONS = 1000; 
  const MAX_HIGHLIGHTS = 3;

  for (let i = 0; i < matches.length && i < MAX_VERSIONS; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    // 截取当前版本的内容块
    const start = current.index + current.fullMatch.length;
    const end = next ? next.index : content.length;
    const versionBlock = content.slice(start, end);
    
    const highlights = [];
    const lines = versionBlock.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('-')) {
        let cleanText = trimmed.replace(/^-+\s*/, '');
        if (highlights.length < MAX_HIGHLIGHTS) {
          highlights.push(cleanText);
        }
      }
    }
    
    updates.push({
      version: current.version,
      date: current.date,
      highlights
    });
  }

  // 按版本号倒序排序 (v1.2.7 > v1.2.3 > v0.1.0)
  updates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }));

  // 只保留最新的 3 个
  const finalUpdates = updates.slice(0, 3);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalUpdates, null, 2), 'utf8');
  console.log(`[UpdateFeed] Generated ${finalUpdates.length} versions to ${OUTPUT_PATH}`);

} catch (error) {
  console.error('[UpdateFeed] Error generating feed:', error);
  // 出错时不中断构建，生成空数组以免前端报错
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.writeFileSync(OUTPUT_PATH, '[]', 'utf8');
  }
}
