'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeTime, setWelcomeTime] = useState('');
  // 注册第二步：游戏名弹窗
  const [showGameNamePrompt, setShowGameNamePrompt] = useState(false);
  const [gameName, setGameName] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('savedCredentials');
      if (saved) {
        const { u, p } = JSON.parse(saved);
        setUsername(u ?? '');
        setPassword(atob(p ?? ''));
        setRememberMe(true);
      }
    } catch { /* 忽略损坏的缓存 */ }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'login') {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setMessage({ text: data.error ?? '操作失败', ok: false }); return; }
      if (rememberMe) {
        localStorage.setItem('savedCredentials', JSON.stringify({ u: username, p: btoa(password) }));
      } else {
        localStorage.removeItem('savedCredentials');
      }
      const bjTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setWelcomeName(data.gameName ?? data.username);
      setWelcomeTime(bjTime);
      setShowWelcome(true);
      sessionStorage.setItem('justLoggedIn', '1');
      setTimeout(() => { router.push('/'); router.refresh(); }, 4000);
    } else {
      // 注册第一步：先收集身份标识和密钥，弹出第二步询问游戏名
      if (username.length < 2) {
        setMessage({ text: '成员身份标识至少 2 个字符', ok: false });
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setMessage({ text: '通行密钥至少 6 位', ok: false });
        setLoading(false);
        return;
      }
      setPendingUsername(username);
      setPendingPassword(password);
      setLoading(false);
      setShowGameNamePrompt(true);
    }
  }

  async function handleGameNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: pendingUsername, password: pendingPassword, gameName }),
    });
    const data = await res.json();
    setLoading(false);
    setShowGameNamePrompt(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? '注册失败', ok: false });
      return;
    }
    setMessage({ text: data.message, ok: true });
    setMode('login');
    setPassword('');
    setGameName('');
  }

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#000' }}>

      {/* 登录成功欢迎消息 */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)' }}>
          <div className="text-center px-10 py-10 rounded-2xl" style={{
            background: 'linear-gradient(160deg, rgba(8,20,45,0.98) 0%, rgba(5,12,30,0.98) 100%)',
            border: '1px solid rgba(80,180,255,0.35)',
            boxShadow: '0 0 60px rgba(60,140,255,0.25), 0 0 120px rgba(40,100,200,0.12), inset 0 1px 0 rgba(120,200,255,0.1)',
            backdropFilter: 'blur(12px)',
            transform: 'perspective(800px) rotateX(1deg)',
            maxWidth: '88vw',
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
        </div>
      )}

      {/* 游戏名确认弹窗 */}
      {showGameNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: 'rgba(10,20,40,0.98)', border: '1px solid rgba(100,200,255,0.3)', boxShadow: '0 0 60px rgba(80,180,255,0.2)' }}>
            <h2 className="mb-2 text-center text-base font-semibold" style={{ color: '#a8d8ff', fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif', letterSpacing: '0.05em' }}>
              最后一步
            </h2>
            <p className="mb-6 text-center text-sm" style={{ color: '#60a0c8' }}>
              请输入您的游戏名（无需扶摇前缀）或惯用称呼，此名称将作为摇光对您的专属称谓
            </p>
            <form onSubmit={handleGameNameSubmit} className="space-y-4">
              <input
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'rgba(20,40,70,0.8)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="例：摇光"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2 text-sm font-medium disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #1a6090, #0a4070)', color: '#a8d8ff', border: '1px solid rgba(80,180,255,0.4)' }}
              >
                {loading ? '提交中…' : '确认'}
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: 'rgba(10,20,40,0.95)', border: '1px solid rgba(100,200,255,0.2)', boxShadow: '0 0 40px rgba(80,180,255,0.15)' }}>
        <h1 className="mb-2 text-center" style={{ fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif', fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(135deg, #a8d8ff 0%, #60c8ff 50%, #38b2ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: 'none', letterSpacing: '0.05em' }}>
          {mode === 'login' ? (
            <>欢迎加入扶摇团<br />我是天弈/扶摇AI战场支援--<br />「摇光」</>
          ) : <span style={{ WebkitTextFillColor: '#a8d8ff' }}>注册账号</span>}
        </h1>
        {mode === 'login' && (
          <p className="mb-6 text-center text-sm" style={{ color: '#60a0c8', fontFamily: '"STKaiti", "KaiTi", "华文楷体", serif', letterSpacing: '0.05em' }}>
            愿以星辉为引，与您共谋胜局
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm" style={{ color: '#60a0c8' }}>成员身份标识</label>
            {mode === 'register' && (
              <p className="mb-1 text-xs" style={{ color: '#4a7a9b' }}>请填写您的微信号，将作为您在系统中的唯一身份标识</p>
            )}
            <input
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'rgba(20,40,70,0.8)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'register' ? '请输入微信号' : ''}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm" style={{ color: '#60a0c8' }}>通行密钥</label>
            {mode === 'register' && (
              <p className="mb-1 text-xs" style={{ color: '#4a7a9b' }}>密码仅用于身份验证，如需修改可联系管理员</p>
            )}
            <input
              type="password"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'rgba(20,40,70,0.8)', border: '1px solid rgba(80,180,255,0.3)', color: '#c8e8ff' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '请设置新密码' : ''}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {message && (
            <p className={`text-sm ${message.ok ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}

          {mode === 'login' && (
            <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: '#60a0c8' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded"
                style={{ accentColor: '#60c8ff' }}
              />
              <span className="text-xs">记住账号密码</span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #1a6090, #0a4070)', color: '#a8d8ff', border: '1px solid rgba(80,180,255,0.4)' }}
          >
            {loading ? '核验中…' : mode === 'login' ? '接入' : '注册'}
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
          <>
            <p className="mt-3 text-center text-xs text-gray-400">
              注册后需管理员审批方可使用
            </p>
            <p className="mt-2 text-center text-xs" style={{ color: '#e08060' }}>
              请确保身份标识与您的微信号完全一致，否则审核将不予通过
            </p>
          </>
        )}
      </div>
    </div>
  );
}
