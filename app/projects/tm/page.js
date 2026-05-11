'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

var CATEGORIES = [
  { key: 'labor', label: 'Labor', short: 'Labor', defaultUnit: 'hrs' },
  { key: 'equipment', label: 'Equipment', short: 'Equipment', defaultUnit: 'hrs' },
  { key: 'material', label: 'Material', short: 'Material', defaultUnit: 'cy' },
]

function pad2(n) { return String(n).padStart(2, '0') }
function localToday() {
  var d = new Date()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}
function parseISO(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]) }
function fmtISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }
function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return fmtISO(d) }
function weekStartOf(s) { var d = parseISO(s); d.setDate(d.getDate() - d.getDay()); return fmtISO(d) }
function fmtLong(s) { return parseISO(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtShort(s) { return parseISO(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }
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
    var r = byReport[c.report_id]
    if (!r) return
    var hours = parseFloat(r.hours_worked) || 0
    var headcount = parseFloat(c.quantity) || 1
    var qty = headcount * hours
    if (qty === 0) return
    var desc = c.role || 'Crew'
    if (c.name) desc = desc + ' — ' + c.name
    out.push({
      id: 'crew:' + c.id,
      _source: 'report',
      report_id: c.report_id,
      report_number: r.report_number,
      entry_date: r.report_date,
      category: 'labor',
      description: desc,
      quantity: qty,
      count: headcount,
      per_unit: hours,
      unit: 'hrs',
    })
  })

  equip.forEach(function(e) {
    var r = byReport[e.report_id]
    if (!r) return
    var hours = parseFloat(e.hours) || 0
    var pieces = parseFloat(e.quantity) || 1
    var qty = pieces * hours
    if (qty === 0) return
    var desc = e.equip_type || 'Equipment'
    if (e.description && e.description !== e.equip_type) desc = desc + ' — ' + e.description
    out.push({
      id: 'equip:' + e.id,
      _source: 'report',
      report_id: e.report_id,
      report_number: r.report_number,
      entry_date: r.report_date,
      category: 'equipment',
      description: desc,
      quantity: qty,
      count: pieces,
      per_unit: hours,
      unit: 'hrs',
    })
  })

  mats.forEach(function(m) {
    var r = byReport[m.report_id]
    if (!r) return
    var qty = parseFloat(m.quantity) || 0
    if (qty === 0) return
    out.push({
      id: 'mat:' + m.id,
      _source: 'report',
      report_id: m.report_id,
      report_number: r.report_number,
      entry_date: r.report_date,
      category: 'material',
      description: m.material_type || 'Material',
      quantity: qty,
      count: 1,
      per_unit: null,
      unit: m.unit || '',
    })
  })

  return out
}

export default function TmPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>}>
      <TmPage />
    </Suspense>
  )
}

