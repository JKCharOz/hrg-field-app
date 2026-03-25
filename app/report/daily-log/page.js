'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HeaderSection } from '@/components/HeaderSection'
import { DailyConditions } from '@/components/DailyConditions'
import { ButtonGrid } from '@/components/ButtonGrid'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { StatsRow } from '@/components/StatsRow'
import { PhotoModal } from '@/components/PhotoModal'
import { MaterialsModal } from '@/components/MaterialsModal'
import { QuantityModal } from '@/components/QuantityModal'
import { EquipmentModal } from '@/components/EquipmentModal'
import { CrewModal } from '@/components/CrewModal'

function Divider() { return <div style={{ margin: '0 1rem', borderTop: '1px solid rgb(30 41 59)' }} /> }
function SectionLabel(p) { return <p className="px-4 text-slate-500 text-xs uppercase tracking-widest">{p.text}</p> }

function Collapsible(props) {
  var [open, setOpen] = useState(false)
  return (
    <div className="mx-4 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
      <button onClick={function() { setOpen(function(o) { return !o }) }}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-700/50">
        <span className="text-slate-300 text-sm font-semibold">{props.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} className="text-slate-500">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="border-t border-slate-700 px-4 py-3">{props.children}</div>}
    </div>
  )
}

function PlaceholderModal(props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={props.onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">{props.title}</h3>
          <button onClick={props.onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        <p className="text-slate-500 text-sm">This panel will be built in the next phase.</p>
        <button onClick={props.onClose} className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Close</button>
      </div>
    </div>
  )
}

function RemarksModal(props) {
  var report = props.report
  var onSave = props.onSave
  var onClose = props.onClose
  var [text, setText] = useState((report && report.remarks) || '')
  var [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    var result = await supabase.from('daily_reports').update({ remarks: text }).eq('id', report.id).select().single()
    setSaving(false)
    if (!result.error && result.data) { onSave(result.data); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Remarks</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        <textarea value={text} onChange={function(e) { setText(e.target.value) }} rows={5}
          placeholder="Enter inspector remarks..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500 resize-none" />
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onClose} className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}

function VisitorsModal(props) {
  var report = props.report
  var onSave = props.onSave
  var onClose = props.onClose
  var [text, setText] = useState((report && report.visitors) || '')
  var [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    var result = await supabase.from('daily_reports').update({ visitors: text }).eq('id', report.id).select().single()
    setSaving(false)
    if (!result.error && result.data) { onSave(result.data); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Visitors</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        <textarea value={text} onChange={function(e) { setText(e.target.value) }} rows={5}
          placeholder="Enter names or organizations of visitors..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500 resize-none" />
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onClose} className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}


function SimpleTextModal(props) {
  var report = props.report
  var onSave = props.onSave
  var onClose = props.onClose
  var field = props.field
  var title = props.title
  var placeholder = props.placeholder || 'Enter notes...'
  var [text, setText] = useState((report && report[field]) || '')
  var [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    var payload = {}
    payload[field] = text
    var result = await supabase.from('daily_reports').update(payload).eq('id', report.id).select().single()
    setSaving(false)
    if (!result.error && result.data) { onSave(result.data); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        <textarea value={text} onChange={function(e) { setText(e.target.value) }} rows={5}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500 resize-none" />
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onClose} className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}

function DiscussedModal(props) {
  var report = props.report
  var onSave = props.onSave
  var onClose = props.onClose
  var [text, setText] = useState((report && report.items_discussed) || '')
  var [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    var result = await supabase.from('daily_reports').update({ items_discussed: text }).eq('id', report.id).select().single()
    setSaving(false)
    if (!result.error && result.data) { onSave(result.data); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Items Discussed and People Contacted</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        <textarea value={text} onChange={function(e) { setText(e.target.value) }} rows={5}
          placeholder="Enter notes from discussions or contacts..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500 resize-none" />
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onClose} className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}

var MODAL_LABELS = {
  equipment: 'Equipment', crew: 'Crew', photo: 'Photo',
  materials: 'Materials Delivered', quantity: 'Quantity Installed',
  visitors: 'Visitors', discussed: 'Items Discussed and People Contacted', remarks: 'Remarks',
}
var ADDITIONAL = ['Sub-Contractors', 'Testing', 'RFI', 'Non-Conforming']

export default function DailyLogPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>}>
      <DailyLogPage />
    </Suspense>
  )
}

function DailyLogPage() {
  var params = useSearchParams()
  var router = useRouter()
  var [report, setReport] = useState(null)
  var [project, setProject] = useState(null)
  var [activities, setActivities] = useState([])
  var [materials, setMaterials] = useState([])
  var [equipment, setEquipment] = useState([])
  var [photos, setPhotos] = useState([])
  var [crew, setCrew] = useState([])
  var [loading, setLoading] = useState(true)
  var [pageError, setPageError] = useState(null)
  var [modal, setModal] = useState(null)
  var [toast, setToast] = useState(null)
  var [logText, setLogText] = useState('')
  var [addingLog, setAddingLog] = useState(false)

  useEffect(function() {
    var reportId = params.get('report')
    if (!reportId) { setPageError('No report ID in URL.'); setLoading(false); return }
    loadAll(reportId)
  }, [])

  async function loadAll(reportId) {
    setLoading(true)
    var repResult = await supabase.from('daily_reports').select('*').eq('id', reportId).single()
    if (repResult.error || !repResult.data) { setPageError('Report not found.'); setLoading(false); return }
    setReport(repResult.data)
    var projResult = await supabase.from('projects').select('*').eq('id', repResult.data.project_id).single()
    setProject(projResult.data || null)
    var all = await Promise.all([
      supabase.from('activity_logs').select('*').eq('report_id', reportId).order('logged_at', { ascending: true }),
      supabase.from('materials').select('*').eq('report_id', reportId),
      supabase.from('equipment_logs').select('*').eq('report_id', reportId),
      supabase.from('field_photos').select('*').eq('report_id', reportId),
      supabase.from('crew_logs').select('*').eq('report_id', reportId),
    ])
    setActivities(all[0].data || [])
    setMaterials(all[1].data || [])
    setEquipment(all[2].data || [])
    setPhotos(all[3].data || [])
    setCrew(all[4] ? all[4].data || [] : [])
    setLoading(false)
  }

  function handleReportUpdate(updated) { setReport(updated) }

  async function handleAddLog() {
    if (!logText.trim() || addingLog || !report) return
    setAddingLog(true)
    var raw = logText.trim()
    var contractor = (project && project.general_contractor) || ''
    var formatted = raw
    var aiError = null
    try {
      var res = await fetch('/api/format-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: raw, contractor: contractor }),
      })
      var json = await res.json()
      if (res.ok && json.text) {
        formatted = json.text
      } else {
        aiError = json.error || 'status ' + res.status
      }
    } catch (e) { aiError = e.message || 'fetch failed' }
    alert('RAW: ' + raw + '\nFORMATTED: ' + formatted)
    var result = await supabase.from('activity_logs').insert({
      report_id: report.id,
      project_id: report.project_id,
      org_id: report.org_id,
      activity_type: 'other',
      notes: formatted,
      logged_at: new Date().toISOString(),
    }).select().single()
    setAddingLog(false)
    if (result.error) { showToast('Failed to add entry', 'error'); return }
    setActivities(function(prev) { return prev.concat([result.data]) })
    setLogText('')
    if (aiError) { showToast('AI: ' + aiError, 'error') }
    else { showToast('Entry added', 'success') }
  }

  async function handleEditActivity(id, updates) {
    var result = await supabase.from('activity_logs').update(updates).eq('id', id).select().single()
    if (result.error) { showToast('Failed to save', 'error'); return }
    setActivities(function(prev) { return prev.map(function(e) { return e.id === id ? result.data : e }) })
  }

  async function handleDeleteActivity(id) {
    var result = await supabase.from('activity_logs').delete().eq('id', id)
    if (result.error) { showToast('Failed to delete', 'error'); return }
    setActivities(function(prev) { return prev.filter(function(e) { return e.id !== id }) })
  }

  function showToast(msg, type) {
    setToast({ msg: msg, type: type || 'success' })
    setTimeout(function() { setToast(null) }, type === 'error' ? 8000 : 2500)
  }

  var counts = {
    photos: photos.length,
    materialsDelivered: materials.filter(function(m) { return m.is_delivery === true }).length,
    quantityInstalled: materials.filter(function(m) { return m.is_delivery === false }).length,
    equipment: equipment.length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 text-sm">Loading report...</p>
      </div>
    )
  }
  if (pageError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-white font-bold">{pageError}</p>
        <button onClick={function() { router.push('/projects') }} className="text-orange-400 text-sm mt-2">Back to projects</button>
      </div>
    )
  }

  

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <HeaderSection report={report} project={project} backHref="/projects" />
      <div className="pt-3 pb-36 space-y-4">

        <div className="mx-4 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-tight truncate">{project ? project.project_name : ''}</p>
              {project && project.project_number && <p className="text-orange-400 text-xs font-mono mt-0.5">{project.project_number}</p>}
            </div>
            {project && project.contractor && <p className="text-slate-400 text-xs text-right flex-shrink-0">{project.contractor}</p>}
          </div>
          {project && project.location && <p className="text-slate-500 text-xs mt-1.5">{project.location}</p>}
        </div>

        <DailyConditions report={report} onUpdate={handleReportUpdate} />

        <div className="px-4">
          <button onClick={function() { setModal('discussed') }}
            className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 active:bg-slate-700 transition-colors text-left">
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 text-sm font-semibold">Items Discussed and People Contacted</p>
              <p className="text-slate-500 text-xs">Tap to add</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <Divider />

        <div>
          <SectionLabel text="Add to Report" />
          <div className="mt-2"><ButtonGrid onPress={function(key) { setModal(key) }} /></div>
        </div>

        <Divider />

        {crew.length > 0 && (
          <button onClick={function() { setModal('crew') }}
            className="mx-4 w-auto flex flex-col bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-left active:bg-slate-700 transition-colors">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Crew on Site</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {crew.map(function(c) {
                return (
                  <span key={c.id} className="text-slate-300 text-xs">
                    {c.role} <span className="text-orange-400 font-mono">x{c.quantity}</span>
                  </span>
                )
              })}
            </div>
          </button>
        )}

        <Collapsible label="Other">
          <div className="space-y-1">
            <button onClick={function() { setModal('visitors') }}
              className="w-full text-left py-2.5 border-b border-slate-700 active:text-slate-200">
              <p className="text-slate-300 text-sm">Visitors</p>
              <p className="text-slate-500 text-xs truncate">
                {report && report.visitors ? report.visitors.slice(0, 60) : 'Tap to add'}
              </p>
            </button>
            <button onClick={function() { setModal('subcontractors') }}
              className="w-full text-left py-2.5 border-b border-slate-700 active:text-slate-200">
              <p className="text-slate-300 text-sm">Sub-Contractors</p>
              <p className="text-slate-500 text-xs truncate">{report && report.subcontractors ? report.subcontractors.slice(0, 60) : 'Tap to add'}</p>
            </button>
            <button onClick={function() { setModal('testing') }}
              className="w-full text-left py-2.5 border-b border-slate-700 active:text-slate-200">
              <p className="text-slate-300 text-sm">Testing</p>
              <p className="text-slate-500 text-xs truncate">{report && report.testing_notes ? report.testing_notes.slice(0, 60) : 'Tap to add'}</p>
            </button>
            <button onClick={function() { setModal('rfi') }}
              className="w-full text-left py-2.5 border-b border-slate-700 active:text-slate-200">
              <p className="text-slate-300 text-sm">RFI</p>
              <p className="text-slate-500 text-xs truncate">{report && report.rfi_notes ? report.rfi_notes.slice(0, 60) : 'Tap to add'}</p>
            </button>
            <button onClick={function() { setModal('nonconforming') }}
              className="w-full text-left py-2.5 active:text-slate-200">
              <p className="text-slate-300 text-sm">Non-Conforming</p>
              <p className="text-slate-500 text-xs truncate">{report && report.nonconforming_work ? report.nonconforming_work.slice(0, 60) : 'Tap to add'}</p>
            </button>

          </div>
        </Collapsible>

        <Divider />

        <div>
          <SectionLabel text="Work Observed" />
          <div className="flex gap-2 px-4 mt-3">
            <input type="text" value={logText}
              onChange={function(e) { setLogText(e.target.value) }}
              onKeyDown={function(e) { if (e.key === 'Enter') handleAddLog() }}
              placeholder="Describe an observed activity..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
            <button onClick={handleAddLog} disabled={!logText.trim() || addingLog}
              className="bg-orange-500 text-white font-bold px-4 rounded-xl active:bg-orange-600 disabled:opacity-40 transition-colors flex-shrink-0">
              {addingLog ? '...' : 'Add'}
            </button>
          </div>
        </div>

        <div className="mt-1">
          <ActivityTimeline entries={activities} onEdit={handleEditActivity} onDelete={handleDeleteActivity} />
        </div>

        <Divider />
        <div className="grid grid-cols-4 gap-2 px-4">
          <button onClick={function() { setModal('photo') }}
            className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-xl py-3 active:bg-orange-500/10 active:border-orange-500 transition-colors">
            <span className={(counts.photos > 0 ? 'text-orange-400' : 'text-slate-600') + ' text-xl font-bold font-mono leading-none'}>{counts.photos}</span>
            <span className="text-slate-500 uppercase tracking-wide mt-0.5 text-center leading-tight" style={{ fontSize: '10px' }}>Photos</span>
          </button>
          <button onClick={function() { setModal('materials') }}
            className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-xl py-3 active:bg-orange-500/10 active:border-orange-500 transition-colors">
            <span className={(counts.materialsDelivered > 0 ? 'text-orange-400' : 'text-slate-600') + ' text-xl font-bold font-mono leading-none'}>{counts.materialsDelivered}</span>
            <span className="text-slate-500 uppercase tracking-wide mt-0.5 text-center leading-tight" style={{ fontSize: '10px' }}>Delivered</span>
          </button>
          <button onClick={function() { setModal('quantity') }}
            className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-xl py-3 active:bg-orange-500/10 active:border-orange-500 transition-colors">
            <span className={(counts.quantityInstalled > 0 ? 'text-orange-400' : 'text-slate-600') + ' text-xl font-bold font-mono leading-none'}>{counts.quantityInstalled}</span>
            <span className="text-slate-500 uppercase tracking-wide mt-0.5 text-center leading-tight" style={{ fontSize: '10px' }}>Installed</span>
          </button>
          <button onClick={function() { setModal('equipment') }}
            className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-xl py-3 active:bg-orange-500/10 active:border-orange-500 transition-colors">
            <span className={(counts.equipment > 0 ? 'text-orange-400' : 'text-slate-600') + ' text-xl font-bold font-mono leading-none'}>{counts.equipment}</span>
            <span className="text-slate-500 uppercase tracking-wide mt-0.5 text-center leading-tight" style={{ fontSize: '10px' }}>Equipment</span>
          </button>
        </div>
        <Divider />

        <div className="px-4">
          <button onClick={function() { setModal('remarks') }}
            className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 active:bg-slate-700 transition-colors text-left">
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 text-sm font-semibold">Remarks</p>
              <p className="text-slate-500 text-xs truncate">{report && report.remarks ? report.remarks.slice(0, 60) : 'Tap to add'}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {report && report.pdf_url && (
          <div className="mx-4 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold px-4 py-2 border-b border-slate-700">Report PDF</p>
            <div className="flex">
              <a href={report.pdf_url} target="_blank" rel="noreferrer"
                className="flex-1 text-center py-3 text-orange-400 text-sm font-semibold border-r border-slate-700 active:bg-slate-700">Open</a>
              <button onClick={function() {
                if (navigator.share) { navigator.share({ title: 'Daily Observation Report', url: report.pdf_url }) }
                else { navigator.clipboard.writeText(report.pdf_url); alert('PDF link copied to clipboard') }
              }} className="flex-1 text-center py-3 text-orange-400 text-sm font-semibold border-r border-slate-700 active:bg-slate-700">Share</button>
              <a href={report.pdf_url} download
                className="flex-1 text-center py-3 text-orange-400 text-sm font-semibold active:bg-slate-700">Download</a>
            </div>
          </div>
        )}

        <div className="px-4 space-y-3">
          <button onClick={function() { router.push('/signature') }}
            className="w-full flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 active:bg-slate-700 transition-colors">
            <p className="text-slate-200 text-sm font-semibold">My Signature</p>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <button onClick={function() { router.push('/report/preview?report=' + report.id) }}
            className="w-full border border-orange-500/50 text-orange-400 font-semibold py-3.5 rounded-xl text-sm active:bg-orange-500/10 transition-colors">
            Preview Report
          </button>
        </div>

      </div>

      <div className="fixed bottom-0 inset-x-0 bg-slate-950/90 border-t border-slate-800 p-4">
        <button onClick={function() { router.push('/report/preview?report=' + report.id) }}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 transition-colors flex items-center justify-center gap-2">
          Preview & Generate
        </button>
      </div>

      {modal === 'remarks' && <RemarksModal report={report} onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'photo' && <PhotoModal report={report} onClose={function() { setModal(null) }} />}
      {modal === 'materials' && <MaterialsModal report={report} onClose={function() { setModal(null) }} onSaved={function() { loadAll(report.id) }} />}
      {modal === 'equipment' && <EquipmentModal report={report} project={project} onClose={function() { setModal(null) }} onSaved={function() { loadAll(report.id) }} />}
      {modal === 'visitors' && <VisitorsModal report={report} onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'subcontractors' && <SimpleTextModal report={report} field="subcontractors" title="Sub-Contractors" placeholder="Enter sub-contractor names..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'testing' && <SimpleTextModal report={report} field="testing_notes" title="Testing" placeholder="Enter testing notes..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'rfi' && <SimpleTextModal report={report} field="rfi_notes" title="RFI" placeholder="Enter RFI notes..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'nonconforming' && <SimpleTextModal report={report} field="nonconforming_work" title="Non-Conforming Work" placeholder="Enter non-conforming work notes..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'subcontractors' && <SimpleTextModal report={report} field="subcontractors" title="Sub-Contractors" placeholder="Enter sub-contractor names..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'testing' && <SimpleTextModal report={report} field="testing_notes" title="Testing" placeholder="Enter testing notes..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'rfi' && <SimpleTextModal report={report} field="rfi_notes" title="RFI" placeholder="Enter RFI notes..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'nonconforming' && <SimpleTextModal report={report} field="nonconforming_work" title="Non-Conforming Work" placeholder="Enter non-conforming work notes..." onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal === 'crew' && <CrewModal report={report} project={project} onClose={function() { setModal(null) }} onSaved={function() { loadAll(report.id) }} />}
      {modal === 'quantity' && <QuantityModal report={report} onClose={function() { setModal(null) }} onSaved={function() { loadAll(report.id) }} />}
      {modal === 'discussed' && <DiscussedModal report={report} onSave={handleReportUpdate} onClose={function() { setModal(null) }} />}
      {modal && modal !== 'discussed' && modal !== 'remarks' && modal !== 'photo' && modal !== 'materials' && modal !== 'quantity' && modal !== 'equipment' && modal !== 'visitors' && modal !== 'crew' && modal !== 'subcontractors' && modal !== 'testing' && modal !== 'rfi' && modal !== 'nonconforming' && <PlaceholderModal title={MODAL_LABELS[modal] || modal} onClose={function() { setModal(null) }} />}

      {toast && (
        <div className="fixed top-20 inset-x-0 flex justify-center z-50 px-4" style={{ pointerEvents: 'none' }}>
          <span className={'text-sm font-medium px-5 py-2.5 rounded-full shadow ' + (toast.type === 'error' ? 'bg-red-900 text-red-200' : 'bg-emerald-800 text-emerald-200')}>
            {toast.msg}
          </span>
        </div>
      )}
    </div>
  )
}
