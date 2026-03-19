'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SettingsWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <SettingsPage />
    </Suspense>
  )
}

function SettingsPage() {
  var router = useRouter()
  var [profile, setProfile] = useState(null)
  var [email, setEmail] = useState('')
  var [sending, setSending] = useState(false)
  var [invites, setInvites] = useState([])
  var [message, setMessage] = useState(null)

  useEffect(function() { loadData() }, [])

  async function loadData() {
    var authResult = await supabase.auth.getUser()
    if (authResult.error || !authResult.data.user) { router.push('/login'); return }
    var profResult = await supabase.from('users').select('id, org_id, email').eq('id', authResult.data.user.id).single()
    if (profResult.data) {
      setProfile(profResult.data)
      var invResult = await supabase.from('org_invites').select('*').eq('org_id', profResult.data.org_id).order('created_at', { ascending: false })
      if (!invResult.error) { setInvites(invResult.data || []) }
    }
  }

  async function handleInvite() {
    if (!email.trim() || sending || !profile) return
    setSending(true)
    setMessage(null)
    var existing = await supabase.from('org_invites').select('id').eq('email', email.trim().toLowerCase()).eq('org_id', profile.org_id).maybeSingle()
    if (existing.data) { setMessage({ type: 'error', text: 'This email has already been invited.' }); setSending(false); return }
    var result = await supabase.from('org_invites').insert({
      org_id: profile.org_id,
      email: email.trim().toLowerCase(),
      invited_by: profile.id,
      status: 'pending',
    })
    setSending(false)
    if (result.error) { setMessage({ type: 'error', text: 'Failed to send invite.' }); return }
    setEmail('')
    setMessage({ type: 'success', text: 'Invite created. Share the app link and have them sign up with this email.' })
    loadData()
  }

  async function handleDelete(id) {
    await supabase.from('org_invites').delete().eq('id', id)
    setInvites(function(prev) { return prev.filter(function(i) { return i.id !== id }) })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700">
        <button onClick={function() { router.back() }} className="text-orange-400 text-sm">Back</button>
        <p className="text-white text-sm font-semibold">Settings</p>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-6 pb-24">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
          <p className="text-slate-200 font-semibold">Invite User</p>
          <p className="text-slate-500 text-xs">Enter their email. They must sign up with the same email to join your organization.</p>
          {message && (
            <p className={'text-sm px-3 py-2 rounded-lg ' + (message.type === 'error' ? 'text-red-400 bg-red-900/20' : 'text-green-400 bg-green-900/20')}>{message.text}</p>
          )}
          <input type="email" value={email} onChange={function(e) { setEmail(e.target.value) }}
            placeholder="colleague@hrg.com"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500" />
          <button onClick={handleInvite} disabled={!email.trim() || sending}
            className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
            {sending ? 'Sending...' : 'Create Invite'}
          </button>
        </div>

        {invites.length > 0 && (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Pending Invites</p>
            {invites.map(function(inv) {
              return (
                <div key={inv.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-slate-200 text-sm">{inv.email}</p>
                    <p className={'text-xs mt-0.5 ' + (inv.status === 'accepted' ? 'text-green-400' : 'text-slate-500')}>{inv.status}</p>
                  </div>
                  {inv.status === 'pending' && (
                    <button onClick={function() { handleDelete(inv.id) }} className="text-slate-600 active:text-red-400 text-xs">Remove</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
