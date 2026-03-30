'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export function ProjectDocsModal(props) {
  var project = props.project
  var onClose = props.onClose

  var [tab, setTab] = useState('docs')
  var [docs, setDocs] = useState([])
  var [bidItems, setBidItems] = useState([])
  var [loading, setLoading] = useState(true)
  var [uploading, setUploading] = useState(false)
  var [importing, setImporting] = useState(false)
  var docRef = useRef(null)
  var bidRef = useRef(null)

  useEffect(function() {
    if (project && project.id) { loadAll() }
  }, [project && project.id])

  async function loadAll() {
    setLoading(true)
    var all = await Promise.all([
      supabase.from('project_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('contract_items').select('*').eq('project_id', project.id).order('sort_order', { ascending: true }),
    ])
    setDocs(all[0].data || [])
    setBidItems(all[1].data || [])
    setLoading(false)
  }

  async function handleDocUpload(e) {
    var files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (var i = 0; i < files.length; i++) {
      var file = files[i]
      var ext = file.name.split('.').pop()
      var path = project.id + '/docs/' + Date.now() + '-' + i + '.' + ext
      var upload = await supabase.storage.from('field-photos').upload(path, file, { upsert: false })
      if (!upload.error) {
        var insert = await supabase.from('project_documents').insert({
          project_id: project.id,
          org_id: project.org_id,
          file_name: file.name,
          storage_path: path,
          file_type: ext.toLowerCase(),
        }).select().single()
        if (!insert.error && insert.data) {
          setDocs(function(prev) { return [insert.data].concat(prev) })
        }
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deleteDoc(id, path) {
    await supabase.storage.from('field-photos').remove([path])
    await supabase.from('project_documents').delete().eq('id', id)
    setDocs(function(prev) { return prev.filter(function(d) { return d.id !== id }) })
  }

  async function handleBidUpload(e) {
    var file = e.target.files && e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      var data = await file.arrayBuffer()
      var wb = XLSX.read(data)
      var ws = wb.Sheets[wb.SheetNames[0]]
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      // Find header row — look for a row containing "item" and "description" (case insensitive)
      var headerIdx = -1
      var colMap = { item: -1, desc: -1, unit: -1, qty: -1 }
      for (var h = 0; h < Math.min(rows.length, 10); h++) {
        var row = (rows[h] || []).map(function(c) { return String(c || '').toLowerCase().trim() })
        var hasItem = row.findIndex(function(c) { return c.indexOf('item') >= 0 })
        var hasDesc = row.findIndex(function(c) { return c.indexOf('desc') >= 0 })
        if (hasItem >= 0 && hasDesc >= 0) {
          headerIdx = h
          colMap.item = hasItem
          colMap.desc = hasDesc
          colMap.unit = row.findIndex(function(c) { return c.indexOf('unit') >= 0 })
          colMap.qty = row.findIndex(function(c) { return c.indexOf('qty') >= 0 || c.indexOf('quant') >= 0 })
          break
        }
      }

      // Fallback: assume columns A=item, B=desc, C=unit, D=qty
      if (headerIdx === -1) {
        headerIdx = 0
        colMap = { item: 0, desc: 1, unit: 2, qty: 3 }
        // Check if first row looks like headers
        var first = rows[0] || []
        if (first.length > 0 && isNaN(parseFloat(first[0]))) {
          headerIdx = 0 // skip header row
        } else {
          headerIdx = -1 // no header, start from row 0
        }
      }

      var dataRows = rows.slice(headerIdx + 1).filter(function(r) {
        return r && r.length > 1 && String(r[colMap.desc] || '').trim()
      })

      if (dataRows.length === 0) {
        alert('No bid items found in file. Expected columns: Item, Description, Unit, Quantity')
        setImporting(false)
        e.target.value = ''
        return
      }

      // Ask before replacing existing items
      if (bidItems.length > 0) {
        if (!window.confirm('Replace ' + bidItems.length + ' existing bid items with ' + dataRows.length + ' from file?')) {
          setImporting(false)
          e.target.value = ''
          return
        }
        await supabase.from('contract_items').delete().eq('project_id', project.id)
      }

      var inserts = dataRows.map(function(r, i) {
        return {
          project_id: project.id,
          org_id: project.org_id,
          item_number: String(r[colMap.item] || '').trim(),
          description: String(r[colMap.desc] || '').trim(),
          unit: colMap.unit >= 0 ? String(r[colMap.unit] || '').trim() : '',
          contract_quantity: colMap.qty >= 0 ? parseFloat(r[colMap.qty]) || 0 : 0,
          sort_order: i,
        }
      })

      var result = await supabase.from('contract_items').insert(inserts).select()
      if (!result.error && result.data) {
        setBidItems(result.data)
      } else {
        alert('Import failed: ' + (result.error ? result.error.message : 'unknown'))
      }
    } catch (err) {
      alert('Failed to read file: ' + err.message)
    }
    setImporting(false)
    e.target.value = ''
  }

  async function deleteBidItem(id) {
    await supabase.from('contract_items').delete().eq('id', id)
    setBidItems(function(prev) { return prev.filter(function(b) { return b.id !== id }) })
  }

  async function clearAllBidItems() {
    if (!window.confirm('Delete all ' + bidItems.length + ' bid items?')) return
    await supabase.from('contract_items').delete().eq('project_id', project.id)
    setBidItems([])
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <h3 className="text-white font-bold text-lg">Project Files</h3>
        <button onClick={onClose} className="text-orange-400 text-sm active:text-orange-300">Done</button>
      </div>

      <div className="flex border-b border-slate-700">
        <button onClick={function() { setTab('docs') }}
          className={'flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center ' + (tab === 'docs' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-500')}>
          Documents
        </button>
        <button onClick={function() { setTab('bid') }}
          className={'flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center ' + (tab === 'bid' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-500')}>
          Bid Items ({bidItems.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading && <p className="text-slate-600 text-sm text-center py-8">Loading...</p>}

        {!loading && tab === 'docs' && (
          <div className="px-4 py-4 space-y-3">
            {docs.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No documents uploaded yet</p>}
            {docs.map(function(doc) {
              var url = supabase.storage.from('field-photos').getPublicUrl(doc.storage_path).data.publicUrl
              return (
                <div key={doc.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <a href={url} target="_blank" rel="noreferrer" className="text-slate-200 text-sm truncate block active:text-orange-400">
                      {doc.file_name}
                    </a>
                    <p className="text-slate-600 text-xs mt-0.5">{doc.file_type ? doc.file_type.toUpperCase() : ''}</p>
                  </div>
                  <button onClick={function() { deleteDoc(doc.id, doc.storage_path) }}
                    className="text-slate-600 active:text-red-400 text-xs flex-shrink-0">x</button>
                </div>
              )
            })}
          </div>
        )}

        {!loading && tab === 'bid' && (
          <div className="px-4 py-4 space-y-3">
            {bidItems.length === 0 && (
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-1">No bid items yet</p>
                <p className="text-slate-600 text-xs">Upload an Excel file with your bid schedule</p>
              </div>
            )}
            {bidItems.length > 0 && (
              <div className="space-y-1.5">
                {bidItems.map(function(b) {
                  return (
                    <div key={b.id} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                      <span className="text-orange-400 text-xs font-mono w-10 flex-shrink-0">{b.item_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm truncate">{b.description}</p>
                        {(b.unit || b.contract_quantity > 0) && (
                          <p className="text-slate-500 text-xs">{b.contract_quantity > 0 ? b.contract_quantity + ' ' : ''}{b.unit}</p>
                        )}
                      </div>
                      <button onClick={function() { deleteBidItem(b.id) }}
                        className="text-slate-600 active:text-red-400 text-xs flex-shrink-0">x</button>
                    </div>
                  )
                })}
              </div>
            )}
            {bidItems.length > 0 && (
              <button onClick={clearAllBidItems}
                className="w-full border border-red-800 text-red-400 py-2.5 rounded-xl text-sm active:bg-red-900/20 mt-2">Clear All Bid Items</button>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-slate-950/95 border-t border-slate-800 p-4">
        {tab === 'docs' && (
          <div>
            <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf" multiple onChange={handleDocUpload} className="hidden" />
            <button onClick={function() { docRef.current && docRef.current.click() }} disabled={uploading}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-50 transition-colors">
              {uploading ? 'Uploading...' : 'Upload Documents'}
            </button>
          </div>
        )}
        {tab === 'bid' && (
          <div>
            <input ref={bidRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleBidUpload} className="hidden" />
            <button onClick={function() { bidRef.current && bidRef.current.click() }} disabled={importing}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-50 transition-colors">
              {importing ? 'Importing...' : 'Upload Bid Schedule (Excel)'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
