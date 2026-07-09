import { createOpenAI } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

// SiliconFlow embedding（香港/大陆可用，BAAI/bge-m3 维度 1024）
const siliconflow = createOpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY ?? '',
  baseURL: 'https://api.siliconflow.cn/v1',
});
const embeddingModel = siliconflow.embedding('BAAI/bge-m3');

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
