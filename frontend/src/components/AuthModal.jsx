import React, { useState } from 'react';
import { CloseIcon } from './Icons.jsx';
import { apiUrl } from '../config/api.js';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, onNotify }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (tab === 'login') {
      if (!loginId.trim() || !password) {
        setError('Please enter your username/email and password.');
        return;
      }
    } else {
      if (!username.trim() || !email.trim() || !password) {
        setError('Please fill in all fields.');
        return;
      }
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        tab === 'login'
          ? { loginId: loginId.trim(), password }
          : { username: username.trim(), email: email.trim(), password };

      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      onAuthSuccess(data);
      onNotify(tab === 'login' ? `Welcome back, ${data.user.username}!` : `Account created! Welcome, ${data.user.username}!`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {tab === 'login' ? 'Sign in to Bintube' : 'Create an Account'}
          </h2>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setError('');
            }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="form-error-alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === 'login' ? (
            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter username or email"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="your.email@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder={tab === 'login' ? 'Enter password' : 'At least 6 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
