export async function POST() {
  const response = Response.json({ message: '连接已断开' });
  response.headers.set(
    'Set-Cookie',
    'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  );
  return response;
}
