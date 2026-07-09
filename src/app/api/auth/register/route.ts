import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { username, password, gameName } = await req.json();

  if (!username || !password) {
    return Response.json({ error: '身份标识与通行密钥不得为空' }, { status: 400 });
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
    return Response.json({ error: '该身份标识已被注册' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await supabaseAdmin.from('users').insert({
    username,
    password_hash,
    game_name: gameName ?? null,
    is_approved: false,
  });

  if (error) {
    return Response.json({ error: '系统异常，申请未能提交，请稍后重试' }, { status: 500 });
  }

  return Response.json({ message: '申请已提交，等待授权审批后方可接入系统' });
}
