'use client'
// components/ActivityTimeline.js
// Displays the Work Observed list of activity_log entries.
// Supports inline edit and delete. No add input — that lives in page.js.

import { useState } from 'react'

export function ActivityTimeline({ entries = [], onEdit, onDelete, loading = false }) {
const sorted = [...entries].sort(
(a, b) => new Date(a.logged_at) - new Date(b.logged_at)
)

if (loading) {
return (
<div className="px-4 space-y-2">
{[0, 1, 2].map(i => (
<div key={i} className="h-14 rounded-xl bg-slate-800 animate-pulse" />
))}
</div>
)
}

if (sorted.length === 0) {
return (
<div className="px-4 text-center py-10">
<p className="text-4xl mb-2">📋</p>
<p className="text-slate-500 text-sm">No activities logged yet</p>
</div>
)
}

return (
<div className="px-4">
<div className="relative space-y-2.5">
{/* Vertical timeline line */}
{sorted.length > 1 && (
<div className="absolute left-[3.25rem] top-4 bottom-4 w-px bg-slate-700" />
)}

    {sorted.map(entry => (
      <EntryRow
        key={entry.id}
        entry={entry}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ))}
  </div>
</div>

)
}

function EntryRow({ entry, onEdit, onDelete }) {
const [editMode, setEditMode]   = useState(false)
const [editText, setEditText] = useState('')
  const [editTime, setEditTime] = useState('')
const [busy,     setBusy]       = useState(false)

const time = new Date(entry.logged_at).toLocaleTimeString('en-US', {
hour: 'numeric', minute: '2-digit', hour12: true,
})
// Split "9:05 AM" → ["9:05", "AM"]
const [hhmm, ampm] = time.split(' ')
  const timeFor24 = new Date(entry.logged_at).toTimeString().slice(0,5)

const startEdit = () => {
setEditText(entry.generated_text ?? entry.notes ?? '')
setEditMode(true)
}

const saveEdit = async () => {
if (!editText.trim() || busy) return
setBusy(true)
var d = new Date(entry.logged_at)
      if (editTime) {
        var parts = editTime.split(':')
        d.setHours(parseInt(parts[0]))
        d.setMinutes(parseInt(parts[1]))
      }
      await onEdit(entry.id, { notes: editText.trim(), logged_at: d.toISOString() })
setEditMode(false)
setBusy(false)
}

const handleDelete = async () => {
setBusy(true)
await onDelete(entry.id)
// component unmounts after delete; no need to reset state
}

return (
<div className="flex items-start gap-3">

  {/* Time column */}
  <div className="w-12 flex-shrink-0 text-right pt-1">
    <span className="text-orange-400 text-xs font-mono font-bold leading-none block">{hhmm}</span>
    <span className="text-slate-600 text-[10px] font-mono">{ampm}</span>
  </div>

  {/* Timeline dot */}
  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5 ring-2 ring-slate-900 z-10" />

  {/* Card */}
  <div className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
    {editMode ? (
      <div className="space-y-2">
        <input type="time" value={editTime} onChange={function(e) { setEditTime(e.target.value) }}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500" />
        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          rows={2}
          autoFocus
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5
            text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
        />
        <div className="flex gap-3">
          <button
            onClick={saveEdit}
            disabled={busy}
            className="text-orange-400 text-xs font-semibold disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => setEditMode(false)}
            className="text-slate-500 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div className="flex items-start justify-between gap-2">
        <p className="text-slate-200 text-sm leading-snug">
          {entry.generated_text ?? entry.notes ?? '—'}
        </p>
        <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
          <button
            onClick={startEdit}
            className="text-slate-500 active:text-slate-300 text-xs"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-slate-600 active:text-red-400 text-xs disabled:opacity-40"
          >
            ×
          </button>
        </div>
      </div>
    )}
  </div>
</div>

)
}
