'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage({ text: data.error ?? '操作失败', ok: false });
      return;
    }

    if (mode === 'login') {
      router.push('/');
      router.refresh();
    } else {
      setMessage({ text: data.message, ok: true });
      setMode('login');
      setPassword('');
    }
  }

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#000' }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: 'rgba(10,20,40,0.95)', border: '1px solid rgba(100,200,255,0.2)', boxShadow: '0 0 40px rgba(80,180,255,0.15)' }}>
        <h1 className="mb-2 text-center" style={{ fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif', fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(135deg, #a8d8ff 0%, #60c8ff 50%, #38b2ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: 'none', letterSpacing: '0.05em' }}>
          {mode === 'login' ? (
            <>欢迎加入天弈团，<br />我是天弈AI助手--「摇光」。</>
          ) : <span style={{ WebkitTextFillColor: '#a8d8ff' }}>注册账号</span>}
        </h1>
        {mode === 'login' && (
          <p className="mb-6 text-center text-sm" style={{ color: '#60a0c8', fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif', letterSpacing: '0.05em' }}>
            愿以星辉为引，与您共谋胜局。
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm" style={{ color: '#60a0c8' }}>用户名</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'rgba(20,40,70,0.8)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm" style={{ color: '#60a0c8' }}>密码</label>
            <input
              type="password"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'rgba(20,40,70,0.8)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #1a6090, #0a4070)', color: '#a8d8ff', border: '1px solid rgba(80,180,255,0.4)' }}
          >
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: '#406080' }}>
          {mode === 'login' ? (
            <>
              没有账号？{' '}
              <button style={{ color: '#60c8ff' }} className="hover:underline" onClick={() => { setMode('register'); setMessage(null); }}>
                注册
              </button>
            </>
          ) : (
            <>
              已有账号？{' '}
              <button style={{ color: '#60c8ff' }} className="hover:underline" onClick={() => { setMode('login'); setMessage(null); }}>
                登录
              </button>
            </>
          )}
        </p>

        {mode === 'register' && (
          <p className="mt-3 text-center text-xs text-gray-400">
            注册后需管理员审批方可使用
          </p>
        )}
      </div>
    </div>
  );
}
