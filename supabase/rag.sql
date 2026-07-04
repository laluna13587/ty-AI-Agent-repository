-- 阶段 3 RAG：向量存储 + 相似度检索
-- 在 Supabase 后台 SQL Editor 里粘贴执行

-- 1) 开启 pgvector 扩展（存向量用）
create extension if not exists vector;

-- 2) 文档块表：每行是一段文档 + 它的向量
--    embedding 维度 1536 对应 OpenAI text-embedding-3-small
create table if not exists documents (
  id        bigint primary key generated always as identity,
  content   text not null,          -- 这一段的原文
  source    text,                   -- 来自哪个文件
  embedding vector(1536)            -- 这一段的向量
);

-- 3) 向量索引（加速相似度检索），用 hnsw，余弦距离
create index if not exists documents_embedding_idx
  on documents using hnsw (embedding vector_cosine_ops);

-- 4) 检索函数：给一个查询向量，返回最相似的 match_count 段
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id         bigint,
  content    text,
  source     text,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.source,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

-- 5) 开启 RLS（默认锁死；服务器用 service_role key 访问会绕过）
alter table documents enable row level security;
