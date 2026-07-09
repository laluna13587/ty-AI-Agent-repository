'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

// 外层：先拿到 conversationId + 历史消息，再挂载真正的聊天组件
export default function Page() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );
  const [username, setUsername] = useState<string | null>(null);
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

        // 每个浏览器一个会话 id，存在 localStorage，刷新后不变
        let id = localStorage.getItem('conversationId');
        if (!id) {
          id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
          localStorage.setItem('conversationId', id);
        }
        setConversationId(id);

        // 拉取这条会话的历史消息（5秒超时兜底）
        const historyTimeout = setTimeout(() => setInitialMessages([]), 5000);
        fetch(`/api/history?conversationId=${id}`)
          .then((r) => r.json())
          .then((d) => { clearTimeout(historyTimeout); setInitialMessages(d.messages ?? []); })
          .catch(() => { clearTimeout(historyTimeout); setInitialMessages([]); });
      });
  }, [router]);

  if (!conversationId || initialMessages === null || !welcomeDone) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#000' }}>
        {showWelcome ? (
          <p style={{
            fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif',
            fontSize: '1.35rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #a8d8ff 0%, #60c8ff 50%, #38b2ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.08em',
            lineHeight: 2,
            textAlign: 'center',
          }}>
            您好，「{welcomeName}」。现在是北京时间：{welcomeTime}<br />
            欢迎主公重返战场<br />扶摇AI战场支援--「摇光」为您待命
          </p>
        ) : (
          <span className="text-sm text-gray-400">加载中……</span>
        )}
      </div>
    );
  }

  return (
    <Chat conversationId={conversationId} initialMessages={initialMessages} username={username ?? ''} />
  );
}

function Chat({
  conversationId,
  initialMessages,
  username,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  username: string;
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
    sendMessage({ text });
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      const text = input.trim();
      if (!text || isBusy) return;
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
        }}>✦ 摇光 ✦</h1>
        <div className="flex items-center gap-3 text-sm" style={{ color: '#406080' }}>
          <span style={{ color: '#60a0c8' }}>{username}</span>
          <button
            className="rounded-lg px-3 py-1 text-xs"
            style={{ border: '1px solid rgba(80,180,255,0.3)', color: '#60a0c8' }}
            onClick={() => {
              const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
              });
              localStorage.setItem('conversationId', newId);
              window.location.reload();
            }}
          >
            新对话
          </button>
          <button
            className="rounded-lg px-3 py-1 text-xs"
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
      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg p-4" style={{ border: '1px solid rgba(80,180,255,0.15)', background: 'rgba(5,10,25,0.8)' }}>
        {messages.length === 0 && (
          <p className="text-sm" style={{ color: '#406080' }}>开始提问吧……</p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'text-right' : 'text-left'}
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
        ))}

        {status === 'submitted' && (
          <p className="text-sm" style={{ color: '#406080' }}>思考中……</p>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-lg px-4 py-2 text-sm outline-none"
          style={{ background: 'rgba(10,25,50,0.9)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
          value={input}
          placeholder="输入消息，回车发送"
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
