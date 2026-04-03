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
  var [coMode, setCoMode] = useState(false)
  var [coLabel, setCoLabel] = useState('')
  var [coImporting, setCoImporting] = useState(false)
  var [addItemForm, setAddItemForm] = useState({ item_number: '', description: '', unit: '', qty: '', unit_price: '', change_order: '' })
  var [addingItem, setAddingItem] = useState(false)
  var docRef = useRef(null)
  var bidRef = useRef(null)
  var coRef = useRef(null)

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
      // Try multiple sheets — prefer "Unit Price", then first sheet
      var sheetNames = wb.SheetNames
      var targetSheet = sheetNames.find(function(s) { return s.toLowerCase().indexOf('unit') >= 0 && s.toLowerCase().indexOf('price') >= 0 })
        || sheetNames.find(function(s) { return s.toLowerCase().indexOf('bid') >= 0 })
        || sheetNames[0]
      var ws2 = wb.Sheets[targetSheet]
      var rows = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' })

      function cell(row, idx) { return idx >= 0 && row && idx < row.length ? String(row[idx] == null ? '' : row[idx]).trim() : '' }

      // Scan first 20 rows for a header containing "item" and "description"
      var headerIdx = -1
      var colMap = { item: 0, desc: 1, unit: 2, qty: 3, price: -1 }
      for (var h = 0; h < Math.min(rows.length, 20); h++) {
        var row = (rows[h] || []).map(function(c) { return String(c == null ? '' : c).toLowerCase().trim() })
        var hasItem = row.findIndex(function(c) { return c.length > 0 && (c.indexOf('item') >= 0 || c.indexOf('bid') >= 0) })
        var hasDesc = row.findIndex(function(c) { return c.length > 0 && (c.indexOf('desc') >= 0 || c.indexOf('name') >= 0) })
        if (hasItem >= 0 && hasDesc >= 0) {
          headerIdx = h
          colMap.item = hasItem
          colMap.desc = hasDesc
          // Look for unit, quantity, and price columns — scan all columns
          for (var ci = 0; ci < row.length; ci++) {
            if (row[ci].indexOf('unit') >= 0 && row[ci].indexOf('price') < 0) colMap.unit = ci
            if (row[ci].indexOf('qty') >= 0 || row[ci].indexOf('quant') >= 0) colMap.qty = ci
            if (row[ci].indexOf('price') >= 0 || row[ci].indexOf('unit price') >= 0 || row[ci].indexOf('unit cost') >= 0) colMap.price = ci
          }
          break
        }
      }

      // If header found but unit/qty not in header row, check the row below (sub-headers)
      if (headerIdx >= 0 && (colMap.unit === 2 || colMap.qty === 3)) {
        var subRow = (rows[headerIdx + 1] || []).map(function(c) { return String(c == null ? '' : c).toLowerCase().trim() })
        for (var si = 0; si < subRow.length; si++) {
          if (subRow[si].indexOf('unit') >= 0 && subRow[si].indexOf('price') < 0) colMap.unit = si
          if (subRow[si].indexOf('qty') >= 0 || subRow[si].indexOf('quant') >= 0) colMap.qty = si
          if (subRow[si].indexOf('price') >= 0) colMap.price = si
        }
      }

      // Find data rows: must have a non-empty item number in column A that looks like a bid item number
      // Skip section headers like "Original Contract", "Change Orders", totals rows
      var stopWords = ['total', 'change order', 'original contract', 'project total']
      var startRow = headerIdx >= 0 ? headerIdx + 1 : 0
      // Skip sub-header rows
      while (startRow < rows.length && cell(rows[startRow], colMap.desc).toLowerCase().indexOf('from previous') >= 0) { startRow++ }

      var dataRows = []
      for (var di = startRow; di < rows.length; di++) {
        var r = rows[di]
        var itemVal = cell(r, colMap.item)
        var descVal = cell(r, colMap.desc)
        // Stop at totals
        var fullRow = (r || []).map(function(c) { return String(c == null ? '' : c).toLowerCase() }).join(' ')
        var isStop = stopWords.some(function(sw) { return fullRow.indexOf(sw) >= 0 })
        if (isStop) continue
        // Must have an item number (numeric or like "5.1") and a description
        if (!itemVal || !descVal) continue
        if (!/^[\d]/.test(itemVal)) continue
        dataRows.push(r)
      }

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

      // Auto-detect unit column: find a column in data rows containing common units
      if (dataRows.length > 0) {
        var commonUnits = ['ls', 'lf', 'ea', 'cy', 'sy', 'sf', 'ton', 'gal']
        var firstData = dataRows[0]
        for (var uc = 0; uc < (firstData || []).length; uc++) {
          var cv = String(firstData[uc] == null ? '' : firstData[uc]).toLowerCase().trim()
          if (commonUnits.indexOf(cv) >= 0) {
            colMap.unit = uc
            // Quantity is likely the column before unit
            if (uc > 0 && !isNaN(parseFloat(firstData[uc - 1]))) colMap.qty = uc - 1
            break
          }
        }
      }

      // If price column not found in headers, try column after unit
      if (colMap.price < 0 && colMap.unit >= 0) {
        colMap.price = colMap.unit + 1
      }

      var inserts = dataRows.map(function(r, i) {
        var obj = {
          project_id: project.id,
          org_id: project.org_id,
          item_number: cell(r, colMap.item),
          description: cell(r, colMap.desc),
          unit: cell(r, colMap.unit),
          contract_quantity: colMap.qty >= 0 ? parseFloat(r[colMap.qty]) || 0 : 0,
          sort_order: i,
          change_order: null,
        }
        if (colMap.price >= 0) {
          var priceVal = parseFloat(String(r[colMap.price]).replace(/[^0-9.\-]/g, ''))
          if (!isNaN(priceVal)) { obj.unit_price = priceVal }
        }
        return obj
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

  async function handleCoUpload(e) {
    var file = e.target.files && e.target.files[0]
    if (!file || !coLabel.trim()) return
    setCoImporting(true)
    try {
      var data = await file.arrayBuffer()
      var wb = XLSX.read(data)
      var ws = wb.Sheets[wb.SheetNames[0]]
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      function cell(row, idx) { return idx >= 0 && row && idx < row.length ? String(row[idx] == null ? '' : row[idx]).trim() : '' }

      var headerIdx = -1
      var colMap = { item: 0, desc: 1, unit: 2, qty: 3, price: -1 }
      for (var h = 0; h < Math.min(rows.length, 20); h++) {
        var row = (rows[h] || []).map(function(c) { return String(c == null ? '' : c).toLowerCase().trim() })
        var hasItem = row.findIndex(function(c) { return c.length > 0 && (c.indexOf('item') >= 0 || c.indexOf('bid') >= 0) })
        var hasDesc = row.findIndex(function(c) { return c.length > 0 && (c.indexOf('desc') >= 0 || c.indexOf('name') >= 0) })
        if (hasItem >= 0 && hasDesc >= 0) {
          headerIdx = h
          colMap.item = hasItem
          colMap.desc = hasDesc
          for (var ci = 0; ci < row.length; ci++) {
            if (row[ci].indexOf('unit') >= 0 && row[ci].indexOf('price') < 0) colMap.unit = ci
            if (row[ci].indexOf('qty') >= 0 || row[ci].indexOf('quant') >= 0) colMap.qty = ci
            if (row[ci].indexOf('price') >= 0) colMap.price = ci
          }
          break
        }
      }

      var startRow = headerIdx >= 0 ? headerIdx + 1 : 0
      var stopWords = ['total', 'project total']
      var dataRows = []
      for (var di = startRow; di < rows.length; di++) {
        var r = rows[di]
        var itemVal = cell(r, colMap.item)
        var descVal = cell(r, colMap.desc)
        var fullRow = (r || []).map(function(c) { return String(c == null ? '' : c).toLowerCase() }).join(' ')
        var isStop = stopWords.some(function(sw) { return fullRow.indexOf(sw) >= 0 })
        if (isStop) continue
        if (!itemVal || !descVal) continue
        if (!/^[\d]/.test(itemVal)) continue
        dataRows.push(r)
      }

      if (dataRows.length === 0) {
        alert('No items found in change order file.')
        setCoImporting(false)
        e.target.value = ''
        return
      }

      if (colMap.price < 0 && colMap.unit >= 0) { colMap.price = colMap.unit + 1 }

      var maxSort = bidItems.reduce(function(m, b) { return Math.max(m, b.sort_order || 0) }, 0)
      var inserts = dataRows.map(function(r, i) {
        var obj = {
          project_id: project.id,
          org_id: project.org_id,
          item_number: cell(r, colMap.item),
          description: cell(r, colMap.desc),
          unit: cell(r, colMap.unit),
          contract_quantity: colMap.qty >= 0 ? parseFloat(r[colMap.qty]) || 0 : 0,
          sort_order: maxSort + 1 + i,
          change_order: coLabel.trim(),
        }
        if (colMap.price >= 0) {
          var priceVal = parseFloat(String(r[colMap.price]).replace(/[^0-9.\-]/g, ''))
          if (!isNaN(priceVal)) { obj.unit_price = priceVal }
        }
        return obj
      })

      var result = await supabase.from('contract_items').insert(inserts).select()
      if (!result.error && result.data) {
        setBidItems(function(prev) { return prev.concat(result.data) })
      } else {
        alert('Import failed: ' + (result.error ? result.error.message : 'unknown'))
      }
    } catch (err) {
      alert('Failed to read file: ' + err.message)
    }
    setCoImporting(false)
    setCoMode(false)
    setCoLabel('')
    e.target.value = ''
  }

  async function handleAddItem() {
    if (!addItemForm.description.trim() || addingItem) return
    setAddingItem(true)
    var maxSort = bidItems.reduce(function(m, b) { return Math.max(m, b.sort_order || 0) }, 0)
    var obj = {
      project_id: project.id,
      org_id: project.org_id,
      item_number: addItemForm.item_number.trim(),
      description: addItemForm.description.trim(),
      unit: addItemForm.unit.trim(),
      contract_quantity: parseFloat(addItemForm.qty) || 0,
      sort_order: maxSort + 1,
      change_order: addItemForm.change_order.trim() || null,
    }
    if (addItemForm.unit_price.trim()) {
      var pv = parseFloat(addItemForm.unit_price)
      if (!isNaN(pv)) { obj.unit_price = pv }
    }
    var result = await supabase.from('contract_items').insert(obj).select().single()
    if (!result.error && result.data) {
      setBidItems(function(prev) { return prev.concat([result.data]) })
      setAddItemForm({ item_number: '', description: '', unit: '', qty: '', unit_price: '', change_order: '' })
    } else {
      alert('Failed to add item: ' + (result.error ? result.error.message : 'unknown'))
    }
    setAddingItem(false)
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
                        <p className="text-slate-500 text-xs">
                          {b.contract_quantity > 0 ? b.contract_quantity + ' ' : ''}{b.unit}
                          {b.unit_price ? ' @ $' + Number(b.unit_price).toFixed(2) : ''}
                          {b.change_order ? ' — ' + b.change_order : ''}
                        </p>
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
            {bidItems.length > 0 && !coMode && (
              <button onClick={function() { setCoMode(true) }}
                className="w-full border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm active:bg-slate-800 mt-2">Add Change Order</button>
            )}
            {coMode && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3 mt-2">
                <p className="text-white text-sm font-semibold">Import Change Order</p>
                <input type="text" value={coLabel} onChange={function(e) { setCoLabel(e.target.value) }}
                  placeholder='e.g. CO #1'
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
                <input ref={coRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleCoUpload} className="hidden" />
                <div className="flex gap-2">
                  <button onClick={function() { if (coLabel.trim()) { coRef.current && coRef.current.click() } else { alert('Enter a change order label first') } }}
                    disabled={coImporting}
                    className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:bg-orange-600 disabled:opacity-50">
                    {coImporting ? 'Importing...' : 'Upload CO File'}
                  </button>
                  <button onClick={function() { setCoMode(false); setCoLabel('') }}
                    className="px-4 border border-slate-600 text-slate-400 py-3 rounded-xl text-sm active:bg-slate-800">Cancel</button>
                </div>
              </div>
            )}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3 mt-4">
              <p className="text-white text-sm font-semibold">Add Individual Item</p>
              <div className="flex gap-2">
                <input type="text" value={addItemForm.item_number}
                  onChange={function(e) { setAddItemForm(Object.assign({}, addItemForm, { item_number: e.target.value })) }}
                  placeholder="Item No."
                  className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm text-center focus:outline-none focus:border-orange-500" />
                <input type="text" value={addItemForm.description}
                  onChange={function(e) { setAddItemForm(Object.assign({}, addItemForm, { description: e.target.value })) }}
                  placeholder="Description"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div className="flex gap-2">
                <input type="text" value={addItemForm.unit}
                  onChange={function(e) { setAddItemForm(Object.assign({}, addItemForm, { unit: e.target.value })) }}
                  placeholder="Unit"
                  className="w-16 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm text-center focus:outline-none focus:border-orange-500" />
                <input type="text" value={addItemForm.qty}
                  onChange={function(e) { setAddItemForm(Object.assign({}, addItemForm, { qty: e.target.value })) }}
                  placeholder="Qty"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
                <input type="text" value={addItemForm.unit_price}
                  onChange={function(e) { setAddItemForm(Object.assign({}, addItemForm, { unit_price: e.target.value })) }}
                  placeholder="Unit $"
                  className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <input type="text" value={addItemForm.change_order}
                onChange={function(e) { setAddItemForm(Object.assign({}, addItemForm, { change_order: e.target.value })) }}
                placeholder="Change Order (optional, e.g. CO #1)"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
              <button onClick={handleAddItem} disabled={!addItemForm.description.trim() || addingItem}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:bg-orange-600 disabled:opacity-40">
                {addingItem ? 'Adding...' : 'Add Item'}
              </button>
            </div>
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
