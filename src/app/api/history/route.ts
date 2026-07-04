import { supabaseAdmin } from '@/lib/supabase';

// GET /api/history?conversationId=xxx  ->  返回该会话的历史消息
export async function GET(req: Request) {
  const conversationId = new URL(req.url).searchParams.get('conversationId');
  if (!conversationId) {
    return Response.json({ messages: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 转成 useChat 需要的 UIMessage 格式
  const messages = (data ?? []).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: m.content }],
  }));

  return Response.json({ messages });
}
