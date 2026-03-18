'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function EquipmentModal(props) {
  var report = props.report
  var project = props.project
  var onClose = props.onClose
  var onSaved = props.onSaved

  var [categories, setCategories] = useState([])
  var [equipType, setEquipType] = useState('')
  var [identifier, setIdentifier] = useState('')
  var [hours, setHours] = useState('')
  var [quantity, setQuantity] = useState('1')
  var [contractor, setContractor] = useState((project && project.contractor) || '')
  var [saving, setSaving] = useState(false)
  var [editMode, setEditMode] = useState(false)
  var [newLabel, setNewLabel] = useState('')
  var [addingCat, setAddingCat] = useState(false)
  var [entries, setEntries] = useState([])
  var [carriedOver, setCarriedOver] = useState(false)

  useEffect(function() {
    if (report && report.org_id) { loadCategories() }
    if (report && report.id) { loadEntries() }
  }, [report && report.id])

  async function loadCategories() {
    var result = await supabase.from('equipment_categories').select('*').eq('org_id', report.org_id).order('sort_order', { ascending: true })
    if (!result.error && result.data) {
      setCategories(result.data)
      if (result.data.length > 0 && !equipType) { setEquipType(result.data[0].label) }
    }
  }

  async function loadEntries() {
    var result = await supabase.from('equipment_logs').select('*').eq('report_id', report.id).order('logged_at', { ascending: true })
    if (!result.error && result.data) {
      setEntries(result.data)
      if (result.data.length > 0) { setCarriedOver(true) }
    }
  }

  async function handleClearAll() {
    if (!window.confirm('Clear all equipment entries?')) return
    await supabase.from('equipment_logs').delete().eq('report_id', report.id)
    setEntries([])
    setCarriedOver(false)
    if (onSaved) { onSaved() }
  }

  async function handleSave() {
    if (!equipType.trim() || saving) return
    setSaving(true)
    var descValue = identifier.trim() ? equipType.trim() + ' - ' + identifier.trim() : equipType.trim()
    await supabase.from('equipment_logs').insert({
      report_id: report.id,
      project_id: report.project_id,
      org_id: report.org_id,
      equip_type: equipType.trim(),
      description: descValue,
      quantity: quantity.trim() || '1',
      hours: hours.trim() || null,
      contractor: contractor.trim() || null,
      entry_type: 'equipment',
      logged_at: new Date().toISOString(),
    })
    setSaving(false)
    setIdentifier('')
    setHours('')
    setQuantity('1')
    setCarriedOver(false)
    loadEntries()
    if (onSaved) { onSaved() }
  }

  async function deleteEntry(id) {
    await supabase.from('equipment_logs').delete().eq('id', id)
    setEntries(function(prev) { return prev.filter(function(e) { return e.id !== id }) })
    if (onSaved) { onSaved() }
  }

  async function addCategory() {
    if (!newLabel.trim() || addingCat) return
    setAddingCat(true)
    var maxOrder = categories.reduce(function(m, c) { return Math.max(m, c.sort_order || 0) }, 0)
    var result = await supabase.from('equipment_categories').insert({
      org_id: report.org_id,
      label: newLabel.trim(),
      sort_order: maxOrder + 1,
      created_at: new Date().toISOString(),
    }).select().single()
    setAddingCat(false)
    if (!result.error && result.data) { setCategories(function(prev) { return prev.concat([result.data]) }); setNewLabel('') }
  }

  async function deleteCategory(id) {
    await supabase.from('equipment_categories').delete().eq('id', id)
    setCategories(function(prev) { return prev.filter(function(c) { return c.id !== id }) })
  }

  async function moveCategory(cat, direction) {
    var current = cat.sort_order || 0
    var swap = categories.find(function(c) { return c.sort_order === current + direction })
    if (!swap) return
    await supabase.from('equipment_categories').update({ sort_order: current + direction }).eq('id', cat.id)
    await supabase.from('equipment_categories').update({ sort_order: current }).eq('id', swap.id)
    setCategories(function(prev) {
      return prev.map(function(c) {
        if (c.id === cat.id) return Object.assign({}, c, { sort_order: current + direction })
        if (c.id === swap.id) return Object.assign({}, c, { sort_order: current })
        return c
      }).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0) })
    })
  }

  var grouped = entries.reduce(function(acc, e) {
    var key = e.contractor || 'No Contractor'
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  if (editMode) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
        <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          <h3 className="text-white font-bold text-lg">Edit Equipment Categories</h3>
          <button onClick={function() { setEditMode(false) }} className="text-orange-400 text-sm active:text-orange-300">Done</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {categories.map(function(cat) {
            return (
              <div key={cat.id} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                <span className="flex-1 text-slate-200 text-sm">{cat.label}</span>
                <button onClick={function() { moveCategory(cat, -1) }} disabled={cat.sort_order === categories[0].sort_order}
                  className="text-slate-500 text-xs px-2 py-1 bg-slate-700 rounded disabled:opacity-20 active:text-slate-200">Up</button>
                <button onClick={function() { moveCategory(cat, 1) }} disabled={cat.sort_order === categories[categories.length - 1].sort_order}
                  className="text-slate-500 text-xs px-2 py-1 bg-slate-700 rounded disabled:opacity-20 active:text-slate-200">Dn</button>
                <button onClick={function() { deleteCategory(cat.id) }}
                  className="text-red-400 text-xs px-2 py-1 border border-red-800 rounded-lg active:bg-red-900">Delete</button>
              </div>
            )
          })}
          {categories.length === 0 && <p className="text-slate-600 text-sm">No categories yet. Add one below.</p>}
          <div className="flex gap-2 pt-2">
            <input type="text" value={newLabel} onChange={function(e) { setNewLabel(e.target.value) }}
              placeholder="New category label..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
            <button onClick={addCategory} disabled={!newLabel.trim() || addingCat}
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
          <h3 className="text-white font-bold text-lg">Equipment</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        {carriedOver && (
          <p className="text-slate-500 text-xs text-center py-1 bg-slate-800 rounded-lg">Carried from previous report</p>
        )}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Equipment Type</p>
          <select value={equipType} onChange={function(e) { setEquipType(e.target.value) }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
            {categories.map(function(cat) { return <option key={cat.id} value={cat.label}>{cat.label}</option> })}
          </select>
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Identifier / Description</p>
          <input type="text" value={identifier} onChange={function(e) { setIdentifier(e.target.value) }}
            placeholder="e.g. CAT 320 (Rogele #12)..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Contractor</p>
          <input type="text" value={contractor} onChange={function(e) { setContractor(e.target.value) }}
            placeholder="Contractor name..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Qty</p>
            <input type="text" value={quantity} onChange={function(e) { setQuantity(e.target.value) }}
              placeholder="1"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Hours</p>
            <input type="text" value={hours} onChange={function(e) { setHours(e.target.value) }}
              placeholder="e.g. 8"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
        </div>
        <button onClick={handleSave} disabled={!equipType.trim() || saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Add Equipment'}
        </button>
        <button onClick={function() { setEditMode(true) }}
          className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Edit Categories</button>
        {Object.keys(grouped).length > 0 && (
          <div className="space-y-3">
            <p className="text-slate-500 text-xs uppercase tracking-wider">On This Report</p>
            {Object.keys(grouped).map(function(contractorName) {
              return (
                <div key={contractorName}>
                  <p className="text-slate-400 text-xs font-semibold mb-1.5">{contractorName}</p>
                  <div className="space-y-1.5">
                    {grouped[contractorName].map(function(e) {
                      return (
                        <div key={e.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-slate-200 text-sm">{e.description || e.equip_type}</span>
                            {e.hours && <span className="text-slate-500 text-xs ml-2">{e.hours} hrs</span>}
                          </div>
                          <button onClick={function() { deleteEntry(e.id) }}
                            className="text-slate-600 active:text-red-400 text-xs ml-3 flex-shrink-0">x</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <button onClick={handleClearAll}
          className="w-full border border-red-800 text-red-400 py-2.5 rounded-xl text-sm active:bg-red-900/20">Clear All Equipment</button>
        <button onClick={onClose} className="w-full border border-slate-700 text-slate-600 py-2.5 rounded-xl text-sm active:bg-slate-800">Cancel</button>
      </div>
    </div>
  )
}
