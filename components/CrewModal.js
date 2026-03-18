'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

var ROLES = ['Superintendent', 'Foreman', 'Operator', 'Laborer', 'Truck Driver', 'Other']

function emptyRoles() {
  var obj = {}
  ROLES.forEach(function(r) { obj[r] = '' })
  return obj
}

export function CrewModal(props) {
  var report = props.report
  var project = props.project
  var onClose = props.onClose
  var onSaved = props.onSaved

  var [contractor, setContractor] = useState((project && project.contractor) || '')
  var [counts, setCounts] = useState(emptyRoles())
  var [saving, setSaving] = useState(false)
  var [loading, setLoading] = useState(true)
  var [hoursWorked, setHoursWorked] = useState('')
  var [carriedOver, setCarriedOver] = useState(false)

  useEffect(function() {
    if (report && report.id) { loadExisting() }
    if (report && report.hours_worked) { setHoursWorked(String(report.hours_worked)) }
  }, [report && report.id])

  async function loadExisting() {
    setLoading(true)
    var result = await supabase
      .from('crew_logs')
      .select('*')
      .eq('report_id', report.id)
    setLoading(false)
    if (result.error || !result.data || result.data.length === 0) return
    setCarriedOver(true)
    var newCounts = emptyRoles()
    result.data.forEach(function(row) {
      if (newCounts.hasOwnProperty(row.role)) {
        newCounts[row.role] = row.quantity ? String(row.quantity) : ''
      }
    })
    if (result.data[0].contractor) { setContractor(result.data[0].contractor) }
    setCounts(newCounts)
  }

  async function handleClearAll() {
    if (!window.confirm('Clear all crew entries?')) return
    await supabase.from('crew_logs').delete().eq('report_id', report.id)
    setCounts(emptyRoles())
    setCarriedOver(false)
    if (onSaved) { onSaved() }
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    await supabase.from('crew_logs').delete().eq('report_id', report.id)
    var rows = []
    ROLES.forEach(function(role) {
      var qty = parseInt(counts[role])
      if (qty > 0) {
        rows.push({
          report_id: report.id,
          project_id: report.project_id,
          org_id: report.org_id,
          contractor: contractor.trim() || null,
          role: role,
          quantity: qty,
          created_at: new Date().toISOString(),
        })
      }
    })
    if (rows.length > 0) {
      await supabase.from('crew_logs').insert(rows)
    }
    await supabase.from('daily_reports').update({ hours_worked: hoursWorked || null }).eq('id', report.id)
    setSaving(false)
    if (onSaved) { onSaved() }
    onClose()
  }

  function setCount(role, val) {
    setCarriedOver(false)
    setCounts(function(prev) {
      var next = Object.assign({}, prev)
      next[role] = val
      return next
    })
  }

  var total = ROLES.reduce(function(sum, r) { return sum + (parseInt(counts[r]) || 0) }, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4 max-h-screen overflow-y-auto" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Crew</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Contractor</p>
          <input type="text" value={contractor} onChange={function(e) { setContractor(e.target.value) }}
            placeholder="Contractor name..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        {carriedOver && (
          <p className="text-slate-500 text-xs text-center py-1 bg-slate-800 rounded-lg">Carried from previous report</p>
        )}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Hours Worked</p>
          <input type="number" value={hoursWorked} onChange={function(e) { setHoursWorked(e.target.value) }}
            placeholder="e.g. 8"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm text-center py-4">Loading...</p>
        ) : (
          <div className="space-y-2">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Workforce</p>
            {ROLES.map(function(role) {
              return (
                <div key={role} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                  <span className="text-slate-200 text-sm flex-1">{role}</span>
                  <input type="number" value={counts[role]} onChange={function(e) { setCount(role, e.target.value) }}
                    placeholder="0" min="0"
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-orange-500" />
                </div>
              )
            })}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-slate-400 text-sm font-semibold">Total</span>
                <span className="text-orange-400 text-sm font-bold font-mono">{total}</span>
              </div>
            )}
          </div>
        )}
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Save Crew'}
        </button>
        <button onClick={handleClearAll}
          className="w-full border border-red-800 text-red-400 py-2.5 rounded-xl text-sm active:bg-red-900/20">Clear All Crew</button>
        <button onClick={onClose} className="w-full border border-slate-700 text-slate-600 py-2.5 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}
