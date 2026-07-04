import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

// ⚙️ 想换 embedding 供应商，只改这一行（换成国内 provider 即可）：
//    注意：换模型后维度可能变，需同步改 rag.sql 里的 vector(1536)，并重建向量库。
const embeddingModel = openai.embedding('text-embedding-3-small');

// 批量把多段文字转成向量（建库时用）
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}

// 把单条查询转成向量（问答检索时用）
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}
