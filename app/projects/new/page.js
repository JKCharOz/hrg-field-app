'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewProjectWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <NewProjectPage />
    </Suspense>
  )
}

function NewProjectPage() {
  var router = useRouter()
  var [orgId, setOrgId] = useState(null)
  var [saving, setSaving] = useState(false)
  var [error, setError] = useState(null)
  var [form, setForm] = useState({
    project_name: '',
    project_number: '',
    owner: '',
    contractor: '',
      })

  useEffect(function() {
    loadProfile()
  }, [])

  async function loadProfile() {
    var authResult = await supabase.auth.getUser()
    if (authResult.error || !authResult.data.user) { router.push('/login'); return }
    var profResult = await supabase.from('users').select('org_id').eq('id', authResult.data.user.id).single()
    if (!profResult.error && profResult.data) { setOrgId(profResult.data.org_id) }
  }

  function setField(key, value) {
    setForm(function(prev) { return Object.assign({}, prev, { [key]: value }) })
  }

  async function handleSave() {
    if (!form.project_name.trim()) { setError('Project Name is required.'); return }
    if (!orgId) { setError('Profile not loaded. Please try again.'); return }
    setSaving(true)
    setError(null)
    var payload = {
      org_id: orgId,
      project_name: form.project_name.trim(),
      project_number: form.project_number.trim() || null,
      owner: form.owner.trim() || null,
      general_contractor: form.contractor.trim() || null,
    }
    var result = await supabase.from('projects').insert(payload).select().single()
    setSaving(false)
    if (result.error) { setError('Failed to create project: ' + result.error.message); return }
    router.push('/projects')
  }

  function Field(fp) {
    return (
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">
          {fp.label}{fp.required && <span className="text-orange-400 ml-1">*</span>}
        </p>
        <input
          type={fp.type || 'text'}
          value={form[fp.field]}
          onChange={function(e) { setField(fp.field, e.target.value) }}
          placeholder={fp.placeholder || ''}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700">
        <button onClick={function() { router.back() }} className="text-orange-400 text-sm">Cancel</button>
        <p className="text-white text-sm font-semibold">New Project</p>
        <button onClick={handleSave} disabled={saving || !form.project_name.trim()}
          className="text-orange-400 text-sm font-semibold disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{error}</p>}

        <Field field="project_name" label="Project Name" required={true} placeholder="e.g. Main Street Sewer Replacement" />
        <Field field="project_number" label="Project Number" placeholder="e.g. 2024-001" />
        <Field field="owner" label="Owner" placeholder="e.g. Capital Region Water" />
        <Field field="contractor" label="Contractor" placeholder="e.g. Rogele Inc." />

        <button onClick={handleSave} disabled={saving || !form.project_name.trim()}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-40 transition-colors mt-4">
          {saving ? 'Creating Project...' : 'Create Project'}
        </button>
      </div>
    </div>
  )
}
