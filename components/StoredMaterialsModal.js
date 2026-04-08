'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function StoredMaterialsModal(props) {
  var report = props.report
  var onClose = props.onClose
  var onSaved = props.onSaved

  var [contractItems, setContractItems] = useState([])
  var [entries, setEntries] = useState([])
  var [selectedItem, setSelectedItem] = useState(null)
  var [quantity, setQuantity] = useState('')
  var [notes, setNotes] = useState('')
  var [search, setSearch] = useState('')
  var [dropdownOpen, setDropdownOpen] = useState(false)
  var [saving, setSaving] = useState(false)

  useEffect(function() {
    if (report && report.project_id) { loadContractItems() }
    if (report && report.id) { loadEntries() }
  }, [report && report.id])

  async function loadContractItems() {
    var result = await supabase.from('contract_items').select('*').eq('project_id', report.project_id).order('sort_order', { ascending: true })
    if (!result.error && result.data) { setContractItems(result.data) }
  }

  async function loadEntries() {
    var result = await supabase.from('stored_materials').select('*, contract_items(item_number, description, unit)').eq('report_id', report.id)
    if (!result.error && result.data) { setEntries(result.data) }
  }

  async function handleSave() {
    if (!selectedItem || saving) return
    setSaving(true)
    var result = await supabase.from('stored_materials').insert({
      project_id: report.project_id,
      contract_item_id: selectedItem.id,
      org_id: report.org_id,
      report_id: report.id,
      quantity: parseFloat(quantity) || 0,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (result.error) { alert('Save failed: ' + result.error.message); return }
    setSelectedItem(null)
    setQuantity('')
    setNotes('')
    setSearch('')
    loadEntries()
    if (onSaved) { onSaved() }
  }

  async function deleteEntry(id) {
    await supabase.from('stored_materials').delete().eq('id', id)
    setEntries(function(prev) { return prev.filter(function(e) { return e.id !== id }) })
    if (onSaved) { onSaved() }
  }

  var term = search.toLowerCase().trim()
  var filtered = term ? contractItems.filter(function(ci) {
    return (ci.item_number || '').toLowerCase().indexOf(term) >= 0 || (ci.description || '').toLowerCase().indexOf(term) >= 0
  }) : contractItems
  var display = filtered.slice(0, 50)

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-6 space-y-4 max-h-screen overflow-y-auto" onClick={function(e) { e.stopPropagation(); setDropdownOpen(false) }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Stored Materials</h3>
          <button onClick={onClose} className="text-slate-500 text-2xl leading-none active:text-slate-300">x</button>
        </div>

        {contractItems.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">Upload a bid schedule first to track stored materials</p>
        )}

        {contractItems.length > 0 && (
          <div>
            <div style={{ position: 'relative' }}>
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Contract Item</p>
              <input type="text" value={search}
                onChange={function(e) { setSearch(e.target.value); setDropdownOpen(true) }}
                onFocus={function() { setDropdownOpen(true) }}
                placeholder={selectedItem ? selectedItem.item_number + ' — ' + selectedItem.description : 'Search contract items...'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              {dropdownOpen && (
                <div className="absolute left-0 right-0 z-10 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {display.length === 0 && <p className="text-slate-500 text-sm px-4 py-3">No matching items</p>}
                  {display.map(function(ci) {
                    return (
                      <button key={ci.id} type="button" onClick={function() {
                        setSelectedItem(ci)
                        setSearch(ci.item_number + ' — ' + ci.description)
                        setDropdownOpen(false)
                      }}
                        className="w-full text-left px-4 py-3 text-sm active:bg-slate-700 border-b border-slate-700/50 last:border-b-0"
                        style={{ minHeight: '44px' }}>
                        <span className="text-orange-400 font-mono text-xs mr-2">{ci.item_number}</span>
                        <span className="text-slate-200">{ci.description}</span>
                        {ci.unit ? <span className="text-slate-500 text-xs ml-1">({ci.unit})</span> : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-3">
              <div className="flex-1">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Quantity</p>
                <input type="number" value={quantity} onChange={function(e) { setQuantity(e.target.value) }}
                  placeholder="0"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
              </div>
              <div className="flex-1">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Unit</p>
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm">
                  {selectedItem ? selectedItem.unit || '—' : '—'}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Notes (optional)</p>
              <input type="text" value={notes} onChange={function(e) { setNotes(e.target.value) }}
                placeholder="e.g. stored at contractor yard"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" />
            </div>

            <button onClick={handleSave} disabled={!selectedItem || saving}
              className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40 transition-colors mt-3">
              {saving ? 'Saving...' : 'Add Stored Material'}
            </button>
          </div>
        )}

        {entries.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Logged This Report</p>
            <div className="space-y-1.5">
              {entries.map(function(e) {
                var ci = e.contract_items || {}
                return (
                  <div key={e.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-orange-400 text-xs font-mono mr-1">{ci.item_number}</span>
                      <span className="text-slate-200 text-sm">{ci.description}</span>
                      <span className="text-orange-400 text-xs font-mono ml-2">{e.quantity} {ci.unit}</span>
                    </div>
                    <button onClick={function() { deleteEntry(e.id) }}
                      className="text-slate-600 active:text-red-400 text-xs ml-2 flex-shrink-0">x</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full border border-slate-700 text-slate-600 py-2.5 rounded-xl text-sm active:bg-slate-800">Close</button>
      </div>
    </div>
  )
}
