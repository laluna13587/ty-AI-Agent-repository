-- 用户白名单权限系统
-- 在 Supabase 后台 SQL Editor 里粘贴执行

-- 用户表
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  is_approved   boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table users enable row level security;

-- conversations 表关联用户
alter table conversations add column if not exists user_id uuid references users(id);

-- ===== 管理员操作：审批用户 =====
-- 在 Supabase 后台 Table Editor 直接将 is_approved 改为 true
-- 或执行：
--   update users set is_approved = true where username = '你要审批的用户名';

-- ===== 每日限流豁免字段（新增，需在 Supabase 执行） =====
alter table users add column if not exists is_rate_exempt boolean not null default false;

-- 给某账户开豁免：
--   update users set is_rate_exempt = true where username = '要豁免的用户名';
-- 取消豁免：
--   update users set is_rate_exempt = false where username = '要取消的用户名';
