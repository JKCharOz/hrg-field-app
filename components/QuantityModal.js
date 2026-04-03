'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function QuantityModal(props) {
  var report = props.report
  var project = props.project
  var onClose = props.onClose
  var onSaved = props.onSaved

  var [presets, setPresets] = useState([])
  var [contractItems, setContractItems] = useState([])
  var [description, setDescription] = useState('')
  var [quantity, setQuantity] = useState('')
  var [unit, setUnit] = useState('LF')
  var [customUnit, setCustomUnit] = useState('')
  var [locationNotes, setLocationNotes] = useState('')
  var [itemNumber, setItemNumber] = useState('')
  var [contractItemId, setContractItemId] = useState(null)
  var [bidSearch, setBidSearch] = useState('')
  var [bidDropdownOpen, setBidDropdownOpen] = useState(false)
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
    if (report && report.project_id) { loadContractItems() }
  }, [report && report.id])

  async function loadPresets() {
    var result = await supabase.from('material_presets').select('*').eq('org_id', report.org_id).order('sort_order', { ascending: true })
    if (!result.error && result.data) { setPresets(result.data) }
  }

  async function loadContractItems() {
    var result = await supabase.from('contract_items').select('*').eq('project_id', report.project_id).order('sort_order', { ascending: true })
    if (!result.error && result.data) { setContractItems(result.data) }
  }

  async function loadInstalled() {
    var result = await supabase.from('materials').select('*').eq('report_id', report.id).eq('is_delivery', false).order('logged_at', { ascending: true })
    if (!result.error && result.data) { setInstalled(result.data) }
  }

  function buildLocationRef(item, qty, notes) {
    var parts = []
    if (item.trim()) parts.push('ITEM:' + item.trim())
    if (isNaN(parseFloat(qty)) && qty.trim()) parts.push('QTYTEXT:' + qty.trim())
    if (notes.trim()) parts.push(notes.trim())
    return parts.length > 0 ? parts.join('|') : null
  }

  function parseLocationRef(ref) {
    if (!ref) return { item: '', qtyText: '', notes: '' }
    var item = '', qtyText = '', notes = []
    ref.split('|').forEach(function(p) {
      if (p.startsWith('ITEM:')) item = p.slice(5)
      else if (p.startsWith('QTYTEXT:')) qtyText = p.slice(8)
      else notes.push(p)
    })
    return { item: item, qtyText: qtyText, notes: notes.join('|') }
  }

  async function handleSave() {
    if (!description.trim() || saving) return
    setSaving(true)
    var finalUnit = unit === 'Other' ? customUnit.trim() : unit
    var insertPayload = {
      report_id: report.id,
      project_id: report.project_id,
      org_id: report.org_id,
      material_type: description.trim(),
      quantity: String(parseFloat(quantity) || 0),
      unit: finalUnit,
      location_ref: buildLocationRef(itemNumber, quantity, locationNotes),
      is_delivery: false,
      logged_at: new Date().toISOString(),
    }
    if (contractItemId) { insertPayload.contract_item_id = contractItemId }
    var insertResult = await supabase.from('materials').insert(insertPayload)
    setSaving(false)
    if (insertResult.error) { alert('Save failed: ' + insertResult.error.message); return }
    setDescription('')
    setQuantity('')
    setUnit('LF')
    setCustomUnit('')
    setLocationNotes('')
    setItemNumber('')
    setContractItemId(null)
    setBidSearch('')
    loadInstalled()
    if (onSaved) { onSaved() }
  }

  async function saveEditInstalled(id, desc, qty, u, loc, ciId) {
    var updatePayload = {
      material_type: desc.trim(),
      quantity: String(parseFloat(qty) || 0),
      unit: u,
      location_ref: loc || null,
    }
    if (ciId) { updatePayload.contract_item_id = ciId }
    var result = await supabase.from('materials').update(updatePayload).eq('id', id).select().single()
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
    var parsed = parseLocationRef(editingEntry.location_ref)
    return (
      <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4">
          <p className="text-white font-bold">Edit Quantity Installed</p>
          <div className="flex gap-3">
            <div className="w-20">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Item No.</p>
              <input type="text" defaultValue={parsed.item} id="edit-qi-item"
                placeholder="—"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm text-center focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Description</p>
              <input type="text" defaultValue={editingEntry.material_type || ''} id="edit-qi-desc"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quantity</p>
              <input type="text" defaultValue={parsed.qtyText || editingEntry.quantity || ''} id="edit-qi-qty"
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
            <input type="text" defaultValue={parsed.notes} id="edit-qi-loc"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <button onClick={function() {
            var eItem = document.getElementById('edit-qi-item').value
            var eQty = document.getElementById('edit-qi-qty').value
            var eLoc = document.getElementById('edit-qi-loc').value
            saveEditInstalled(
              editingEntry.id,
              document.getElementById('edit-qi-desc').value,
              eQty,
              document.getElementById('edit-qi-unit').value,
              buildLocationRef(eItem, eQty, eLoc),
              editingEntry.contract_item_id || null
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
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4 max-h-screen overflow-y-auto" onClick={function(e) { e.stopPropagation(); setBidDropdownOpen(false) }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Quantity Installed</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>
        {contractItems.length > 0 && (
          <div style={{ position: 'relative' }}>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Contract Items</p>
            <input
              type="text"
              value={bidSearch}
              onChange={function(e) { setBidSearch(e.target.value); setBidDropdownOpen(true) }}
              onFocus={function() { setBidDropdownOpen(true) }}
              placeholder="Search bid items..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
            {bidDropdownOpen && (function() {
              var term = bidSearch.toLowerCase().trim()
              var filtered = term ? contractItems.filter(function(ci) {
                return (ci.item_number || '').toLowerCase().indexOf(term) >= 0 || (ci.description || '').toLowerCase().indexOf(term) >= 0
              }) : contractItems
              var display = filtered.slice(0, 50)
              return (
                <div className="absolute left-0 right-0 z-10 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" style={{ maxHeight: '264px', overflowY: 'auto' }}>
                  {display.length === 0 && <p className="text-slate-500 text-sm px-4 py-3">No matching items</p>}
                  {display.map(function(ci) {
                    return (
                      <button key={ci.id} type="button" onClick={function() {
                        setItemNumber(ci.item_number || '')
                        setDescription(ci.description || '')
                        setContractItemId(ci.id)
                        setBidSearch((ci.item_number ? ci.item_number + ' — ' : '') + (ci.description || ''))
                        setBidDropdownOpen(false)
                        if (ci.unit) {
                          var matched = UNITS.find(function(u) { return u.toLowerCase() === ci.unit.toLowerCase() })
                          if (matched) { setUnit(matched) } else { setUnit('Other'); setCustomUnit(ci.unit) }
                        }
                      }}
                        className="w-full text-left px-4 py-3 text-sm active:bg-slate-700 hover:bg-slate-700/50 border-b border-slate-700/50 last:border-b-0"
                        style={{ minHeight: '44px' }}>
                        <span className="text-orange-400 font-mono text-xs mr-2">{ci.item_number}</span>
                        <span className="text-slate-200">{ci.description}</span>
                        {ci.unit ? <span className="text-slate-500 text-xs ml-1">({ci.unit})</span> : null}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
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
        <div className="flex gap-3">
          <div className="w-20">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Item No.</p>
            <input type="text" value={itemNumber} onChange={function(e) { setItemNumber(e.target.value) }}
              placeholder="—"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm text-center focus:outline-none focus:border-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Description</p>
            <input type="text" value={description} onChange={function(e) { setDescription(e.target.value) }}
              placeholder="e.g. 8 inch PVC pipe, DIP, RCP..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quantity</p>
            <input type="text" value={quantity} onChange={function(e) { setQuantity(e.target.value) }}
              placeholder="e.g. 20, In Progress..."
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
        <button onClick={handleSave} disabled={!description.trim() || saving}
          className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : 'Add Quantity'}
        </button>
        <button onClick={function() { setEditMode(true) }}
          className="w-full border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Edit Presets</button>
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

