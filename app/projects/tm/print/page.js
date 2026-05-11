'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

var CATEGORIES = [
  { key: 'labor', label: 'Labor' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'material', label: 'Material' },
]

function pad2(n) { return String(n).padStart(2, '0') }
function parseISO(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]) }
function fmtMD(s) { var d = parseISO(s); return (d.getMonth() + 1) + '/' + d.getDate() }
function fmtLong(s) { return parseISO(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
function fmtNum(n) {
  var v = parseFloat(n) || 0
  if (v === Math.round(v)) return String(Math.round(v))
  return v.toFixed(2).replace(/\.?0+$/, '')
}

function synthFromReports(reports, crew, equip, mats) {
  var byReport = {}
  reports.forEach(function(r) { byReport[r.id] = r })
  var out = []
  crew.forEach(function(c) {
    var r = byReport[c.report_id]; if (!r) return
    var hours = parseFloat(r.hours_worked) || 0
    var headcount = parseFloat(c.quantity) || 1
    var qty = headcount * hours
    if (qty === 0) return
    var desc = c.role || 'Crew'
    if (c.name) desc = desc + ' — ' + c.name
    out.push({ entry_date: r.report_date, category: 'labor', description: desc, quantity: qty, unit: 'hrs' })
  })
  equip.forEach(function(e) {
    var r = byReport[e.report_id]; if (!r) return
    var hours = parseFloat(e.hours) || 0
    var pieces = parseFloat(e.quantity) || 1
    var qty = pieces * hours
    if (qty === 0) return
    var desc = e.equip_type || 'Equipment'
    if (e.description && e.description !== e.equip_type) desc = desc + ' — ' + e.description
    out.push({ entry_date: r.report_date, category: 'equipment', description: desc, quantity: qty, unit: 'hrs' })
  })
  mats.forEach(function(m) {
    var r = byReport[m.report_id]; if (!r) return
    var qty = parseFloat(m.quantity) || 0
    if (qty === 0) return
    out.push({ entry_date: r.report_date, category: 'material', description: m.material_type || 'Material', quantity: qty, unit: m.unit || '' })
  })
  return out
}

export default function PrintPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <PrintPage />
    </Suspense>
  )
}

