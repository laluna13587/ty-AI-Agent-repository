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
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="mb-6 text-center text-xl font-semibold">
          {mode === 'login' ? '登录 RAG 助手' : '注册账号'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">用户名</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">密码</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>
              没有账号？{' '}
              <button className="text-blue-600 hover:underline" onClick={() => { setMode('register'); setMessage(null); }}>
                注册
              </button>
            </>
          ) : (
            <>
              已有账号？{' '}
              <button className="text-blue-600 hover:underline" onClick={() => { setMode('login'); setMessage(null); }}>
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
