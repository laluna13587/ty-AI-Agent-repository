import { supabaseAdmin } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ error: '用户名和密码不能为空' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, password_hash, is_approved, game_name')
    .eq('username', username)
    .maybeSingle();

  if (!user) {
    return Response.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return Response.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  if (!user.is_approved) {
    return Response.json({ error: '账户尚未获得授权，请联系管理员' }, { status: 403 });
  }

  const token = signToken({ id: user.id, username: user.username });

  const response = Response.json({ username: user.username, gameName: user.game_name ?? user.username });
  response.headers.set(
    'Set-Cookie',
    `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
  );
  return response;
}
