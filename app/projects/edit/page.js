'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Field(fp) {
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">
        {fp.label}{fp.required && <span className="text-orange-400 ml-1">*</span>}
      </p>
      <input
        type={fp.type || 'text'}
        value={fp.value}
        onChange={function(e) { fp.onChange(e.target.value) }}
        placeholder={fp.placeholder || ''}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500"
      />
    </div>
  )
}

export default function EditProjectWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <EditProjectPage />
    </Suspense>
  )
}

function EditProjectPage() {
  var router = useRouter()
  var params = useSearchParams()
  var [saving, setSaving] = useState(false)
  var [error, setError] = useState(null)
  var [form, setForm] = useState({
    project_name: '',
    project_number: '',
    owner: '',
    re: '',
    contractor: '',
    project_engineer: '',
    location: '',
    start_date: '',
  })

  useEffect(function() {
    var projectId = params.get('id')
    if (!projectId) { router.push('/projects'); return }
    loadProject(projectId)
  }, [])

  async function loadProject(id) {
    var result = await supabase.from('projects').select('*').eq('id', id).single()
    if (result.data) {
      setForm({
        project_name: result.data.project_name || '',
        project_number: result.data.project_number || '',
        owner: result.data.owner || '',
        re: result.data.re || '',
        contractor: result.data.general_contractor || '',
        project_engineer: result.data.project_engineer || '',
        location: result.data.location || '',
        start_date: result.data.start_date || '',
      })
    }
  }

  function setField(key, value) {
    setForm(function(prev) { return Object.assign({}, prev, { [key]: value }) })
  }

  async function handleSave() {
    if (!form.project_name.trim()) { setError('Project Name is required.'); return }
    setSaving(true)
    setError(null)
    var projectId = params.get('id')
    var result = await supabase.from('projects').update({
      project_name: form.project_name.trim(),
      project_number: form.project_number.trim() || null,
      owner: form.owner.trim() || null,
      general_contractor: form.contractor.trim() || null,
      project_engineer: form.project_engineer.trim() || null,
      location: form.location.trim() || null,
    }).eq('id', projectId)
    setSaving(false)
    if (result.error) { setError('Failed to save: ' + result.error.message); return }
    router.push('/projects')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700">
        <button onClick={function() { router.back() }} className="text-orange-400 text-sm">Cancel</button>
        <p className="text-white text-sm font-semibold">Edit Project</p>
        <button onClick={handleSave} disabled={saving || !form.project_name.trim()}
          className="text-orange-400 text-sm font-semibold disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="p-4 space-y-4 pb-24">
        {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">{error}</p>}
        <Field value={form.project_name} onChange={function(v) { setField('project_name', v) }} label="Project Name" required={true} placeholder="e.g. Main Street Sewer Replacement" />
        <Field value={form.project_number} onChange={function(v) { setField('project_number', v) }} label="Project Number" placeholder="e.g. 2024-001" />
        <Field value={form.owner} onChange={function(v) { setField('owner', v) }} label="Owner" placeholder="e.g. Capital Region Water" />
        <Field value={form.contractor} onChange={function(v) { setField('contractor', v) }} label="Contractor" placeholder="e.g. Rogele Inc." />
        <Field value={form.project_engineer} onChange={function(v) { setField('project_engineer', v) }} label="Project Engineer" placeholder="e.g. Caleb Krauter" />
        <Field value={form.location} onChange={function(v) { setField('location', v) }} label="Location" placeholder="e.g. Harrisburg, PA" />
        <button onClick={handleSave} disabled={saving || !form.project_name.trim()}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-40 transition-colors mt-4">
          {saving ? 'Saving...' : 'Save Project'}
        </button>
      </div>
    </div>
  )
}