function PrintPage() {
  var params = useSearchParams()
  var router = useRouter()
  var projectId = params.get('id')
  var [project, setProject] = useState(null)
  var [entries, setEntries] = useState([])
  var [loading, setLoading] = useState(true)
  var [from, setFrom] = useState('')
  var [to, setTo] = useState('')

  useEffect(function() { if (projectId) loadAll() }, [projectId])

  async function loadAll() {
    setLoading(true)
    var [projRes, entRes, repRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('tm_entries').select('*').eq('project_id', projectId),
      supabase.from('daily_reports').select('id, report_date, hours_worked').eq('project_id', projectId),
    ])
    if (projRes.data) setProject(projRes.data)
    var reports = repRes.data || []
    var reportIds = reports.map(function(r) { return r.id })
    var crewRows = [], equipRows = [], matRows = []
    if (reportIds.length > 0) {
      var [c, e, m] = await Promise.all([
        supabase.from('crew_logs').select('*').in('report_id', reportIds),
        supabase.from('equipment_logs').select('*').in('report_id', reportIds),
        supabase.from('materials').select('*').in('report_id', reportIds).eq('is_delivery', false),
      ])
      crewRows = c.data || []; equipRows = e.data || []; matRows = m.data || []
    }
    var synth = synthFromReports(reports, crewRows, equipRows, matRows)
    var all = (entRes.data || []).concat(synth)
    setEntries(all)
    if (all.length > 0) {
      var dates = all.map(function(e) { return e.entry_date }).sort()
      setFrom(dates[0])
      setTo(dates[dates.length - 1])
    }
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-white p-8 text-slate-600">Loading...</div>
  if (!project) return <div className="min-h-screen bg-white p-8 text-slate-600">Project not found.</div>

  var filtered = entries.filter(function(e) {
    if (from && e.entry_date < from) return false
    if (to && e.entry_date > to) return false
    return true
  })
  var dateSet = {}
  filtered.forEach(function(e) { dateSet[e.entry_date] = true })
  var dates = Object.keys(dateSet).sort()

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      <style>{`
        @page { size: landscape; margin: 0.4in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
        .tm-table th, .tm-table td { border: 1px solid #444; padding: 4px 6px; font-size: 11px; }
        .tm-table th { background: #eee; font-weight: 600; text-align: center; }
        .tm-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .tm-table td.desc { text-align: left; }
        .tm-table tr.totalrow td { font-weight: 700; background: #f4f4f4; }
        .tm-table caption { caption-side: top; text-align: left; padding: 8px 0 4px; font-weight: 700; font-size: 13px; }
      `}</style>

      <div className="no-print bg-slate-100 border-b border-slate-300 p-3 flex flex-wrap gap-3 items-center sticky top-0 z-10">
        <button onClick={function() { router.back() }}
          className="text-sm px-3 py-1.5 border border-slate-400 rounded bg-white">← Back</button>
        <div className="flex items-center gap-2 text-sm">
          <label>From</label>
          <input type="date" value={from} onChange={function(e) { setFrom(e.target.value) }}
            className="border border-slate-400 rounded px-2 py-1 bg-white" />
          <label>To</label>
          <input type="date" value={to} onChange={function(e) { setTo(e.target.value) }}
            className="border border-slate-400 rounded px-2 py-1 bg-white" />
        </div>
        <button onClick={function() { window.print() }}
          className="ml-auto text-sm px-4 py-1.5 bg-black text-white rounded font-semibold">Print / Save PDF</button>
      </div>

      <div className="p-6 print:p-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold">{project.project_name}</h1>
          <p className="text-sm text-slate-700">
            {project.project_number ? project.project_number + ' · ' : ''}
            {project.owner || ''}
            {project.location ? ' · ' + project.location : ''}
          </p>
          <p className="text-sm font-semibold mt-1">
            Time &amp; Materials Summary: {from ? fmtLong(from) : '—'} through {to ? fmtLong(to) : '—'}
          </p>
        </div>

        {dates.length === 0 ? (
          <p className="text-slate-600 text-sm italic">No entries in the selected date range.</p>
        ) : (
          CATEGORIES.map(function(c) {
            var rows = filtered.filter(function(e) { return e.category === c.key })
            if (rows.length === 0) return null

            // Group by (description, unit)
            var groups = {}
            rows.forEach(function(r) {
              var key = (r.description || '') + '||' + (r.unit || '')
              if (!groups[key]) groups[key] = { description: r.description, unit: r.unit || '', byDate: {}, total: 0 }
              groups[key].byDate[r.entry_date] = (groups[key].byDate[r.entry_date] || 0) + (parseFloat(r.quantity) || 0)
              groups[key].total += parseFloat(r.quantity) || 0
            })
            var items = Object.values(groups).sort(function(a, b) { return b.total - a.total })

            // Per-date totals across the category
            var dateTotals = {}
            var dateUnits = {}
            rows.forEach(function(r) {
              var u = r.unit || ''
              if (!dateTotals[r.entry_date]) dateTotals[r.entry_date] = {}
              dateTotals[r.entry_date][u] = (dateTotals[r.entry_date][u] || 0) + (parseFloat(r.quantity) || 0)
              dateUnits[u] = true
            })

            // Grand total per unit
            var grand = {}
            rows.forEach(function(r) {
              var u = r.unit || ''
              grand[u] = (grand[u] || 0) + (parseFloat(r.quantity) || 0)
            })
            var grandStr = Object.keys(grand).map(function(u) { return fmtNum(grand[u]) + (u ? ' ' + u : '') }).join(' · ')

            return (
              <div key={c.key} className="mb-6">
                <table className="tm-table w-full border-collapse">
                  <caption>{c.label} — {grandStr}</caption>
                  <thead>
                    <tr>
                      <th className="text-left" style={{ width: '30%' }}>Description</th>
                      <th style={{ width: '6%' }}>Unit</th>
                      {dates.map(function(d) { return <th key={d}>{fmtMD(d)}</th> })}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(function(item, i) {
                      return (
                        <tr key={i}>
                          <td className="desc">{item.description}</td>
                          <td className="num">{item.unit}</td>
                          {dates.map(function(d) {
                            var v = item.byDate[d]
                            return <td key={d} className="num">{v ? fmtNum(v) : ''}</td>
                          })}
                          <td className="num">{fmtNum(item.total)}</td>
                        </tr>
                      )
                    })}
                    <tr className="totalrow">
                      <td className="desc">Daily Total</td>
                      <td className="num"></td>
                      {dates.map(function(d) {
                        var t = dateTotals[d] || {}
                        var keys = Object.keys(t)
                        var s = keys.map(function(u) { return fmtNum(t[u]) }).join(' / ')
                        return <td key={d} className="num">{s}</td>
                      })}
                      <td className="num">{grandStr.replace(/ · /g, ' / ')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })
        )}

        <p className="text-xs text-slate-500 mt-6">Generated {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
}
