import { supabaseAdmin } from './supabase';
import { embedQuery } from './embedding';

export type Match = {
  id: number;
  content: string;
  source: string;
  similarity: number;
};

// 给一句话，返回知识库里最相关的 k 段
export async function retrieve(query: string, k = 5): Promise<Match[]> {
  const embedding = await embedQuery(query);

  const { data, error } = await supabaseAdmin.rpc('match_documents', {
    query_embedding: embedding,
    match_count: k,
  });

  if (error) {
    console.error('检索出错:', error.message);
    return [];
  }
  return (data ?? []) as Match[];
}
