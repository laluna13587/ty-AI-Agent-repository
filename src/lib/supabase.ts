import { createClient } from '@supabase/supabase-js';

// 服务器端专用客户端：用 service_role key，能绕过 RLS。
// 只能在后端（route handler / server component）里 import，绝不能在带 'use client' 的文件里用。
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
