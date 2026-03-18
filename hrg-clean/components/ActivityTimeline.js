'use client'
import { useState } from 'react'

export function ActivityTimeline(props) {
  var entries = props.entries || []
  var onEdit = props.onEdit
  var onDelete = props.onDelete
  var sorted = entries.slice().sort(function(a, b) { return new Date(a.logged_at) - new Date(b.logged_at) })
  if (sorted.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-slate-500 text-sm">No activities logged yet</p>
      </div>
    )
  }
  return (
    <div className="px-4">
      <div className="relative space-y-2.5">
        {sorted.length > 1 && (
          <div style={{ position: 'absolute', left: '3.25rem', top: '1rem', bottom: '1rem', width: '1px', backgroundColor: 'rgb(51 65 85)' }} />
        )}
        {sorted.map(function(entry) {
          return <EntryRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
        })}
      </div>
    </div>
  )
}

function EntryRow(props) {
  var entry = props.entry
  var onEdit = props.onEdit
  var onDelete = props.onDelete
  var [editMode, setEditMode] = useState(false)
  var [editText, setEditText] = useState('')
  var [busy, setBusy] = useState(false)
  var d = new Date(entry.logged_at)
  var hours = d.getHours()
  var minutes = d.getMinutes()
  var ampm = hours >= 12 ? 'PM' : 'AM'
  var h12 = hours % 12 || 12
  var mm = minutes < 10 ? '0' + minutes : '' + minutes
  var hhmm = h12 + ':' + mm

  function startEdit() { setEditText(entry.generated_text || entry.notes || ''); setEditMode(true) }

  async function saveEdit() {
    if (!editText.trim() || busy) return
    setBusy(true)
    await onEdit(entry.id, { notes: editText.trim(), generated_text: editText.trim() })
    setEditMode(false)
    setBusy(false)
  }

  async function handleDelete() { setBusy(true); await onDelete(entry.id) }

  return (
    <div className="flex items-start gap-3">
      <div className="w-12 flex-shrink-0 text-right pt-1">
        <span className="text-orange-400 text-xs font-mono font-bold leading-none block">{hhmm}</span>
        <span className="text-slate-600" style={{ fontSize: '10px', fontFamily: 'monospace' }}>{ampm}</span>
      </div>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgb(249 115 22)', flexShrink: 0, marginTop: '6px', position: 'relative', zIndex: 10, outline: '2px solid rgb(2 6 23)' }} />
      <div className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
        {editMode ? (
          <div className="space-y-2">
            <textarea value={editText} onChange={function(e) { setEditText(e.target.value) }} rows={2} autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
            <div className="flex gap-3">
              <button onClick={saveEdit} disabled={busy} className="text-orange-400 text-xs font-semibold disabled:opacity-40">Save</button>
              <button onClick={function() { setEditMode(false) }} className="text-slate-500 text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-200 text-sm leading-snug">{entry.generated_text || entry.notes || ''}</p>
            <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
              <button onClick={startEdit} className="text-slate-500 active:text-slate-300 text-xs">Edit</button>
              <button onClick={handleDelete} disabled={busy} className="text-slate-600 active:text-red-400 text-xs disabled:opacity-40">x</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
