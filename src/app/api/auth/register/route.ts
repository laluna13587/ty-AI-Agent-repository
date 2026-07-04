import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { username, password, gameName } = await req.json();

  if (!username || !password) {
    return Response.json({ error: '成员身份标识和通行密钥不能为空' }, { status: 400 });
  }
  if (username.length < 2 || username.length > 32) {
    return Response.json({ error: '成员身份标识长度需在 2-32 个字符之间' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: '通行密钥至少 6 位' }, { status: 400 });
  }

  // 检查用户名是否已存在
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: '用户名已被使用' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await supabaseAdmin.from('users').insert({
    username,
    password_hash,
    game_name: gameName ?? null,
    is_approved: false,
  });

  if (error) {
    return Response.json({ error: '注册失败，请稍后重试' }, { status: 500 });
  }

  return Response.json({ message: '注册成功，请等待管理员审批后方可登录' });
}
