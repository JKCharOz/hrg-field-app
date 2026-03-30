'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function QuantityModal(props) {
  var report = props.report
  var onClose = props.onClose
  var onSaved = props.onSaved

  var [presets, setPresets] = useState([])
  var [description, setDescription] = useState('')
  var [quantity, setQuantity] = useState('')
  var [unit, setUnit] = useState('LF')
  var [customUnit, setCustomUnit] = useState('')
  var [locationNotes, setLocationNotes] = useState('')
  var [saving, setSaving] = useState(false)
  var [editMode, setEditMode] = useState(false)
  var [editingEntry, setEditingEntry] = useState(null)
  var [newLabel, setNewLabel] = useState('')
  var [addingPreset, setAddingPreset] = useState(false)
  var [installed, setInstalled] = useState([])

  var UNITS = ['CY', 'LF', 'SY', 'EA', 'TON', 'LS', 'Other']

  useEffect(function() {
    if (report && report.org_id) { loadPresets() }
    if (report && report.id) { loadInstalled() }
  }, [report && report.id])

  async function loadPresets() {
    var result = await supabase.from('material_presets').select('*').eq('org_id', report.org_id).order('sort_order', { ascending: true })
    if (!result.error && result.data) { setPresets(result.data) }
  }

  async function loadInstalled() {
    var result = await supabase.from('materials').select('*').eq('report_id', report.id).eq('is_delivery', false).order('logged_at', { ascending: true })
    if (!result.error && result.data) { setInstalled(result.data) }
  }

  async function handleSave() {
    if (!description.trim() || !quantity.trim() || saving) return
    setSaving(true)
    var finalUnit = unit === 'Other' ? customUnit.trim() : unit
    var insertResult = await supabase.from('materials').insert({
      report_id: report.id,
      project_id: report.project_id,
      org_id: report.org_id,
      material_type: description.trim(),
      quantity: quantity.trim(),
      unit: finalUnit,
      location_ref: locationNotes.trim() || null,
      is_delivery: false,
      logged_at: new Date().toISOString(),
    })
    setSaving(false)
    if (insertResult.error) { alert('Save failed: ' + insertResult.error.message); return }
    setDescription('')
    setQuantity('')
    setUnit('LF')
    setCustomUnit('')
    setLocationNotes('')
    loadInstalled()
    if (onSaved) { onSaved() }
  }

  async function saveEditInstalled(id, desc, qty, u, loc) {
    var result = await supabase.from('materials').update({
      material_type: desc.trim(),
      quantity: qty.trim(),
      unit: u,
      location_ref: loc.trim() || null,
    }).eq('id', id).select().single()
    if (!result.error && result.data) {
      setInstalled(function(prev) { return prev.map(function(m) { return m.id === id ? result.data : m }) })
    }
    setEditingEntry(null)
    if (onSaved) { onSaved() }
  }

  async function deleteInstalled(id) {
    await supabase.from('materials').delete().eq('id', id)
    setInstalled(function(prev) { return prev.filter(function(m) { return m.id !== id }) })
    if (onSaved) { onSaved() }
  }

  async function addPreset() {
    if (!newLabel.trim() || addingPreset) return
    setAddingPreset(true)
    var maxOrder = presets.reduce(function(m, p) { return Math.max(m, p.sort_order || 0) }, 0)
    var result = await supabase.from('material_presets').insert({
      org_id: report.org_id,
      label: newLabel.trim(),
      sort_order: maxOrder + 1,
      created_at: new Date().toISOString(),
    }).select().single()
    setAddingPreset(false)
    if (!result.error && result.data) { setPresets(function(prev) { return prev.concat([result.data]) }); setNewLabel('') }
  }

  async function deletePreset(id) {
    await supabase.from('material_presets').delete().eq('id', id)
    setPresets(function(prev) { return prev.filter(function(p) { return p.id !== id }) })
  }

  async function movePreset(preset, direction) {
    var current = preset.sort_order || 0
    var swap = presets.find(function(p) { return p.sort_order === current + direction })
    if (!swap) return
    await supabase.from('material_presets').update({ sort_order: current + direction }).eq('id', preset.id)
    await supabase.from('material_presets').update({ sort_order: current }).eq('id', swap.id)
    setPresets(function(prev) {
      return prev.map(function(p) {
        if (p.id === preset.id) return Object.assign({}, p, { sort_order: current + direction })
        if (p.id === swap.id) return Object.assign({}, p, { sort_order: current })
        return p
      }).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0) })
    })
  }

  if (editingEntry) {
    return (
      <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4">
          <p className="text-white font-bold">Edit Quantity Installed</p>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Description</p>
            <input type="text" defaultValue={editingEntry.material_type || ''} id="edit-qi-desc"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quantity</p>
              <input type="text" defaultValue={editingEntry.quantity || ''} id="edit-qi-qty"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Unit</p>
              <select defaultValue={editingEntry.unit || 'LF'} id="edit-qi-unit"
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
                {UNITS.map(function(u) { return <option key={u} value={u}>{u}</option> })}
              </select>
            </div>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Location / Notes</p>
            <input type="text" defaultValue={editingEntry.location_ref || ''} id="edit-qi-loc"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <button onClick={function() {
            saveEditInstalled(
              editingEntry.id,
              document.getElementById('edit-qi-desc').value,
              document.getElementById('edit-qi-qty').value,
              document.getElementById('edit-qi-unit').value,
              document.getElementById('edit-qi-loc').value
            )
          }} className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600">Save</button>
          <button onClick={function() { setEditingEntry(null) }} className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm">Cancel</button>
        </div>
      </div>
    )
  }

  if (editMode) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
        <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          <h3 className="text-white font-bold text-lg">Edit Presets</h3>
          <button onClick={function() { setEditMode(false) }} className="text-orange-400 text-sm active:text-orange-300">Done</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {presets.map(function(preset) {
            return (
              <div key={preset.id} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                <span className="flex-1 text-slate-200 text-sm">{preset.label}</span>
                <button onClick={function() { movePreset(preset, -1) }} disabled={preset.sort_order === presets[0].sort_order}
                  className="text-slate-500 text-xs px-2 py-1 bg-slate-700 rounded disabled:opacity-20 active:text-slate-200">Up</button>
                <button onClick={function() { movePreset(preset, 1) }} disabled={preset.sort_order === presets[presets.length - 1].sort_order}
                  className="text-slate-500 text-xs px-2 py-1 bg-slate-700 rounded disabled:opacity-20 active:text-slate-200">Dn</button>
                <button onClick={function() { deletePreset(preset.id) }}
                  className="text-red-400 text-xs px-2 py-1 border border-red-800 rounded-lg active:bg-red-900">Delete</button>
              </div>
            )
          })}
          {presets.length === 0 && <p className="text-slate-600 text-sm">No presets yet. Add one below.</p>}
          <div className="flex gap-2 pt-2">
            <input type="text" value={newLabel} onChange={function(e) { setNewLabel(e.target.value) }}
              placeholder="New preset label..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
            <button onClick={addPreset} disabled={!newLabel.trim() || addingPreset}
              className="bg-orange-500 text-white font-bold px-4 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40">Add</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4 max-h-screen overflow-y-auto" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Quantity Installed</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        {presets.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quick Select</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(function(preset) {
                return (
                  <button key={preset.id} onClick={function() { setDescription(preset.label) }}
                    className={'px-3 py-1.5 rounded-lg border text-sm transition-colors ' +
                      (description === preset.label ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-slate-600 bg-slate-700/40 text-slate-300 active:bg-slate-600')}>
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Description</p>
          <input type="text" value={description} onChange={function(e) { setDescription(e.target.value) }}
            placeholder="e.g. 8 inch PVC pipe, DIP, RCP..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quantity</p>
            <input type="text" value={quantity} onChange={function(e) { setQuantity(e.target.value) }}
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Unit</p>
            <select value={unit} onChange={function(e) { setUnit(e.target.value) }}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
              {UNITS.map(function(u) { return <option key={u} value={u}>{u}</option> })}
            </select>
          </div>
        </div>
        {unit === 'Other' && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Custom Unit</p>
            <input type="text" value={customUnit} onChange={function(e) { setCustomUnit(e.target.value) }}
              placeholder="Enter unit..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
        )}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Location / Notes</p>
          <textarea value={locationNotes} onChange={function(e) { setLocationNotes(e.target.value) }} rows={2}
            placeholder="e.g. MH-104 to MH-105, Station 10+00..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500 resize-none" />
        </div>
        <button onClick={handleSave} disabled={!description.trim() || !quantity.trim() || saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Add Quantity'}
        </button>
        <button onClick={function() { setEditMode(true) }}
          className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Edit Presets</button>
        <UnitConverter />
        {installed.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Added This Report</p>
            <div className="space-y-1.5">
              {installed.map(function(m) {
                return (
                  <div key={m.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-200 text-sm">{m.material_type}</span>
                      <span className="text-orange-400 text-xs font-mono ml-2">{m.quantity} {m.unit}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <button onClick={function() { setEditingEntry(m) }}
                        className="text-slate-500 active:text-slate-200 text-xs">Edit</button>
                      <button onClick={function() { deleteInstalled(m.id) }}
                        className="text-slate-600 active:text-red-400 text-xs">x</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <button onClick={onClose} className="w-full border border-slate-700 text-slate-600 py-2.5 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}

var CONVERSIONS = {
  'LF → FT':   { from: 'LF', to: 'FT', factor: 1 },
  'FT → LF':   { from: 'FT', to: 'LF', factor: 1 },
  'FT → YD':   { from: 'FT', to: 'YD', factor: 1 / 3 },
  'YD → FT':   { from: 'YD', to: 'FT', factor: 3 },
  'CY → CF':   { from: 'CY', to: 'CF', factor: 27 },
  'CF → CY':   { from: 'CF', to: 'CY', factor: 1 / 27 },
  'CY → tons': { from: 'CY', to: 'tons', factor: 1.4 },
  'tons → CY': { from: 'tons', to: 'CY', factor: 1 / 1.4 },
  'SY → SF':   { from: 'SY', to: 'SF', factor: 9 },
  'SF → SY':   { from: 'SF', to: 'SY', factor: 1 / 9 },
  'GAL → CF':  { from: 'GAL', to: 'CF', factor: 0.1337 },
  'IN → FT':   { from: 'IN', to: 'FT', factor: 1 / 12 },
  'FT → IN':   { from: 'FT', to: 'IN', factor: 12 },
}

function UnitConverter() {
  var [open, setOpen] = useState(false)
  var [mode, setMode] = useState('convert')
  var [convKey, setConvKey] = useState(Object.keys(CONVERSIONS)[0])
  var [inputVal, setInputVal] = useState('')
  var [dimL, setDimL] = useState('')
  var [dimW, setDimW] = useState('')
  var [dimD, setDimD] = useState('')
  var [dimUnit, setDimUnit] = useState('ft')

  var conv = CONVERSIONS[convKey]
  var convertResult = inputVal ? (parseFloat(inputVal) * conv.factor) : ''
  var convertDisplay = convertResult !== '' ? (Math.round(convertResult * 100) / 100) : ''

  var l = parseFloat(dimL) || 0
  var w = parseFloat(dimW) || 0
  var d = parseFloat(dimD) || 0
  var hasDims = l > 0 && w > 0 && d > 0
  var cfRaw = dimUnit === 'in' ? (l * w * d) / 1728 : l * w * d
  var cf = hasDims ? Math.round(cfRaw * 100) / 100 : ''
  var cy = hasDims ? Math.round((cfRaw / 27) * 100) / 100 : ''
  var tons = hasDims ? Math.round((cfRaw / 27 * 1.4) * 100) / 100 : ''
  var sf = ''
  if (parseFloat(dimL) > 0 && parseFloat(dimW) > 0) {
    var sfRaw = dimUnit === 'in' ? (l * w) / 144 : l * w
    sf = Math.round(sfRaw * 100) / 100
  }

  if (!open) {
    return (
      <button onClick={function() { setOpen(true) }}
        className="w-full border border-slate-700 text-slate-500 py-2.5 rounded-xl text-xs active:bg-slate-800">
        Unit Converter
      </button>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Unit Converter</p>
        <button onClick={function() { setOpen(false) }} className="text-slate-600 text-xs active:text-slate-300">Close</button>
      </div>
      <div className="flex gap-1">
        <button onClick={function() { setMode('convert') }}
          className={'flex-1 py-1.5 rounded-lg text-xs font-semibold ' + (mode === 'convert' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-slate-500 border border-slate-700')}>
          Convert
        </button>
        <button onClick={function() { setMode('dimensions') }}
          className={'flex-1 py-1.5 rounded-lg text-xs font-semibold ' + (mode === 'dimensions' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-slate-500 border border-slate-700')}>
          L × W × D
        </button>
      </div>
      {mode === 'convert' && (
        <div className="space-y-2">
          <select value={convKey} onChange={function(e) { setConvKey(e.target.value); setInputVal('') }}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
            {Object.keys(CONVERSIONS).map(function(k) { return <option key={k} value={k}>{k}</option> })}
          </select>
          <div className="flex items-center gap-2">
            <input type="number" value={inputVal} onChange={function(e) { setInputVal(e.target.value) }}
              placeholder="Enter value"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            <span className="text-slate-500 text-sm">=</span>
            <div className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-orange-400 text-sm font-mono min-h-[38px]">
              {convertDisplay} {convertDisplay !== '' ? conv.to : ''}
            </div>
          </div>
        </div>
      )}
      {mode === 'dimensions' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <select value={dimUnit} onChange={function(e) { setDimUnit(e.target.value) }}
              className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-orange-500">
              <option value="ft">Feet</option>
              <option value="in">Inches</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <p className="text-slate-600 text-xs mb-1">Length</p>
              <input type="number" value={dimL} onChange={function(e) { setDimL(e.target.value) }}
                placeholder="L"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-orange-500" />
            </div>
            <span className="text-slate-600 text-sm mt-4">×</span>
            <div className="flex-1">
              <p className="text-slate-600 text-xs mb-1">Width</p>
              <input type="number" value={dimW} onChange={function(e) { setDimW(e.target.value) }}
                placeholder="W"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-orange-500" />
            </div>
            <span className="text-slate-600 text-sm mt-4">×</span>
            <div className="flex-1">
              <p className="text-slate-600 text-xs mb-1">Depth</p>
              <input type="number" value={dimD} onChange={function(e) { setDimD(e.target.value) }}
                placeholder="D"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          {(sf || hasDims) && (
            <div className="bg-slate-700 rounded-lg px-3 py-2 space-y-1">
              {sf && <div className="flex justify-between"><span className="text-slate-400 text-xs">Area</span><span className="text-orange-400 text-xs font-mono">{sf} SF</span></div>}
              {hasDims && <div className="flex justify-between"><span className="text-slate-400 text-xs">Volume</span><span className="text-orange-400 text-xs font-mono">{cf} CF</span></div>}
              {hasDims && <div className="flex justify-between"><span className="text-slate-400 text-xs">Volume</span><span className="text-orange-400 text-xs font-mono">{cy} CY</span></div>}
              {hasDims && <div className="flex justify-between"><span className="text-slate-400 text-xs">Weight (est.)</span><span className="text-orange-400 text-xs font-mono">{tons} tons</span></div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
