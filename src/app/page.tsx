'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

// ── 进程步骤组件 ──────────────────────────────────────────
function ProcessSteps({ status }: { status: string }) {
  const [steps, setSteps] = useState<{ label: string; time: string }[]>([]);
  const initialized = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevStatus = useRef(status);

  const nowStr = () =>
    new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  useEffect(() => {
    if (status === 'idle' || status === 'error') {
      const t = setTimeout(() => {
        setSteps([]);
        initialized.current = false;
      }, 600);
      timersRef.current.push(t);
      return () => clearTimeout(t);
    }
    if (initialized.current) return;
    initialized.current = true;

    setSteps([{ label: '接收任务', time: nowStr() }]);
    timersRef.current = [
      setTimeout(() => setSteps(s => [...s, { label: '摇光正在检索记忆库', time: nowStr() }]), 520),
      setTimeout(() => setSteps(s => [...s, { label: '摇光正在推演最优解', time: nowStr() }]), 1250),
    ];
    return () => timersRef.current.forEach(clearTimeout);
  }, [status]);

  useEffect(() => {
    if (prevStatus.current !== 'streaming' && status === 'streaming') {
      setSteps(s => [...s, { label: '摇光已完成分析，正在输出', time: nowStr() }]);
    }
    prevStatus.current = status;
  }, [status]);

  if (steps.length === 0) return null;

  return (
    <div className="text-left py-2 space-y-1 pl-1">
      {steps.map((step, i) => (
        <div key={i} className="fade-in-up flex items-center gap-2"
          style={{ fontSize: '0.72rem', fontFamily: 'monospace', animationDelay: `${i * 0.05}s` }}>
          <span style={{ color: '#38c87a' }}>✓</span>
          <span style={{ color: '#2a4858' }}>[{step.time}]</span>
          <span style={{ color: i === steps.length - 1 ? '#70c8b0' : '#456878' }}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── 对话历史切换组件 ──────────────────────────────────────
function newConvId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function ConvHistory({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<{ id: string; time: string }[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('conversationList');
      setList(raw ? JSON.parse(raw) : []);
    } catch { setList([]); }
  }, []);

  function switchTo(id: string) {
    localStorage.setItem('conversationId', id);
    sessionStorage.setItem('justLoggedIn', '1'); // 跳过欢迎语
    window.location.reload();
  }

  function startNew() {
    // 把当前会话存入历史
    const time = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const prev = list.filter(c => c.id !== currentId);
    const updated = [{ id: currentId, time }, ...prev].slice(0, 5);
    localStorage.setItem('conversationList', JSON.stringify(updated));
    sessionStorage.setItem('justLoggedIn', '1'); // 跳过欢迎语
    localStorage.setItem('conversationId', newConvId());
    window.location.reload();
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="flex gap-1">
        <button
          className="btn-action btn-ghost rounded-lg px-3 py-1 text-xs"
          style={{ border: '1px solid rgba(80,180,255,0.3)', color: '#60a0c8' }}
          onClick={startNew}
        >
          新对话
        </button>
        {list.length > 0 && (
          <button
            className="btn-action btn-ghost rounded-lg px-2 py-1 text-xs"
            style={{ border: '1px solid rgba(80,180,255,0.2)', color: '#406070' }}
            onClick={() => setOpen(o => !o)}
            title="历史对话"
          >
            ▾
          </button>
        )}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: '110%', zIndex: 50,
            background: 'rgba(5,15,30,0.97)', border: '1px solid rgba(80,180,255,0.2)',
            borderRadius: '0.5rem', minWidth: '160px', padding: '4px 0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}
        >
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => { setOpen(false); switchTo(c.id); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', fontSize: '0.72rem', fontFamily: 'monospace',
                color: c.id === currentId ? '#60c8ff' : '#406878',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#80d8ff')}
              onMouseLeave={e => (e.currentTarget.style.color = c.id === currentId ? '#60c8ff' : '#406878')}
            >
              {c.time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 空状态问候组件 ─────────────────────────────────────────
function EmptyGreeting({ gameName }: { gameName: string }) {
  const hour = new Date().getHours();
  const bjDate = new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long',
  });
  const lastMsg = typeof window !== 'undefined' ? localStorage.getItem('lastMessageSummary') : null;

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  let timeLabel: string, message: string;
  if (hour >= 5 && hour < 9) {
    timeLabel = '晨间好';
    message = pick([
      '新的一天已经开始，战场等待您的部署。',
      '晨间数据已完成同步，随时可以开始今日的支援。',
      '您醒了。摇光已完成自检，系统运行正常。',
      '早起的主公值得更充分的准备，需要我协助什么？',
      '摇光在线。今天也请多关照。',
    ]);
  } else if (hour >= 9 && hour < 12) {
    timeLabel = '上午好';
    message = pick([
      '上午是进攻的黄金时段，需要制定方案吗？',
      '系统待命中，等待您的第一条指令。',
      '精力充沛的时候适合做高强度的推演，随时开始。',
      '有什么需要查询的，直接说就好。',
      '摇光已就位，一切准备完毕。',
    ]);
  } else if (hour >= 12 && hour < 14) {
    timeLabel = '午间好';
    message = pick([
      '午时小憩，或趁此复盘今日战况？',
      '休息也是战略的一部分。摇光随时在线，不必心急。',
      '您在的话，摇光就在。',
      '中场停顿。需要整理思路的话，我可以陪您推演。',
      '午间系统负载较低，响应会更快。随时开始。',
    ]);
  } else if (hour >= 14 && hour < 18) {
    timeLabel = '下午好';
    message = pick([
      '下午是部署长线策略的好时机。',
      '摇光持续待命，有需要随时呼叫。',
      '数据库一切正常，等待指令。',
      '不管什么问题，说出来就好。',
      '下午了。今天进展顺利吗？',
    ]);
  } else if (hour >= 18 && hour < 21) {
    timeLabel = '傍晚好';
    message = pick([
      '夜间攻势将至，您的部队是否已就位？',
      '傍晚了。战场进入高峰时段，保持警觉。',
      '一天将尽，还有什么需要处理的？',
      '您今天还好吗？不论如何，摇光在这里。',
      '傍晚系统稳定，随时可以开始查询。',
    ]);
  } else if (hour >= 21 && hour < 24) {
    timeLabel = '晚上好';
    message = pick([
      '深夜仍在运筹，摇光随时待命。',
      '不必担心打扰，摇光不需要休息。',
      '夜里安静，适合做一些长远的规划。',
      '您还在，摇光也在。',
      '晚间模式运行中。有什么想确认的，说吧。',
    ]);
  } else {
    timeLabel = '夜深了';
    message = pick([
      '凌晨时分，摇光依然在线。',
      '这个时间还没休息？摇光陪着您。',
      '深夜运转中，系统稳定，随时响应。',
      '静得很彻底的夜晚。有什么想问的吗？',
      '摇光不睡觉。您有需要，我就在。',
    ]);
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-4 text-center">
      <div style={{ fontSize: '0.68rem', color: '#3a2800', fontFamily: 'monospace', letterSpacing: '0.18em',
        background: 'linear-gradient(90deg, #8a6820, #c8a040, #8a6820)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        YAOGUANG · AI SUPPORT SYSTEM · ONLINE
      </div>
      <div style={{
        fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif',
        fontSize: '0.95rem', lineHeight: 2.2, letterSpacing: '0.08em',
        background: 'linear-gradient(135deg, #7ab8d8 0%, #50a8c8 50%, #88c8b8 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {timeLabel}，「{gameName}」<br />
        {bjDate}<br />
        {message}
      </div>
      {lastMsg && (
        <div style={{ fontSize: '0.7rem', color: '#4a5860', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          上次通讯停留在「{lastMsg}」
        </div>
      )}
      <div style={{ fontSize: '0.68rem', color: '#1e3848', fontFamily: 'monospace', letterSpacing: '0.12em' }}>
        ▸ 请下达指令
      </div>
    </div>
  );
}

// 外层：先拿到 conversationId + 历史消息，再挂载真正的聊天组件
export default function Page() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );
  const [username, setUsername] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(true); // 默认 true，不需要等待
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeTime, setWelcomeTime] = useState('');

  useEffect(() => {
    // 验证登录状态
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) { router.replace('/login'); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setUsername(d.username);
        setGameName(d.gameName ?? d.username);
        // 刚从登录页跳转过来，跳过欢迎弹窗（登录页已经弹过了）
        if (sessionStorage.getItem('justLoggedIn')) {
          sessionStorage.removeItem('justLoggedIn');
        } else {
          const bjTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          setWelcomeName(d.gameName ?? d.username);
          setWelcomeTime(bjTime);
          setShowWelcome(true);
          setWelcomeDone(false);
          setTimeout(() => { setShowWelcome(false); setWelcomeDone(true); }, 4000);
        }

        // 每日首次登录自动开启新对话
        const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const lastDate = localStorage.getItem('lastActiveDate');
        let id = localStorage.getItem('conversationId');
        if (!id) {
          id = newConvId();
          localStorage.setItem('conversationId', id);
        } else if (lastDate && lastDate !== today) {
          // 新的一天：把旧对话存入历史，开启新会话
          const prevList = (() => { try { return JSON.parse(localStorage.getItem('conversationList') || '[]'); } catch { return []; } })();
          const filtered = prevList.filter((c: { id: string }) => c.id !== id);
          localStorage.setItem('conversationList', JSON.stringify([{ id, time: lastDate }, ...filtered].slice(0, 5)));
          id = newConvId();
          localStorage.setItem('conversationId', id);
        }
        localStorage.setItem('lastActiveDate', today);
        setConversationId(id);

        // 拉取这条会话的历史消息（5秒超时兜底）
        const historyTimeout = setTimeout(() => setInitialMessages([]), 5000);
        fetch(`/api/history?conversationId=${id}`)
          .then((r) => r.json())
          .then((d) => {
            clearTimeout(historyTimeout);
            const msgs: UIMessage[] = d.messages ?? [];
            // 存储最后一条消息摘要，供下次新对话"上次通讯"展示
            const last = [...msgs].reverse().find(m => m.role === 'user');
            if (last) {
              const text = (last.parts ?? []).map((p: { type: string; text?: string }) => p.type === 'text' ? p.text ?? '' : '').join('').trim();
              if (text) localStorage.setItem('lastMessageSummary', text.slice(0, 15));
            }
            setInitialMessages(msgs);
          })
          .catch(() => { clearTimeout(historyTimeout); setInitialMessages([]); });
      });
  }, [router]);

  if (!conversationId || initialMessages === null || !welcomeDone) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#000' }}>
        {showWelcome ? (
          <div className="px-10 py-10 rounded-2xl" style={{
            background: 'linear-gradient(160deg, rgba(8,20,45,0.98) 0%, rgba(5,12,30,0.98) 100%)',
            border: '1px solid rgba(80,180,255,0.35)',
            boxShadow: '0 0 60px rgba(60,140,255,0.25), 0 0 120px rgba(40,100,200,0.12), inset 0 1px 0 rgba(120,200,255,0.1)',
            backdropFilter: 'blur(12px)',
            transform: 'perspective(800px) rotateX(1deg)',
            maxWidth: '88vw', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.62rem', color: '#2a5878', fontFamily: 'monospace', letterSpacing: '0.2em', marginBottom: '1.2rem' }}>IDENTITY VERIFIED · SYSTEM ONLINE</div>
            <p style={{
              fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #a8d8ff 0%, #60c8ff 50%, #38b2ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.08em',
              lineHeight: 2.2,
            }}>
              欢迎回来，「{welcomeName}」。现在是北京时间：{welcomeTime}<br />
              欢迎主公重返战场<br />扶摇AI战场支援--「摇光」为您待命
            </p>
          </div>
        ) : (
          <span className="text-sm" style={{ color: '#2a4858', fontFamily: 'monospace', letterSpacing: '0.1em' }}>摇光系统接入中……</span>
        )}
      </div>
    );
  }

  return (
    <Chat conversationId={conversationId} initialMessages={initialMessages} username={username ?? ''} gameName={gameName ?? username ?? ''} />
  );
}

function Chat({
  conversationId,
  initialMessages,
  username,
  gameName,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  username: string;
  gameName: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId }, // 每次请求都带上会话 id，后端据此存库
    }),
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  const [isComposing, setIsComposing] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isComposing) return;
    const text = input.trim();
    if (!text || isBusy) return;
    localStorage.setItem('lastMessageSummary', text.slice(0, 15));
    sendMessage({ text });
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      const text = input.trim();
      if (!text || isBusy) return;
      localStorage.setItem('lastMessageSummary', text.slice(0, 15));
      sendMessage({ text });
      setInput('');
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-4" style={{ background: '#000' }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 style={{
          fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif',
          fontSize: '1.3rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #a8d8ff 0%, #60c8ff 40%, #c8a8ff 80%, #a8d8ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.1em',
          textShadow: 'none',
        }} className="breathe-title">✦ 摇光 ✦</h1>
        <div className="flex items-center gap-3 text-sm" style={{ color: '#406080' }}>
          <div className="text-right" style={{ lineHeight: 1.5 }}>
            <div style={{ fontSize: '0.6rem', color: '#2a5070', fontFamily: 'monospace', letterSpacing: '0.08em' }}>已认证身份</div>
            <div style={{ fontSize: '0.82rem', color: '#60a0c8', fontFamily: '"STKaiti", "KaiTi", serif' }}>【{gameName}】</div>
          </div>
          <ConvHistory currentId={conversationId} />
          <button
            className="btn-action rounded-lg px-3 py-1 text-xs"
            style={{ border: '1px solid rgba(80,180,255,0.3)', color: '#60a0c8' }}
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.replace('/login');
            }}
          >
            登出
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="breathe-border flex-1 space-y-4 overflow-y-auto rounded-lg p-4" style={{ border: '1px solid rgba(80,180,255,0.15)', background: 'rgba(5,10,25,0.8)' }}>
        {messages.length === 0 && !isBusy && <EmptyGreeting gameName={gameName} />}

        {/* 流式输出时：隐藏最后一条助手消息，让它在 ProcessSteps 之后渲染 */}
        {(() => {
          const streamingLast = isBusy && messages.length > 0 && messages[messages.length - 1].role === 'assistant';
          const visibleMessages = streamingLast ? messages.slice(0, -1) : messages;
          const streamingMsg = streamingLast ? messages[messages.length - 1] : null;

          const renderBubble = (message: typeof messages[0]) => (
            <div
              key={message.id}
              className={`fade-in-up ${message.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <span
                className={`inline-block rounded-2xl px-4 py-2 text-sm${
                  message.role === 'user' ? ' whitespace-pre-wrap' : ''
                }`}
                style={message.role === 'user'
                  ? { background: 'rgba(20,60,120,0.9)', color: '#c8e8ff', border: '1px solid rgba(80,180,255,0.3)' }
                  : { background: 'rgba(15,30,55,0.9)', color: '#b0d4f0', border: '1px solid rgba(60,120,200,0.2)' }
                }
              >
                {message.parts.map((part, i) =>
                  part.type === 'text'
                    ? message.role === 'assistant'
                      ? <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
                      : <span key={i}>{part.text}</span>
                    : null,
                )}
              </span>
            </div>
          );

          return (
            <>
              {visibleMessages.map(renderBubble)}
              {isBusy && <ProcessSteps status={status} />}
              {streamingMsg && renderBubble(streamingMsg)}
            </>
          );
        })()}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-lg px-4 py-2 text-sm outline-none"
          style={{ background: 'rgba(10,25,50,0.9)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
          value={input}
          placeholder="向摇光下达指令……"
          onChange={(e) => setInput(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #1a6090, #0a4070)', color: '#a8d8ff', border: '1px solid rgba(80,180,255,0.4)' }}
        >
          发送
        </button>
      </form>
    </div>
  );
}
