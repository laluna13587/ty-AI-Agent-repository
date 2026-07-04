import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }
  return Response.json({ id: user.id, username: user.username });
}
