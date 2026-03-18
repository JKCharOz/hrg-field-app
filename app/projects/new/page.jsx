'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

const ORG_ID = '5c7d8ed6-aaaa-4ced-92e8-69894a0cedc1'
const USER_ID = 'cb4f2c9b-a294-48ad-9905-7ed0dd7157b5'

export default function NewProjectPage() {
  const [form, setForm] = useState({
    project_name: '',
    project_number: '',
    owner: '',
    description: '',
    general_contractor: '',
    project_engineer: '',
    location: '',
    start_date: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.project_name || !form.project_number) {
      setError('Project name and number are required.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      project_name: form.project_name,
      project_number: form.project_number,
      owner: form.owner || null,
      description: form.description || null,
      general_contractor: form.general_contractor || null,
      project_engineer: form.project_engineer || null,
      location: form.location || null,
      start_date: form.start_date || null,
      org_id: ORG_ID,
      created_by: USER_ID
    }

    const { error: insertError } = await supabase
      .from('projects')
      .insert(payload)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
    } else {
      window.location.href = '/projects'
    }
  }

  const fields = [
    { label: 'Project Name *', field: 'project_name', placeholder: 'e.g. Main St Sewer Replacement' },
    { label: 'HRG Project Number *', field: 'project_number', placeholder: 'e.g. 2024-0142' },
    { label: 'Owner / Client', field: 'owner', placeholder: 'e.g. City of Harrisburg' },
    { label: 'Re: (Subject)', field: 'description', placeholder: 'e.g. Sewer replacement on Main St' },
    { label: 'General Contractor', field: 'general_contractor', placeholder: 'e.g. Rogele' },
    { label: 'Project Engineer', field: 'project_engineer', placeholder: 'e.g. Caleb Krauter' },
    { label: 'Location', field: 'location', placeholder: 'e.g. Main St & 3rd Ave, Harrisburg' },
  ]

  return (
    <div className="min-h-screen bg-[#0f2744] px-4 py-8">
      <div className="max-w-lg mx-auto">
        <button onClick={() => window.location.href = '/projects'}
          className="text-blue-300 text-sm mb-6 block">← Back to Projects</button>

        <h1 className="text-white text-2xl font-bold mb-6">New Project</h1>

        <div className="flex flex-col gap-4">
          {fields.map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="text-blue-300 text-sm mb-1 block">{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={form[field]}
                onChange={e => update(field, e.target.value)}
                className="w-full px-4 py-4 rounded-xl text-lg bg-white/10 text-white placeholder-white/30 border border-white/20 focus:outline-none focus:border-blue-400"
              />
            </div>
          ))}

          <div>
            <label className="text-blue-300 text-sm mb-1 block">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => update('start_date', e.target.value)}
              className="w-full px-4 py-4 rounded-xl text-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:border-blue-400"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white text-xl font-bold rounded-xl mt-2">
            {saving ? 'Saving...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
