import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: '身份信息缺失，请重新接入' }, { status: 401 });
  }
  const { data } = await supabaseAdmin
    .from('users')
    .select('game_name')
    .eq('id', user.id)
    .maybeSingle();
  return Response.json({ id: user.id, username: user.username, gameName: data?.game_name ?? user.username });
}
