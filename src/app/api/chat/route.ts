import { deepseek } from '@ai-sdk/deepseek';
import {
  streamText,
  convertToModelMessages,
  toUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai';
import { supabaseAdmin } from '@/lib/supabase';
import { retrieve } from '@/lib/retrieval';
import { getCurrentUser } from '@/lib/auth';

// 允许流式响应最长运行 30 秒
export const maxDuration = 30;

// 从一条 UIMessage 里把纯文本抽出来
function textOf(message: UIMessage): string {
  return message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('');
}

export async function POST(req: Request) {
  // 认证检查：未登录直接拒绝
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }

  const { messages, conversationId }: {
    messages: UIMessage[];
    conversationId: string;
  } = await req.json();

  // 检查是否豁免每日限流
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('is_rate_exempt')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRow?.is_rate_exempt) {
    // 限流：每用户每天最多 10 条用户消息
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', todayStart.toISOString())
      .in(
        'conversation_id',
        supabaseAdmin.from('conversations').select('id').eq('user_id', user.id),
      );
    if ((todayCount ?? 0) >= 10) {
      return Response.json({ error: '今日提问次数已达上限（10次），请明天再来' }, { status: 429 });
    }
  }

  // 确保这条会话存在，并关联 user_id
  await supabaseAdmin
    .from('conversations')
    .upsert({ id: conversationId, user_id: user.id }, { onConflict: 'id' });

  // 保存用户刚发的这条消息（messages 数组最后一条）
  const lastUser = messages[messages.length - 1];
  const question = (lastUser?.role === 'user' ? textOf(lastUser) : '').trim();
  console.log(`[chat] user=${user.username} question="${question.slice(0, 50)}"`);
  if (!question) {
    return Response.json({ error: '消息不能为空' }, { status: 400 });
  }
  await supabaseAdmin.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: question,
  });

  // 从数据库加载最近 4 条历史（不含刚存入的这条），拼上当前问题作为模型上下文
  const { data: historyRows } = await supabaseAdmin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(5);
  const historyMessages = ((historyRows ?? []).reverse() as { role: string; content: string }[])
    .map((m) => ({
      id: String(Math.random()),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    }));

  // 🔍 RAG：用问题去知识库检索最相关的几段
  const matches = question ? await retrieve(question, 5) : [];
  const context = matches
    .map((m) => m.content)
    .join('\n\n');

  const systemPrompt = context
    ? `你是一个中文智能助手。请仅根据下面提供的参考资料回答用户问题。\n` +
      `严格禁止：不得在回答中输出任何资料编号（如【资料1】【资料2】等）、来源文件名、路径或任何形式的引用标注。\n` +
      `如果资料中没有相关信息，直接回答"暂无相关内容"，不要编造。\n` +
      `格式要求：段落之间空一行，列举多项时每项单独一行，不要把所有内容挤在一段。\n\n` +
      `===== 参考资料 =====\n${context}\n===== 资料结束 =====`
    : `你是一个中文智能助手。回答准确、简洁，段落清晰，列举多项时每项单独一行。（当前知识库为空或未检索到相关资料。）`;

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: systemPrompt,
    messages: await convertToModelMessages(historyMessages),
    // AI 回答完整生成后，把它存进数据库
    onEnd: async ({ text }) => {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: text,
      });
    },
  });

  // 返回符合 useChat 期望的 UI 消息流
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.fullStream }),
  });
}
