import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import { Button } from './button';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (auth: { type: 'basic' | 'bearer', loginUrl?: string, username?: string, password?: string, token?: string }) => void;
  error?: string;
}

export function LoginModal({ open, onClose, onLogin, error }: LoginModalProps) {
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [authType, setAuthType] = useState<'basic' | 'bearer'>('basic');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <Card className="w-[370px] shadow-2xl rounded-xl border border-neutral-700 bg-background">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-lg font-semibold">🔒 Login Required</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 mb-3 justify-center">
              <Button
                variant={authType === 'basic' ? 'default' : 'outline'}
                className={authType === 'basic' ? 'font-bold ring-2 ring-primary' : ''}
                size="sm"
                onClick={() => setAuthType('basic')}
                disabled={submitting}
              >Basic Auth</Button>
              <Button
                variant={authType === 'bearer' ? 'default' : 'outline'}
                className={authType === 'bearer' ? 'font-bold ring-2 ring-primary' : ''}
                size="sm"
                onClick={() => setAuthType('bearer')}
                disabled={submitting}
              >Bearer/JWT</Button>
            </div>
            <div className="border-b border-muted mb-2" />
            <div className="flex gap-2 mb-2">
              <Button
                variant={authType === 'basic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAuthType('basic')}
                disabled={submitting}
              >Basic Auth</Button>
              <Button
                variant={authType === 'bearer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAuthType('bearer')}
                disabled={submitting}
              >Bearer/JWT</Button>
            </div>
            {authType === 'basic' ? (
              <>
                <input
                  type="text"
                  className="input input-bordered w-full mb-2 px-3 py-2 rounded"
                  placeholder="Login API URL"
                  value={loginUrl}
                  onChange={e => setLoginUrl(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
                <input
                  type="text"
                  className="input input-bordered w-full mb-2 px-3 py-2 rounded"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={submitting}
                />
                <input
                  type="password"
                  className="input input-bordered w-full mb-2 px-3 py-2 rounded"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </>
            ) : (
              <input
                type="text"
                className="input input-bordered w-full mb-2 px-3 py-2 rounded"
                placeholder="Paste Bearer/JWT Token"
                value={token}
                onChange={e => setToken(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            )}
            {error && <div className="text-destructive text-base font-semibold text-center mt-2">{error}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button
                className="font-bold"
                onClick={async () => {
                  setSubmitting(true);
                  if (authType === 'basic') {
                    await onLogin({ type: 'basic', loginUrl, username, password });
                  } else {
                    await onLogin({ type: 'bearer', token });
                  }
                  setSubmitting(false);
                }}
                disabled={submitting || (authType === 'basic' ? (!username || !password) : !token)}
              >
                {submitting ? (authType === 'bearer' ? 'Saving...' : 'Logging in...') : (authType === 'bearer' ? 'Save Token' : 'Login')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
