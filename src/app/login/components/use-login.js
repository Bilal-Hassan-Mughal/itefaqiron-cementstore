'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isHqUser } from '@/lib/branch-roles';
import { setActiveBranch, clearActiveBranch, setHqPosMode } from '@/lib/branch-client';

export function useLoginRedirect() {
  const router = useRouter();

  return useCallback((user) => {
    localStorage.setItem('user', JSON.stringify(user));
    if (isHqUser(user)) {
      clearActiveBranch();
      setHqPosMode(false);
      router.push('/dashboard/hq');
    } else if (user.branch) {
      setActiveBranch(user.branch);
      router.push('/dashboard');
    } else if (user.branch_id) {
      setActiveBranch({
        branch_id: user.branch_id,
        branch_name: user.branch?.branch_name || 'Branch',
        branch_code: user.branch?.branch_code || '',
      });
      router.push('/dashboard');
    } else {
      router.push('/dashboard');
    }
  }, [router]);
}

export function useAuthLogin(loginMode) {
  const redirectAfterLogin = useLoginRedirect();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password.');
      return;
    }
    if (loginMode === 'branch' && !branchCode.trim()) {
      setError('Please select your branch.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          login_mode: loginMode,
          branch_code: loginMode === 'branch' ? branchCode.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.user) {
        localStorage.setItem('login_mode', loginMode);
        redirectAfterLogin(data.user);
      } else {
        setError(data.error || 'Invalid email or password.');
      }
    } catch {
      setError('Network error. Please try again.');
    }

    setLoading(false);
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    branchCode,
    setBranchCode,
    showPassword,
    setShowPassword,
    error,
    loading,
    handleSubmit,
  };
}

/** Redirect away from login/landing if session exists */
export function useSessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    try {
      const u = JSON.parse(userData);
      if (!u?.user_id) return;
      if (isHqUser(u)) router.replace('/dashboard/hq');
      else router.replace('/dashboard');
    } catch { /* ignore */ }
  }, [router]);
}
