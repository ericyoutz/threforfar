'use client';

import { useState } from 'react';

export default function LoginView() {
  const [mode, setMode] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPassword, setRequestPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Login failed.');
        return;
      }

      window.location.href = '/app';
    } catch {
      setError('Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestAccess() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/account-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: requestName,
          email: requestEmail,
          password: requestPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Request failed.');
        return;
      }

      setMessage('Account request submitted. Sign in as Admin to approve it.');
      setRequestName('');
      setRequestEmail('');
      setRequestPassword('');
    } catch {
      setError('Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="pill">Private Roleplay Writing Platform</div>
        <h1>Threforfar</h1>
        <p>
          Multi-user, persistent, administrator-controlled collaborative writing. The layout, styling,
          and workflow match the demo while saving shared data in the database.
        </p>
        <div className="feature-grid">
          <div className="feature">
            <strong>Admin control</strong>
            <span className="muted">The admin creates rooms and decides who can enter them.</span>
          </div>
          <div className="feature">
            <strong>Private rooms</strong>
            <span className="muted">Writers only see rooms they were assigned to.</span>
          </div>
          <div className="feature">
            <strong>Account requests</strong>
            <span className="muted">Anyone can request access. The admin must approve them.</span>
          </div>
          <div className="feature">
            <strong>Shared data</strong>
            <span className="muted">Rooms, messages, approvals, and announcements are saved for everyone.</span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="tabs">
          <button type="button" className={`tab ${mode === 'login' ? 'btn-primary active' : ''}`} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button type="button" className={`tab ${mode === 'request' ? 'btn-primary active' : ''}`} onClick={() => setMode('request')}>
            Request account
          </button>
        </div>

        {mode === 'login' ? (
          <div className="stack">
            <div>
              <label>Email</label>
              <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@ee.com" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your password" />
            </div>
            <button type="button" className="btn-primary btn-full" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Enter workspace'}
            </button>
            <div className="small">Default admin login: admin@ee.com / 1234</div>
          </div>
        ) : (
          <div className="stack">
            <div>
              <label>Name</label>
              <input value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="Your writer name" />
            </div>
            <div>
              <label>Email</label>
              <input value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" value={requestPassword} onChange={(e) => setRequestPassword(e.target.value)} placeholder="Create a password" />
            </div>
            <button type="button" className="btn-primary btn-full" onClick={handleRequestAccess} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit account request'}
            </button>
          </div>
        )}

        {error ? <div className="notice">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}
      </section>
    </div>
  );
}
