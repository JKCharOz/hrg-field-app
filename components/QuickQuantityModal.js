'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function QuickQuantityModal(props) {
  var project = props.project
  var contractItem = props.contractItem
  var onClose = props.onClose
  var onChanged = props.onChanged

  var [entries, setEntries] = useState([])
  var [loading, setLoading] = useState(true)
  var [saving, setSaving] = useState(false)
  var [quantity, setQuantity] = useState('')
  var [entryDate, setEntryDate] = useState(todayStr())
  var [notes, setNotes] = useState('')
  var [editingId, setEditingId] = useState(null)

  useEffect(function() {
    if (project && project.id && contractItem && contractItem.id) { loadEntries() }
  }, [project && project.id, contractItem && contractItem.id])

  function todayStr() {
    var d = new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  function pad(n) { return n < 10 ? '0' + n : String(n) }

  async function loadEntries() {
    setLoading(true)
    var result = await supabase
      .from('quantity_entries')
      .select('*')
      .eq('project_id', project.id)
      .eq('contract_item_id', contractItem.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (!result.error && result.data) { setEntries(result.data) }
    setLoading(false)
  }

  async function handleSave() {
    var qty = parseFloat(quantity)
    if (isNaN(qty) || qty === 0 || saving) return
    setSaving(true)
    var auth = await supabase.auth.getUser()
    var userId = auth.data && auth.data.user ? auth.data.user.id : null
    var payload = {
      org_id: project.org_id,
      project_id: project.id,
      contract_item_id: contractItem.id,
      report_id: null,
      entry_date: entryDate,
      quantity: qty,
      source: 'quick_entry',
      notes: notes.trim() || null,
      created_by: userId,
    }
    var result = await supabase.from('quantity_entries').insert(payload).select().single()
    setSaving(false)
    if (result.error) { alert('Save failed: ' + result.error.message); return }
    setEntries(function(prev) { return [result.data].concat(prev) })
    setQuantity('')
    setNotes('')
    setEntryDate(todayStr())
    if (onChanged) { onChanged() }
  }

  async function handleSaveEdit(id, qty, date, noteText) {
    var parsed = parseFloat(qty)
    if (isNaN(parsed)) { alert('Quantity must be a number'); return }
    var result = await supabase
      .from('quantity_entries')
      .update({ quantity: parsed, entry_date: date, notes: noteText.trim() || null })
      .eq('id', id)
      .select()
      .single()
    if (result.error) { alert('Update failed: ' + result.error.message); return }
    setEntries(function(prev) { return prev.map(function(e) { return e.id === id ? result.data : e }) })
    setEditingId(null)
    if (onChanged) { onChanged() }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return
    var result = await supabase.from('quantity_entries').delete().eq('id', id)
    if (result.error) { alert('Delete failed: ' + result.error.message); return }
    setEntries(function(prev) { return prev.filter(function(e) { return e.id !== id }) })
    if (onChanged) { onChanged() }
  }

  var contractQty = parseFloat(contractItem && contractItem.contract_quantity) || 0
  var totalLogged = entries.reduce(function(s, e) { return s + (parseFloat(e.quantity) || 0) }, 0)
  var quickTotal = entries.filter(function(e) { return e.source === 'quick_entry' }).reduce(function(s, e) { return s + (parseFloat(e.quantity) || 0) }, 0)
  var reportTotal = totalLogged - quickTotal
  var pct = contractQty > 0 ? Math.round(totalLogged / contractQty * 1000) / 10 : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <button onClick={onClose} className="text-slate-400 text-sm active:text-white">Cancel</button>
        <p className="text-white text-sm font-semibold">Quick Entry</p>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-3">
          <p className="text-orange-400 text-xs font-mono">{contractItem.item_number}</p>
          <p className="text-white text-sm font-semibold mt-0.5">{contractItem.description}</p>
          <p className="text-slate-500 text-xs mt-1">
            Contract: {formatNum(contractQty)} {contractItem.unit}
            {contractItem.unit_price ? ' @ $' + Number(contractItem.unit_price).toFixed(2) : ''}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex-1">
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: Math.min(pct, 100) + '%' }} />
              </div>
            </div>
            <span className="text-slate-400 text-xs font-mono">{formatNum(totalLogged)} / {formatNum(contractQty)} {contractItem.unit} · {pct}%</span>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3 border-b border-slate-800">
          <p className="text-slate-500 text-xs uppercase tracking-wider">Add Entry</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input type="date" value={entryDate} onChange={function(e) { setEntryDate(e.target.value) }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div className="w-28">
              <input type="number" inputMode="decimal" value={quantity} onChange={function(e) { setQuantity(e.target.value) }}
                placeholder={'Qty ' + (contractItem.unit || '')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm text-right focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <input type="text" value={notes} onChange={function(e) { setNotes(e.target.value) }}
            placeholder="Note (optional, e.g. Sta 12+00 to 14+50)"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          <button onClick={handleSave} disabled={saving || !quantity.trim()}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40">
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Entries</p>
            <p className="text-slate-600 text-xs">{entries.length}</p>
          </div>
          {loading && <p className="text-slate-600 text-sm text-center py-4">Loading...</p>}
          {!loading && entries.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No entries yet</p>}
          {!loading && entries.length > 0 && reportTotal > 0 && (
            <p className="text-slate-600 text-xs mb-2">
              {formatNum(quickTotal)} {contractItem.unit} from quick entries ·{' '}
              {formatNum(reportTotal)} {contractItem.unit} from daily reports
            </p>
          )}
          <div className="space-y-1.5">
            {entries.map(function(e) {
              return editingId === e.id
                ? <EditRow key={e.id} entry={e} unit={contractItem.unit} onSave={handleSaveEdit} onCancel={function() { setEditingId(null) }} />
                : <EntryRow key={e.id} entry={e} unit={contractItem.unit} onEdit={function() { setEditingId(e.id) }} onDelete={function() { handleDelete(e.id) }} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function EntryRow(props) {
  var e = props.entry
  var isReport = e.source === 'report'
  return (
    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-200 text-sm font-mono">{formatNum(parseFloat(e.quantity) || 0)} {props.unit}</span>
          <span className="text-slate-500 text-xs">{e.entry_date}</span>
          {isReport && <span className="text-slate-600 text-[10px] uppercase tracking-wider border border-slate-700 rounded px-1.5 py-0.5">Report</span>}
        </div>
        {e.notes && <p className="text-slate-500 text-xs truncate mt-0.5">{e.notes}</p>}
      </div>
      {!isReport && (
        <>
          <button onClick={props.onEdit} className="text-slate-500 active:text-orange-400 text-xs px-2">Edit</button>
          <button onClick={props.onDelete} className="text-slate-600 active:text-red-400 text-xs px-1">x</button>
        </>
      )}
    </div>
  )
}

function EditRow(props) {
  var e = props.entry
  var [qty, setQty] = useState(String(e.quantity || ''))
  var [date, setDate] = useState(e.entry_date || '')
  var [note, setNote] = useState(e.notes || '')
  return (
    <div className="bg-slate-800 border border-orange-500/40 rounded-xl px-3 py-2 space-y-2">
      <div className="flex gap-2">
        <input type="date" value={date} onChange={function(ev) { setDate(ev.target.value) }}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
        <input type="number" inputMode="decimal" value={qty} onChange={function(ev) { setQty(ev.target.value) }}
          className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs text-right focus:outline-none focus:border-orange-500" />
      </div>
      <input type="text" value={note} onChange={function(ev) { setNote(ev.target.value) }}
        placeholder="Note"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-orange-500" />
      <div className="flex gap-2">
        <button onClick={function() { props.onSave(e.id, qty, date, note) }}
          className="flex-1 bg-orange-500 text-white font-semibold py-1.5 rounded-lg text-xs active:bg-orange-600">Save</button>
        <button onClick={props.onCancel}
          className="px-3 border border-slate-600 text-slate-400 py-1.5 rounded-lg text-xs active:bg-slate-700">Cancel</button>
      </div>
    </div>
  )
}

function formatNum(n) {
  if (n === Math.floor(n)) return String(n)
  return n.toFixed(1)
}
