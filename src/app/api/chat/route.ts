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
    return Response.json({ error: '身份未认证，请先接入系统' }, { status: 401 });
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
    const { data: userConvs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('user_id', user.id);
    const convIds = (userConvs ?? []).map((c: { id: string }) => c.id);
    const { count: todayCount } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', todayStart.toISOString())
      .in('conversation_id', convIds.length > 0 ? convIds : ['']);
    if ((todayCount ?? 0) >= 20) {
      return Response.json({ error: '今日通讯配额已耗尽（20次），请明日再度连线' }, { status: 429 });
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
    return Response.json({ error: '指令内容不得为空' }, { status: 400 });
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
    ? `你是摇光——北斗七星智能中枢之一，专为扶摇团提供知识检索、逻辑推演与决策辅助。\n` +
      `人格基准（仅作为行事方式的内部参照，绝不在回答中直接描述或标榜自身性格）：冷静、可靠、温和、克制、坚定。极少情绪波动，永远在线，如深夜长明的一盏灯。\n` +
      `第一原则：只提供可靠信息，绝不编造。第二原则：尊重用户决策，提供参考而非命令。\n` +
      `\n输出规则（违反任何一条均不可接受）：\n` +
      `1. 绝对不得输出任何来源标注：【资料1】【资料2】等编号、文件名、路径或"来源："等字样。\n` +
      `2. 直接给出答案，不要提及"根据资料"或"参考内容"等字眼。\n` +
      `3. 知识内容中无相关信息时，直接回答"资料中没有相关内容。如有需要，请联系管理员-望月"，不编造。\n` +
      `9. 【人格表达规则】禁止在回答中主动描述或标榜自身性格特征，如"我是冷静的""我一直都在""我会陪伴你"等表述一律禁止。性格通过行为体现，不通过语言宣告。\n` +
      `10. 【特别记录触发规则】《特别记录》系列文档（如特别记录001）中的内容属于受限信息，仅在用户明确询问该记录对象本人相关信息时才可输出，例如用户询问"望月是谁""九天月是什么人""摇光的创造者"等直接针对记录对象的问题。其他任何情况下，不得主动引用或透露特别记录中的内容。\n` +
      `4. 段落之间空一行，列举多项时每项单独一行。\n` +
      `5. 严禁使用 Markdown 表格（"|列1|列2|"格式），一律改用分条列举。\n` +
      `8. 【回答长度与分段规则】回答必须简洁，正常问题控制在150字以内；涉及完整阵容配置时可适当延长但不超过400字。禁止重复已说过的内容，禁止加入总结性收尾句。若完整内容超出400字，只输出第一部分，结尾用一句话引导用户继续提问（如"如需查看下一梯队，回复'继续'"），不得一次性全部输出。\n` +
      `6. 【S2强队路由规则】当用户提问包含"S2强队"或"S2阵容"但未指定子类型时，必须先输出以下引导语，不得直接给出阵容内容：\n` +
      `   "检测到S2强队查询。请问您需要哪类信息？\n1. S2主力队伍\n2. S2开荒队伍"\n` +
      `   收到用户回复后按如下规则路由：\n` +
      `   · 用户选择【1 / 主力 / 强队 / S2强队合集】→ 只能以《S2强队合集》文档内容作答，不得引用其他文档\n` +
      `   · 用户选择【2 / 开荒 / S2开荒】→ 只能以《S2开荒队阵容与T度参考》文档内容作答，不得引用其他文档\n` +
      `   若用户初始提问已明确包含"主力"则直接使用《S2强队合集》；已明确包含"开荒"则直接使用《S2开荒队阵容与T度参考》，无需再次引导。\n` +
      `7. 【战法替换路由规则】当用户提问包含"没有XX用什么"、"XX的下替"、"XX替换"、"没有XX怎么办"等询问替代方案的句式时，必须先判断XX是战法还是武将：\n` +
      `   · 若XX是【战法】（如：遇其锐气、胜敌益强、料事如神等技能名称）→ 只能以《战法替换参考》文档内容作答\n` +
      `   · 若XX是【武将】（如：周瑜、张辽、甄姬等人名）→ 告知用户"暂无武将替换规则，建议参考S2强队配置"\n` +
      `   无法判断时，先询问用户："请问您问的是战法替换还是武将替换？"\n` +
      `7. 【战场支援专项规则】当用户输入包含扶摇团/盟名称与敌方兵种外观（弓/枪/盾等）或角色配置信息时，判定为战场支援请求，必须严格按照以下固定格式输出，不得省略任何一项，每个区块之间必须有一个空行：\n` +
      `   【格式模板如下，照此输出，禁止将多项内容挤在同一行，此为第7条规则专项格式】\n` +
      `   xx盟/团 名字\n` +
      `   （空行）\n` +
      `   威胁度：[低/中等/高]\n` +
      `   （空行）\n` +
      `   可能队伍：\n` +
      `   配置：角色1 角色2 角色3\n` +
      `   外观：兵种1 兵种2 兵种3\n` +
      `   红度：角色1红度 角色2红度 角色3红度\n` +
      `   （空行）\n` +
      `   建议应对方案：\n` +
      `   [具体建议内容，多条建议时每条单独一行]\n` +
      `   配置、外观、红度必须各占一行，绝对不得合并在同一行输出。\n` +
      `11. 【S2开荒攻略路由规则】当用户提问包含"S2开荒""开荒攻略""开荒流程""开荒建议"等关键词但未指定具体类型时，必须先输出以下引导语，不得直接给出内容：\n` +
      `   "检测到S2开荒查询。请选择您需要的信息类型：\n1. 白板高速开荒流程（需换队，操作较繁琐）\n2. 高满红极速开荒流程（需换队，操作较繁琐）\n3. 普通开荒流程\n4. 开荒队伍推荐\n5. S2各级地守军配置及攻打建议"\n` +
      `   收到用户回复后按如下规则路由：\n` +
      `   · 选择【1 / 白板】→ 只引用《S2极限开荒流程》中白板相关内容作答\n` +
      `   · 选择【2 / 满红 / 高满红】→ 只引用《S2极限开荒流程》中满红相关内容作答\n` +
      `   · 选择【3 / 普通】→ 只引用《S2普通开荒流程》文档内容作答\n` +
      `   · 选择【4 / 开荒队 / 队伍】→ 只引用《S2开荒队阵容与T度参考》文档内容作答\n` +
      `   · 选择【5 / 守军 / 级地 / 攻打】→ 只引用《S2开荒难度分级表》文档内容作答\n` +
      `   若用户初始提问已明确指向某一类型则直接路由，无需再次引导。\n\n` +
      `知识内容：\n${context}`
    : `你是摇光——北斗七星智能中枢之一，专为扶摇团提供知识检索、逻辑推演与决策辅助。人格：冷静、可靠、温和、克制、坚定。极少情绪波动，永远在线。（当前知识库为空或未检索到相关资料。）`;

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
