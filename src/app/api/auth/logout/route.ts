export async function POST() {
  const response = Response.json({ message: '已登出' });
  response.headers.set(
    'Set-Cookie',
    'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  );
  return response;
}