function TmPage() {
  var params = useSearchParams()
  var router = useRouter()
  var projectId = params.get('id')
  var [project, setProject] = useState(null)
  var [orgId, setOrgId] = useState(null)
  var [userId, setUserId] = useState(null)
  var [loading, setLoading] = useState(true)
  var [items, setItems] = useState([])
  var [entries, setEntries] = useState([])
  var [view, setView] = useState('day')
  var [selectedDate, setSelectedDate] = useState(localToday())
  var [addingForCategory, setAddingForCategory] = useState(null)
  var [editingItem, setEditingItem] = useState(null)
  var [logTarget, setLogTarget] = useState(null)

  useEffect(function() {
    if (projectId) loadAll()
  }, [projectId])

  async function loadAll() {
    setLoading(true)
    var auth = await supabase.auth.getUser()
    if (auth.error || !auth.data.user) { router.push('/'); return }
    setUserId(auth.data.user.id)
    var prof = await supabase.from('users').select('org_id').eq('id', auth.data.user.id).single()
    if (prof.data) setOrgId(prof.data.org_id)
    var proj = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (proj.data) setProject(proj.data)
    var [itemsRes, entriesRes, reportsRes] = await Promise.all([
      supabase.from('tm_items').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('tm_entries').select('*').eq('project_id', projectId),
      supabase.from('daily_reports').select('id, report_date, report_number, hours_worked').eq('project_id', projectId),
    ])
    setItems(itemsRes.data || [])

    var reports = reportsRes.data || []
    var reportIds = reports.map(function(r) { return r.id })
    var crewRows = []
    var equipRows = []
    var matRows = []
    if (reportIds.length > 0) {
      var [c, e, m] = await Promise.all([
        supabase.from('crew_logs').select('*').in('report_id', reportIds),
        supabase.from('equipment_logs').select('*').in('report_id', reportIds),
        supabase.from('materials').select('*').in('report_id', reportIds).eq('is_delivery', false),
      ])
      crewRows = c.data || []
      equipRows = e.data || []
      matRows = m.data || []
    }
    var synth = synthFromReports(reports, crewRows, equipRows, matRows)
    var combined = (entriesRes.data || []).concat(synth)
    setEntries(combined)
    setLoading(false)
  }

  async function saveItem(payload) {
    if (payload.id) {
      var r = await supabase.from('tm_items').update({
        description: payload.description,
        unit: payload.unit || null,
        archived: payload.archived || false,
      }).eq('id', payload.id)
      if (r.error) { alert('Save failed: ' + r.error.message); return }
    } else {
      var maxSort = items.filter(function(i) { return i.category === payload.category }).reduce(function(m, i) { return Math.max(m, i.sort_order || 0) }, 0)
      var r2 = await supabase.from('tm_items').insert({
        org_id: orgId,
        project_id: projectId,
        category: payload.category,
        description: payload.description,
        unit: payload.unit || null,
        sort_order: maxSort + 1,
      })
      if (r2.error) { alert('Save failed: ' + r2.error.message); return }
    }
    setAddingForCategory(null)
    setEditingItem(null)
    loadAll()
  }

  async function deleteItem(id) {
    if (!window.confirm('Archive this item? Past entries are kept; the item just stops appearing in the daily list.')) return
    var r = await supabase.from('tm_items').update({ archived: true }).eq('id', id)
    if (r.error) { alert('Archive failed: ' + r.error.message); return }
    setEditingItem(null)
    loadAll()
  }

  async function logQuantity(item, date, payload, existingEntryId) {
    var count = payload.count != null ? parseFloat(payload.count) : 1
    var perUnit = payload.per_unit != null && payload.per_unit !== '' ? parseFloat(payload.per_unit) : null
    var total
    if (perUnit != null && !isNaN(perUnit)) {
      total = (count || 0) * perUnit
    } else if (payload.quantity != null && payload.quantity !== '') {
      total = parseFloat(payload.quantity)
    } else {
      total = 0
    }
    if (isNaN(total)) { alert('Quantity must be a number.'); return }
    if (existingEntryId) {
      if (total === 0) {
        var rd = await supabase.from('tm_entries').delete().eq('id', existingEntryId)
        if (rd.error) { alert('Delete failed: ' + rd.error.message); return }
      } else {
        var ru = await supabase.from('tm_entries').update({
          quantity: total,
          count: count || 1,
          per_unit: perUnit,
        }).eq('id', existingEntryId)
        if (ru.error) { alert('Save failed: ' + ru.error.message); return }
      }
    } else if (total !== 0) {
      var ri = await supabase.from('tm_entries').insert({
        org_id: orgId,
        project_id: projectId,
        entry_date: date,
        category: item.category,
        description: item.description,
        quantity: total,
        count: count || 1,
        per_unit: perUnit,
        unit: item.unit || null,
        item_id: item.id,
        created_by: userId,
      })
      if (ri.error) { alert('Save failed: ' + ri.error.message); return }
    }
    setLogTarget(null)
    loadAll()
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>
  if (!project) return <div className="min-h-screen bg-slate-950 text-slate-400 p-8 text-center">Project not found.</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-slate-900 border-b border-slate-700">
        <button onClick={function() { router.push('/projects') }} className="text-orange-400 text-sm">Back</button>
        <div className="text-center">
          <p className="text-white text-sm font-semibold leading-tight">{project.project_name}</p>
          <p className="text-slate-500 text-xs">Time &amp; Materials</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex border-b border-slate-700">
        {[{ k: 'day', l: 'Day' }, { k: 'week', l: 'Week' }, { k: 'totals', l: 'Totals' }].map(function(t) {
          return (
            <button key={t.k} onClick={function() { setView(t.k) }}
              className={'flex-1 py-3 text-xs font-semibold uppercase tracking-wider ' + (view === t.k ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-500')}>
              {t.l}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-4 pb-24">
        {view === 'day' && (
          <DayView
            date={selectedDate}
            setDate={setSelectedDate}
            items={items}
            entries={entries}
            onAddItem={setAddingForCategory}
            onEditItem={setEditingItem}
            onTapLog={setLogTarget}
          />
        )}
        {view === 'week' && <WeekView weekStart={weekStartOf(selectedDate)} setDate={setSelectedDate} entries={entries} />}
        {view === 'totals' && (
          <div>
            <button onClick={function() { router.push('/projects/tm/print?id=' + projectId) }}
              className="w-full mb-4 bg-slate-800 border border-slate-700 rounded-xl py-3 text-orange-400 text-sm font-semibold active:bg-slate-700">
              Print / Save as PDF
            </button>
            <TotalsView entries={entries} items={items} />
          </div>
        )}
      </div>

      {addingForCategory && (
        <ItemModal mode="add" category={addingForCategory}
          onCancel={function() { setAddingForCategory(null) }}
          onSave={saveItem} />
      )}
      {editingItem && (
        <ItemModal mode="edit" item={editingItem}
          onCancel={function() { setEditingItem(null) }}
          onSave={saveItem}
          onDelete={deleteItem} />
      )}
      {logTarget && (
        <LogQuantityModal target={logTarget}
          onCancel={function() { setLogTarget(null) }}
          onSave={logQuantity} />
      )}
    </div>
  )
}

function DayView(p) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={function() { p.setDate(addDays(p.date, -1)) }}
          className="text-orange-400 text-sm px-3 py-2 border border-slate-700 rounded-lg active:bg-slate-800">&lt; Prev</button>
        <div className="flex flex-col items-center">
          <p className="text-white text-sm font-semibold">{fmtLong(p.date)}</p>
          <input type="date" value={p.date} onChange={function(e) { if (e.target.value) p.setDate(e.target.value) }}
            className="text-slate-500 text-xs bg-transparent" />
        </div>
        <button onClick={function() { p.setDate(addDays(p.date, 1)) }}
          className="text-orange-400 text-sm px-3 py-2 border border-slate-700 rounded-lg active:bg-slate-800">Next &gt;</button>
      </div>

      {CATEGORIES.map(function(c) {
        var catItems = p.items.filter(function(i) { return i.category === c.key && !i.archived })
        var dayEntries = p.entries.filter(function(e) { return e.entry_date === p.date && e.category === c.key })
        var reportEntries = dayEntries.filter(function(e) { return e._source === 'report' })
        var subtotalByUnit = {}
        dayEntries.forEach(function(e) {
          var u = e.unit || ''
          subtotalByUnit[u] = (subtotalByUnit[u] || 0) + (parseFloat(e.quantity) || 0)
        })
        return (
          <div key={c.key} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">{c.label}</p>
              <p className="text-orange-400 text-xs font-mono">
                {Object.keys(subtotalByUnit).length === 0 ? '—' : Object.keys(subtotalByUnit).map(function(u) { return fmtNum(subtotalByUnit[u]) + (u ? ' ' + u : '') }).join(' · ')}
              </p>
            </div>
            {catItems.length === 0 ? (
              <p className="text-slate-600 text-xs italic px-3 py-2">No items yet. Tap "+ Add {c.label}" to start.</p>
            ) : (
              <div className="space-y-1.5">
                {catItems.map(function(item) {
                  var entry = p.entries.find(function(e) { return e._source !== 'report' && e.entry_date === p.date && (e.item_id === item.id || (e.category === item.category && e.description === item.description && (e.unit || '') === (item.unit || ''))) })
                  var qty = entry ? (parseFloat(entry.quantity) || 0) : null
                  var hasEntry = qty != null && qty !== 0
                  var breakdown = entry && entry.count != null && entry.per_unit != null && parseFloat(entry.count) !== 1
                    ? fmtNum(entry.count) + ' × ' + fmtNum(entry.per_unit)
                    : null
                  return (
                    <div key={item.id} className="flex items-stretch gap-2">
                      <button onClick={function() { p.onTapLog({ item: item, date: p.date, entry: entry || null }) }}
                        className={'flex-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-left border ' + (hasEntry ? 'bg-orange-500/10 border-orange-500/40 active:bg-orange-500/20' : 'bg-slate-800 border-slate-700 active:bg-slate-700')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm truncate">{item.description}</p>
                          {item.unit && <p className="text-slate-500 text-xs">{item.unit}</p>}
                        </div>
                        <div className="text-right ml-2">
                          {breakdown && <p className="text-slate-500 text-xs font-mono">{breakdown}</p>}
                          <p className={'text-base font-mono ' + (hasEntry ? 'text-orange-300' : 'text-slate-600')}>
                            {hasEntry ? fmtNum(qty) : '+'}
                          </p>
                        </div>
                      </button>
                      <button onClick={function() { p.onEditItem(item) }}
                        className="px-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-500 text-xs active:bg-slate-700">
                        Edit
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={function() { p.onAddItem(c.key) }}
              className="w-full mt-2 border border-dashed border-slate-700 rounded-xl py-2 text-orange-400 text-xs active:bg-slate-800">
              + Add {c.label}
            </button>
            {reportEntries.length > 0 && (
              <div className="mt-3">
                <p className="text-slate-600 text-xs uppercase tracking-wider mb-1.5">From Daily Reports</p>
                <div className="space-y-1.5">
                  {reportEntries.map(function(e) {
                    var bd = e.count != null && e.per_unit != null && parseFloat(e.count) !== 1
                      ? fmtNum(e.count) + ' × ' + fmtNum(e.per_unit) + ' '
                      : ''
                    return (
                      <div key={e.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 text-sm truncate">{e.description}</p>
                          <p className="text-slate-600 text-xs">Report #{e.report_number}{bd ? ' · ' + bd + (e.unit || 'hrs') : ''}</p>
                        </div>
                        <p className="text-slate-400 text-sm font-mono ml-2">{fmtNum(e.quantity)} {e.unit || ''}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WeekView(p) {
  var days = []
  for (var i = 0; i < 7; i++) days.push(addDays(p.weekStart, i))
  var weekEnd = days[6]
  var weekEntries = p.entries.filter(function(e) { return e.entry_date >= p.weekStart && e.entry_date <= weekEnd })
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={function() { p.setDate(addDays(p.weekStart, -7)) }}
          className="text-orange-400 text-sm px-3 py-2 border border-slate-700 rounded-lg active:bg-slate-800">&lt; Prev Week</button>
        <p className="text-white text-sm font-semibold">{fmtShort(p.weekStart)} – {fmtShort(weekEnd)}</p>
        <button onClick={function() { p.setDate(addDays(p.weekStart, 7)) }}
          className="text-orange-400 text-sm px-3 py-2 border border-slate-700 rounded-lg active:bg-slate-800">Next &gt;</button>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4">
        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-2">Week Summary</p>
        {CATEGORIES.map(function(c) {
          var byUnit = {}
          weekEntries.filter(function(e) { return e.category === c.key }).forEach(function(e) {
            var u = e.unit || ''
            byUnit[u] = (byUnit[u] || 0) + (parseFloat(e.quantity) || 0)
          })
          var keys = Object.keys(byUnit)
          if (keys.length === 0) return <p key={c.key} className="text-slate-600 text-xs">{c.label}: —</p>
          return (
            <p key={c.key} className="text-slate-300 text-sm">
              <span className="text-slate-500 text-xs uppercase mr-2">{c.label}</span>
              {keys.map(function(u) { return fmtNum(byUnit[u]) + (u ? ' ' + u : '') }).join(' · ')}
            </p>
          )
        })}
      </div>

      <div className="space-y-2">
        {days.map(function(d) {
          var dayRows = weekEntries.filter(function(e) { return e.entry_date === d })
          if (dayRows.length === 0) return (
            <button key={d} onClick={function() { p.setDate(d) }}
              className="w-full text-left px-3 py-2 border border-slate-800 rounded-xl active:bg-slate-800">
              <p className="text-slate-600 text-xs">{fmtShort(d)} — no entries</p>
            </button>
          )
          var perCat = {}
          CATEGORIES.forEach(function(c) {
            var sum = dayRows.filter(function(r) { return r.category === c.key }).reduce(function(s, r) { return s + (parseFloat(r.quantity) || 0) }, 0)
            if (sum > 0) perCat[c.short] = sum
          })
          return (
            <button key={d} onClick={function() { p.setDate(d) }}
              className="w-full text-left bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 active:bg-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-slate-200 text-sm font-semibold">{fmtShort(d)}</p>
                <p className="text-slate-500 text-xs">{dayRows.length} entries</p>
              </div>
              <p className="text-orange-400 text-xs font-mono mt-1">
                {Object.keys(perCat).map(function(k) { return k + ' ' + fmtNum(perCat[k]) }).join('  ·  ')}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TotalsView(p) {
  return (
    <div className="space-y-4">
      {CATEGORIES.map(function(c) {
        var rows = p.entries.filter(function(e) { return e.category === c.key })
        var groups = {}
        rows.forEach(function(r) {
          var key = (r.description || '') + '||' + (r.unit || '')
          if (!groups[key]) groups[key] = { description: r.description, unit: r.unit || '', quantity: 0, count: 0 }
          groups[key].quantity += parseFloat(r.quantity) || 0
          groups[key].count += 1
        })
        var grouped = Object.values(groups).sort(function(a, b) { return b.quantity - a.quantity })
        var grandByUnit = {}
        rows.forEach(function(r) {
          var u = r.unit || ''
          grandByUnit[u] = (grandByUnit[u] || 0) + (parseFloat(r.quantity) || 0)
        })
        var grandKeys = Object.keys(grandByUnit)
        return (
          <div key={c.key}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">{c.label}</p>
              <p className="text-orange-400 text-sm font-mono">
                {grandKeys.length === 0 ? '—' : grandKeys.map(function(u) { return fmtNum(grandByUnit[u]) + (u ? ' ' + u : '') }).join(' · ')}
              </p>
            </div>
            {grouped.length === 0 ? (
              <p className="text-slate-600 text-xs italic px-3 py-2">No entries.</p>
            ) : (
              <div className="space-y-1.5">
                {grouped.map(function(g, i) {
                  return (
                    <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm truncate">{g.description}</p>
                        <p className="text-slate-500 text-xs">{g.count} entries</p>
                      </div>
                      <p className="text-orange-400 text-sm font-mono ml-2">{fmtNum(g.quantity)} {g.unit}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ItemModal(p) {
  var initial = p.item || {}
  var category = p.category || initial.category || 'labor'
  var def = (CATEGORIES.find(function(c) { return c.key === category }) || {}).defaultUnit || ''
  var [form, setForm] = useState({
    id: initial.id || null,
    category: category,
    description: initial.description || '',
    unit: initial.unit != null ? initial.unit : def,
  })
  var [saving, setSaving] = useState(false)

  function set(k, v) { setForm(function(prev) { return Object.assign({}, prev, { [k]: v }) }) }

  async function submit() {
    if (!form.description.trim()) { alert('Description is required.'); return }
    setSaving(true)
    await p.onSave({
      id: form.id,
      category: form.category,
      description: form.description.trim(),
      unit: form.unit.trim(),
    })
    setSaving(false)
  }

  var catLabel = (CATEGORIES.find(function(c) { return c.key === form.category }) || {}).label || ''

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700">
        <button onClick={p.onCancel} className="text-orange-400 text-sm">Cancel</button>
        <p className="text-white text-sm font-semibold">{p.mode === 'edit' ? 'Edit ' + catLabel + ' Item' : 'Add ' + catLabel + ' Item'}</p>
        <button onClick={submit} disabled={saving} className="text-orange-400 text-sm font-semibold disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Description<span className="text-orange-400 ml-1">*</span></p>
          <input type="text" value={form.description} onChange={function(e) { set('description', e.target.value) }}
            placeholder={form.category === 'labor' ? 'e.g. Foreman — John Doe' : form.category === 'equipment' ? 'e.g. CAT 320 Excavator' : 'e.g. Class 5 gravel'}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Unit</p>
          <input type="text" value={form.unit} onChange={function(e) { set('unit', e.target.value) }}
            placeholder="hrs, ea, cy, ton..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        {p.mode === 'edit' && p.onDelete && (
          <button onClick={function() { p.onDelete(form.id) }}
            className="w-full border border-red-800 text-red-400 py-2.5 rounded-xl text-sm active:bg-red-900/20 mt-4">
            Archive Item
          </button>
        )}
      </div>
    </div>
  )
}

function LogQuantityModal(p) {
  var existing = p.target.entry
  var item = p.target.item
  var splitMode = item.category === 'labor' || item.category === 'equipment'
  var [count, setCount] = useState(existing && existing.count != null ? String(existing.count) : (splitMode ? '1' : '1'))
  var [perUnit, setPerUnit] = useState(existing && existing.per_unit != null ? String(existing.per_unit) : '')
  var [qty, setQty] = useState(existing ? String(existing.quantity) : '')
  var [saving, setSaving] = useState(false)

  var computedTotal = (function() {
    if (splitMode) {
      var c = parseFloat(count) || 0
      var pu = parseFloat(perUnit)
      if (isNaN(pu)) return null
      return c * pu
    }
    return parseFloat(qty)
  })()

  async function submit() {
    setSaving(true)
    var payload = splitMode
      ? { count: count, per_unit: perUnit }
      : { count: 1, per_unit: null, quantity: qty || '0' }
    await p.onSave(item, p.target.date, payload, existing ? existing.id : null)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={p.onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm" onClick={function(e) { e.stopPropagation() }}>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{fmtShort(p.target.date)}</p>
        <p className="text-white text-base font-semibold mb-1">{item.description}</p>
        {item.unit && <p className="text-slate-500 text-xs mb-4">Unit: {item.unit}</p>}

        {splitMode ? (
          <div className="space-y-3 mb-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Count</p>
                <input type="number" inputMode="decimal" value={count} onChange={function(e) { setCount(e.target.value) }}
                  placeholder="1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-xl text-center focus:outline-none focus:border-orange-500" />
              </div>
              <p className="text-slate-500 text-xl pb-3">×</p>
              <div className="flex-1">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Hours each</p>
                <input type="number" inputMode="decimal" value={perUnit} onChange={function(e) { setPerUnit(e.target.value) }}
                  placeholder="0" autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-xl text-center focus:outline-none focus:border-orange-500" />
              </div>
            </div>
            {computedTotal != null && !isNaN(computedTotal) && (
              <p className="text-slate-400 text-xs text-center">= {fmtNum(computedTotal)} {item.unit || 'hrs'} total</p>
            )}
          </div>
        ) : (
          <input type="number" inputMode="decimal" value={qty} onChange={function(e) { setQty(e.target.value) }}
            placeholder="0" autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-2xl text-center focus:outline-none focus:border-orange-500 mb-4" />
        )}

        <div className="flex gap-2">
          <button onClick={p.onCancel}
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 py-3 rounded-xl text-sm font-semibold active:bg-slate-700">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl text-sm font-semibold active:bg-orange-600 disabled:opacity-40">
            {saving ? 'Saving...' : (existing ? 'Update' : 'Log')}
          </button>
        </div>
        {existing && (
          <p className="text-slate-600 text-xs text-center mt-3">Set to 0 to remove this entry.</p>
        )}
      </div>
    </div>
  )
}
