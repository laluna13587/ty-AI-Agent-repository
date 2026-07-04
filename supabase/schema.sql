-- 阶段 2 数据表：对话 & 消息
-- 在 Supabase 后台 SQL Editor 里粘贴执行即可

-- 一次会话（一个聊天窗口/一条对话线）
create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  created_at timestamptz not null default now()
);

-- 每一条消息（用户的 or AI 的）
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

-- 按会话查历史时用得上，加个索引
create index if not exists messages_conversation_id_idx
  on messages (conversation_id, created_at);

-- 开启行级安全（默认锁死；服务器用 service_role key 访问会绕过 RLS，所以后端照常能读写）
-- 阶段 4 加登录后，会在这里补上「用户只能访问自己数据」的策略
alter table conversations enable row level security;
alter table messages       enable row level security;
