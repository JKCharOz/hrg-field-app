'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function MaterialsModal(props) {
  var report = props.report
  var onClose = props.onClose
  var onSaved = props.onSaved
  var [presets, setPresets] = useState([])
  var [materialType, setMaterialType] = useState('')
  var [quantity, setQuantity] = useState('')
  var [unit, setUnit] = useState('tons')
  var [saving, setSaving] = useState(false)
  var [editMode, setEditMode] = useState(false)
  var [newLabel, setNewLabel] = useState('')
  var [addingPreset, setAddingPreset] = useState(false)
  var [materials, setMaterials] = useState([])
  var UNITS = ['tons', 'CY', 'LF', 'EA', 'SY', 'LS', 'GAL', 'LB']

  useEffect(function() {
    if (report && report.org_id) { loadPresets() }
    if (report && report.id) { loadMaterials() }
  }, [report && report.id])

  async function loadPresets() {
    var result = await supabase.from('material_presets').select('*').eq('org_id', report.org_id).order('sort_order', { ascending: true })
    if (!result.error && result.data) { setPresets(result.data) }
  }

  async function loadMaterials() {
    var result = await supabase.from('materials').select('*').eq('report_id', report.id).eq('is_delivery', true).order('logged_at', { ascending: true })
    if (!result.error && result.data) { setMaterials(result.data) }
  }

  async function deleteEntry(id) {
    await supabase.from('materials').delete().eq('id', id)
    setMaterials(function(prev) { return prev.filter(function(m) { return m.id !== id }) })
    if (onSaved) { onSaved() }
  }

  async function handleSave() {
    if (!materialType.trim() || saving) return
    setSaving(true)
    await supabase.from('materials').insert({
      report_id: report.id,
      project_id: report.project_id,
      org_id: report.org_id,
      material_type: materialType.trim(),
      quantity: quantity.trim(),
      unit: unit,
      is_delivery: true,
      logged_at: new Date().toISOString(),
    })
    setSaving(false)
    setMaterialType('')
    setQuantity('')
    setUnit('Tons')
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

  if (editMode) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
        <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          <h3 className="text-white font-bold text-lg">Edit Material Presets</h3>
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
          <h3 className="text-white font-bold text-lg">Materials Delivered</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        {presets.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quick Select</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(function(preset) {
                return (
                  <button key={preset.id} onClick={function() { setMaterialType(preset.label) }}
                    className={'px-3 py-1.5 rounded-lg border text-sm transition-colors ' +
                      (materialType === preset.label ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-slate-600 bg-slate-700/40 text-slate-300 active:bg-slate-600')}>
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Material Type</p>
          <input type="text" value={materialType} onChange={function(e) { setMaterialType(e.target.value) }}
            placeholder="e.g. 2A Modified, PVC Pipe, Flowable Fill..."
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
        <button onClick={handleSave} disabled={!materialType.trim() || saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Add Material'}
        </button>
        <button onClick={function() { setEditMode(true) }}
          className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Edit Presets</button>
        {materials.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Added This Report</p>
            <div className="space-y-1.5">
              {materials.map(function(m) {
                return (
                  <div key={m.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                    <span className="text-slate-200 text-sm">{m.material_type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 text-xs font-mono">{m.quantity} {m.unit}</span>
                      <button onClick={function() { deleteEntry(m.id) }} className="text-slate-600 active:text-red-400 text-xs">x</button>
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
