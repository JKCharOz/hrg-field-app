'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const USER_ID = 'cb4f2c9b-a294-48ad-9905-7ed0dd7157b5'
const ORG_ID = '5c7d8ed6-aaaa-4ced-92e8-69894a0cedc1'

const ACTIVITIES = [
  { type: 'mobilized',            label: 'Mobilized',         icon: '🚛' },
  { type: 'excavation_started',   label: 'Excavation',        icon: '🦺' },
  { type: 'pipe_located',         label: 'Pipe Located',      icon: '📍' },
  { type: 'pipe_removed',         label: 'Pipe Removed',      icon: '🔧' },
  { type: 'pipe_installed',       label: 'Pipe Installed',    icon: '✅' },
  { type: 'backfill',             label: 'Backfill',          icon: '⛏️' },
  { type: 'compaction',           label: 'Compaction',        icon: '🏗️' },
  { type: 'paving',               label: 'Paving',            icon: '🛣️' },
  { type: 'vac_truck',            label: 'Vac Truck',         icon: '🚰' },
  { type: 'cctv_inspection',      label: 'CCTV',              icon: '📷' },
  { type: 'traffic_control',      label: 'Traffic Control',   icon: '🚦' },
  { type: 'demobilized',          label: 'Demobilized',       icon: '🏁' },
]

export default function LogPage() {
  const [project, setProject] = useState(null)
  const [report, setReport] = useState(null)
  const [activities, setActivities] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState({ pipe_size: '', pipe_material: '', location_ref: '', notes: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search)
      const projectId = params.get('project')
      if (!projectId) { window.location.href = '/projects'; return }

      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single()
      setProject(proj)

      const today = new Date().toISOString().split('T')[0]
      let { data: rep } = await supabase.from('daily_reports')
        .select('*').eq('project_id', projectId).eq('report_date', today).single()

      if (!rep) {
        const { data: newRep } = await supabase.from('daily_reports').insert({
          project_id: projectId,
          org_id: ORG_ID,
          inspector_id: USER_ID,
          report_date: today,
          session_start_time: new Date().toTimeString().slice(0,8)
        }).select().single()
        rep = newRep
      }
      setReport(rep)

      const { data: acts } = await supabase.from('activity_logs')
        .select('*').eq('report_id', rep.id).order('logged_at', { ascending: true })
      setActivities(acts || [])
      setLoading(false)
    }
    load()
  }, [])

  async function logActivity(actType) {
    setSelected(actType)
    setDetail({ pipe_size: '', pipe_material: '', location_ref: '', notes: '' })
  }

  async function confirmActivity() {
    const act = ACTIVITIES.find(a => a.type === selected)
    const { data } = await supabase.from('activity_logs').insert({
      report_id: report.id,
      project_id: project.id,
      org_id: ORG_ID,
      activity_type: selected,
      pipe_size: detail.pipe_size || null,
      pipe_material: detail.pipe_material || null,
      location_ref: detail.location_ref || null,
      notes: detail.notes || null,
      created_by: USER_ID,
      logged_at: new Date().toISOString()
    }).select().single()

    setActivities(a => [...a, data])
    setSelected(null)
  }

  if (loading) return <div className="min-h-screen bg-[#0f2744] flex items-center justify-center text-white text-xl">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0f2744] px-4 py-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-6">
          <button onClick={() => window.location.href = '/projects'} className="text-blue-300 text-sm mb-2 block">← Projects</button>
          <h1 className="text-white text-xl font-bold">{project?.project_name}</h1>
          <p className="text-blue-300 text-sm">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} · Report #{report?.report_number}</p>
        </div>

        {/* Activity Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {ACTIVITIES.map(a => (
            <button key={a.type}
              onClick={() => logActivity(a.type)}
              className="bg-white/10 border border-white/20 rounded-xl py-4 flex flex-col items-center gap-1 hover:bg-white/20 active:scale-95">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-white text-xs font-medium text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="mb-6">
          <h2 className="text-blue-300 text-sm font-bold mb-3 uppercase tracking-wide">Today's Log</h2>
          {activities.length === 0 && <p className="text-white/40 text-sm">No activities logged yet. Tap a button above.</p>}
          <div className="flex flex-col gap-2">
            {activities.map(a => {
              const act = ACTIVITIES.find(x => x.type === a.activity_type)
              const time = new Date(a.logged_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
              return (
                <div key={a.id} className="bg-white/10 rounded-xl px-4 py-3 flex gap-3 items-start">
                  <span className="text-lg">{act?.icon}</span>
                  <div>
                    <div className="text-white font-medium text-sm">{act?.label}</div>
                    <div className="text-blue-300 text-xs">{time}{a.location_ref ? ` · ${a.location_ref}` : ''}{a.pipe_size ? ` · ${a.pipe_size}` : ''}</div>
                    {a.notes && <div className="text-white/60 text-xs mt-1">{a.notes}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Generate Report Button */}
        <button
          onClick={() => window.location.href = `/report?report=${report?.id}`}
          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white text-xl font-bold rounded-xl">
          Generate Report
        </button>
      </div>

      {/* Detail Popup */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-[#1a3a5c] w-full max-w-lg rounded-t-2xl p-6">
            <h3 className="text-white text-lg font-bold mb-4">
              {ACTIVITIES.find(a => a.type === selected)?.icon} {ACTIVITIES.find(a => a.type === selected)?.label}
            </h3>
            <div className="flex flex-col gap-3 mb-4">
              {[
                { field: 'location_ref', placeholder: 'Location (e.g. MH-104, Sta 12+50)' },
                { field: 'pipe_size',    placeholder: 'Pipe size (e.g. 8-inch)' },
                { field: 'pipe_material',placeholder: 'Material (e.g. PVC, CMP)' },
                { field: 'notes',        placeholder: 'Notes (optional)' },
              ].map(({ field, placeholder }) => (
                <input key={field} type="text" placeholder={placeholder}
                  value={detail[field]}
                  onChange={e => setDetail(d => ({ ...d, [field]: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:border-blue-400"
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelected(null)}
                className="flex-1 py-3 border border-white/20 text-white rounded-xl">Cancel</button>
              <button onClick={confirmActivity}
                className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl">Log It</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
