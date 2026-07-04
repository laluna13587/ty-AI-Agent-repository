'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 外层：先拿到 conversationId + 历史消息，再挂载真正的聊天组件
export default function Page() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );
  const [username, setUsername] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
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
          setTimeout(() => setShowWelcome(false), 2500);
        }

        // 每个浏览器一个会话 id，存在 localStorage，刷新后不变
        let id = localStorage.getItem('conversationId');
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem('conversationId', id);
        }
        setConversationId(id);

        // 拉取这条会话的历史消息
        fetch(`/api/history?conversationId=${id}`)
          .then((r) => r.json())
          .then((d) => setInitialMessages(d.messages ?? []))
          .catch(() => setInitialMessages([]));
      });
  }, [router]);

  if (!conversationId || initialMessages === null) {
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
            欢迎主公重返战场<br />天弈AI助手--「摇光」为您待命
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput('');
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">RAG 助手</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{username}</span>
          <button
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
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
      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">开始提问吧……</p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'text-right' : 'text-left'}
          >
            <span
              className={
                'inline-block whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ' +
                (message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100')
              }
            >
              {message.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null,
              )}
            </span>
          </div>
        ))}

        {status === 'submitted' && (
          <p className="text-sm text-gray-400">思考中……</p>
        )}
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900"
          value={input}
          placeholder="输入消息，回车发送"
          onChange={(e) => setInput(e.target.value)}
          disabled={isBusy}
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          发送
        </button>
      </form>
    </div>
  );
}
