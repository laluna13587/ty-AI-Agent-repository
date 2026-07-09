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

  // 限流：每用户每天最多 20 条用户消息
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: userConvs } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('user_id', user.id);
  const convIds = (userConvs ?? []).map((c) => c.id);
  if (convIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('conversation_id', convIds)
      .gte('created_at', todayStart.toISOString());
    if ((count ?? 0) >= 20) {
      return Response.json({ error: '今日提问次数已达上限（20次），请明天再来' }, { status: 429 });
    }
  }

  // 确保这条会话存在，并关联 user_id
  await supabaseAdmin
    .from('conversations')
    .upsert({ id: conversationId, user_id: user.id }, { onConflict: 'id' });

  // 保存用户刚发的这条消息（messages 数组最后一条）
  const lastUser = messages[messages.length - 1];
  const question = lastUser?.role === 'user' ? textOf(lastUser) : '';
  if (question) {
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: question,
    });
  }

  // 🔍 RAG：用问题去知识库检索最相关的几段
  const matches = question ? await retrieve(question, 5) : [];
  const context = matches
    .map((m, i) => `【资料${i + 1}｜来源:${m.source}】\n${m.content}`)
    .join('\n\n');

  const systemPrompt = context
    ? `你是一个中文智能助手。请**仅根据下面提供的参考资料**回答用户问题。\n` +
      `如果资料中没有相关信息，就明确说“资料中没有相关内容”，不要编造。\n` +
      `回答时可以标注引用了哪条资料的来源。\n\n` +
      `===== 参考资料 =====\n${context}\n===== 资料结束 =====`
    : `你是一个中文智能助手。回答准确、简洁。（当前知识库为空或未检索到相关资料。）`;

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
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
