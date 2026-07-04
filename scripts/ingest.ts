// 建库脚本：把 docs/ 里的 Markdown 文档切块、向量化，写入 Supabase
// 运行： npm run ingest
//
// 前提：.env.local 里已填好 SUPABASE_SERVICE_ROLE_KEY 和 OPENAI_API_KEY
//       docs/ 目录里放了 .md 文件

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { supabaseAdmin } from '../src/lib/supabase';
import { embedTexts } from '../src/lib/embedding';

const DOCS_DIR = 'docs';
const CHUNK_SIZE = 1000; // 每块大约字符数
const CHUNK_OVERLAP = 200; // 块之间重叠字符数（避免把一句话从中间切断丢失上下文）
const EMBED_BATCH = 100; // 每批向量化多少段（一次调用别太多）

// 把一篇长文按段落聚合成 ~CHUNK_SIZE 的块，块间留 overlap
function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/) // 按空行分段
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > CHUNK_SIZE && current) {
      chunks.push(current);
      // 新块从上一块尾部 overlap 个字符开始，保留上下文
      current = current.slice(-CHUNK_OVERLAP) + '\n\n' + p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function main() {
  // 找出 docs/ 下所有 .md 文件
  const files = (await readdir(DOCS_DIR)).filter(
    (f) => extname(f).toLowerCase() === '.md',
  );
  if (files.length === 0) {
    console.log(`⚠️  ${DOCS_DIR}/ 里没有 .md 文件，先放文档进去再运行。`);
    return;
  }

  console.log(`发现 ${files.length} 个文档，开始处理……`);

  // 可选：先清空旧数据，避免重复（重建库时用）
  await supabaseAdmin.from('documents').delete().neq('id', 0);

  let total = 0;
  for (const file of files) {
    const raw = await readFile(join(DOCS_DIR, file), 'utf8');
    const chunks = chunkText(raw);
    console.log(`  ${file}: 切成 ${chunks.length} 块`);

    // 分批向量化 + 写库
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const vectors = await embedTexts(batch);
      const rows = batch.map((content, j) => ({
        content,
        source: file,
        embedding: vectors[j],
      }));
      const { error } = await supabaseAdmin.from('documents').insert(rows);
      if (error) throw error;
      total += rows.length;
      console.log(`    已写入 ${total} 段`);
    }
  }

  console.log(`✅ 完成，共写入 ${total} 段文档向量。`);
}

main().catch((e) => {
  console.error('建库失败:', e);
  process.exit(1);
});
