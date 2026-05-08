'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

var CATEGORIES = [
  { key: 'labor', label: 'Labor', short: 'Labor', defaultUnit: 'hrs', accent: 'teal' },
  { key: 'equipment', label: 'Equipment', short: 'Equip', defaultUnit: 'hrs', accent: 'orange' },
  { key: 'material', label: 'Material', short: 'Material', defaultUnit: 'cy', accent: 'emerald' },
]

function pad2(n) { return String(n).padStart(2, '0') }
function localToday() {
  var d = new Date()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}
function parseISO(s) {
  var p = s.split('-').map(Number)
  return new Date(p[0], p[1] - 1, p[2])
}
function fmtISO(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}
function addDays(s, n) {
  var d = parseISO(s)
  d.setDate(d.getDate() + n)
  return fmtISO(d)
}
function weekStartOf(s) {
  var d = parseISO(s)
  d.setDate(d.getDate() - d.getDay()) // Sunday start
  return fmtISO(d)
}
function fmtLong(s) {
  var d = parseISO(s)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtShort(s) {
  var d = parseISO(s)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtNum(n) {
  var v = parseFloat(n) || 0
  if (v === Math.round(v)) return String(Math.round(v))
  return v.toFixed(2).replace(/\.?0+$/, '')
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
  var [entries, setEntries] = useState([])
  var [view, setView] = useState('day')
  var [selectedDate, setSelectedDate] = useState(localToday())
  var [editing, setEditing] = useState(null)

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
    var ent = await supabase.from('tm_entries').select('*').eq('project_id', projectId).order('entry_date', { ascending: false }).order('created_at', { ascending: false })
    setEntries(ent.data || [])
    setLoading(false)
  }

  async function saveEntry(payload) {
    if (payload.id) {
      var r = await supabase.from('tm_entries').update({
        entry_date: payload.entry_date,
        category: payload.category,
        description: payload.description,
        quantity: payload.quantity,
        unit: payload.unit || null,
        notes: payload.notes || null,
      }).eq('id', payload.id)
      if (r.error) { alert('Save failed: ' + r.error.message); return }
    } else {
      var r2 = await supabase.from('tm_entries').insert({
        org_id: orgId,
        project_id: projectId,
        entry_date: payload.entry_date,
        category: payload.category,
        description: payload.description,
        quantity: payload.quantity,
        unit: payload.unit || null,
        notes: payload.notes || null,
        created_by: userId,
      })
      if (r2.error) { alert('Save failed: ' + r2.error.message); return }
    }
    setEditing(null)
    loadAll()
  }

  async function deleteEntry(id) {
    if (!window.confirm('Delete this entry?')) return
    var r = await supabase.from('tm_entries').delete().eq('id', id)
    if (r.error) { alert('Delete failed: ' + r.error.message); return }
    setEntries(function(prev) { return prev.filter(function(e) { return e.id !== id }) })
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
        {view === 'day' && <DayView date={selectedDate} setDate={setSelectedDate} entries={entries} onAdd={function(cat) { setEditing({ category: cat, entry_date: selectedDate }) }} onEdit={setEditing} onDelete={deleteEntry} />}
        {view === 'week' && <WeekView weekStart={weekStartOf(selectedDate)} setDate={setSelectedDate} entries={entries} />}
        {view === 'totals' && <TotalsView entries={entries} />}
      </div>

      {editing && <EntryModal entry={editing} onCancel={function() { setEditing(null) }} onSave={saveEntry}
        onDelete={async function(id) { await deleteEntry(id); setEditing(null) }} />}
    </div>
  )
}

function DayView(p) {
  var dayEntries = p.entries.filter(function(e) { return e.entry_date === p.date })
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

      <div className="grid grid-cols-3 gap-2 mb-4">
        {CATEGORIES.map(function(c) {
          return (
            <button key={c.key} onClick={function() { p.onAdd(c.key) }}
              className="bg-slate-800 border border-slate-700 rounded-xl py-3 active:bg-slate-700">
              <p className="text-orange-400 text-xs font-semibold">+ {c.short}</p>
            </button>
          )
        })}
      </div>

      {CATEGORIES.map(function(c) {
        var rows = dayEntries.filter(function(e) { return e.category === c.key })
        var subtotal = rows.reduce(function(s, r) { return s + (parseFloat(r.quantity) || 0) }, 0)
        return (
          <div key={c.key} className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">{c.label}</p>
              {rows.length > 0 && <p className="text-slate-500 text-xs">{rows.length} entries · {fmtNum(subtotal)} total</p>}
            </div>
            {rows.length === 0 ? (
              <p className="text-slate-600 text-xs italic px-3 py-2">No {c.label.toLowerCase()} logged.</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map(function(r) {
                  return (
                    <button key={r.id} onClick={function() { p.onEdit(r) }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-left active:bg-slate-700">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-200 text-sm">{r.description}</p>
                        <p className="text-orange-400 text-sm font-mono">{fmtNum(r.quantity)} {r.unit || ''}</p>
                      </div>
                      {r.notes && <p className="text-slate-500 text-xs mt-1">{r.notes}</p>}
                    </button>
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
          if (keys.length === 0) {
            return <p key={c.key} className="text-slate-600 text-xs">{c.label}: —</p>
          }
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
                      <div>
                        <p className="text-slate-200 text-sm">{g.description}</p>
                        <p className="text-slate-500 text-xs">{g.count} entries</p>
                      </div>
                      <p className="text-orange-400 text-sm font-mono">{fmtNum(g.quantity)} {g.unit}</p>
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

function EntryModal(p) {
  var [form, setForm] = useState({
    id: p.entry.id || null,
    entry_date: p.entry.entry_date || localToday(),
    category: p.entry.category || 'labor',
    description: p.entry.description || '',
    quantity: p.entry.quantity != null ? String(p.entry.quantity) : '',
    unit: p.entry.unit || (CATEGORIES.find(function(c) { return c.key === (p.entry.category || 'labor') }) || {}).defaultUnit || '',
    notes: p.entry.notes || '',
  })
  var [saving, setSaving] = useState(false)

  function set(k, v) { setForm(function(prev) { return Object.assign({}, prev, { [k]: v }) }) }

  function changeCategory(cat) {
    var def = (CATEGORIES.find(function(c) { return c.key === cat }) || {}).defaultUnit || ''
    setForm(function(prev) { return Object.assign({}, prev, { category: cat, unit: prev.unit || def }) })
  }

  async function submit() {
    if (!form.description.trim()) { alert('Description is required.'); return }
    var q = parseFloat(form.quantity)
    if (isNaN(q)) { alert('Quantity must be a number.'); return }
    setSaving(true)
    await p.onSave({
      id: form.id,
      entry_date: form.entry_date,
      category: form.category,
      description: form.description.trim(),
      quantity: q,
      unit: form.unit.trim(),
      notes: form.notes.trim(),
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700">
        <button onClick={p.onCancel} className="text-orange-400 text-sm">Cancel</button>
        <p className="text-white text-sm font-semibold">{form.id ? 'Edit Entry' : 'New Entry'}</p>
        <button onClick={submit} disabled={saving} className="text-orange-400 text-sm font-semibold disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Category</p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(function(c) {
              return (
                <button key={c.key} type="button" onClick={function() { changeCategory(c.key) }}
                  className={'rounded-xl py-2.5 text-sm font-semibold border ' + (form.category === c.key ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-800 text-slate-300 border-slate-700 active:bg-slate-700')}>
                  {c.short}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Date</p>
          <input type="date" value={form.entry_date} onChange={function(e) { set('entry_date', e.target.value) }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>

        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Description<span className="text-orange-400 ml-1">*</span></p>
          <input type="text" value={form.description} onChange={function(e) { set('description', e.target.value) }}
            placeholder={form.category === 'labor' ? 'e.g. Foreman — John Doe' : form.category === 'equipment' ? 'e.g. CAT 320 Excavator' : 'e.g. Class 5 gravel'}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quantity<span className="text-orange-400 ml-1">*</span></p>
            <input type="number" inputMode="decimal" value={form.quantity} onChange={function(e) { set('quantity', e.target.value) }}
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Unit</p>
            <input type="text" value={form.unit} onChange={function(e) { set('unit', e.target.value) }}
              placeholder="hrs, ea, cy..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
        </div>

        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Notes</p>
          <textarea value={form.notes} onChange={function(e) { set('notes', e.target.value) }}
            rows={3} placeholder="Optional"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>

        {form.id && p.onDelete && (
          <button onClick={function() { p.onDelete(form.id) }}
            className="w-full border border-red-800 text-red-400 py-2.5 rounded-xl text-sm active:bg-red-900/20">
            Delete Entry
          </button>
        )}
      </div>
    </div>
  )
}
