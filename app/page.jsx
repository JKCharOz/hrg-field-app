'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Login failed. Check your email and password.')
    } else {
      window.location.href = '/projects'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0f2744] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-white text-3xl font-bold mb-2">HRG Field App</h1>
        <p className="text-blue-300 text-sm mb-10">Daily Observation Reports</p>

        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-xl text-lg bg-white/10 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:border-blue-400"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-4 rounded-xl text-lg bg-white/10 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:border-blue-400"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white text-xl font-bold rounded-xl mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}
