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
  var [uploadFolder, setUploadFolder] = useState('General')
  var [addItemForm, setAddItemForm] = useState({ item_number: '', description: '', unit: '', qty: '', unit_price: '', change_order: '' })
  var [addingItem, setAddingItem] = useState(false)
  var docRef = useRef(null)

  var FOLDERS = ['Plans', 'Specs', 'Submittals', 'Change Orders', 'General']

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

  function guessFolder(fileName) {
    var lower = fileName.toLowerCase()
    if (lower.indexOf('plan') >= 0 || lower.indexOf('drawing') >= 0 || lower.indexOf('dwg') >= 0 || lower.indexOf('sheet') >= 0) return 'Plans'
    if (lower.indexOf('spec') >= 0) return 'Specs'
    if (lower.indexOf('submittal') >= 0) return 'Submittals'
    if (lower.indexOf('change') >= 0 || lower.indexOf('co ') >= 0 || lower.indexOf('co#') >= 0 || lower.indexOf('co-') >= 0) return 'Change Orders'
    return uploadFolder
  }

  async function handleDocUpload(e) {
    var files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (var i = 0; i < files.length; i++) {
      var file = files[i]
      var ext = file.name.split('.').pop()
      var folder = guessFolder(file.name)
      var path = project.id + '/docs/' + Date.now() + '-' + i + '.' + ext
      var upload = await supabase.storage.from('field-photos').upload(path, file, { upsert: false })
      if (!upload.error) {
        var insert = await supabase.from('project_documents').insert({
          project_id: project.id,
          org_id: project.org_id,
          file_name: file.name,
          storage_path: path,
          file_type: ext.toLowerCase(),
          folder: folder,
        }).select().single()
        if (!insert.error && insert.data) {
          setDocs(function(prev) { return [insert.data].concat(prev) })
        }
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  async function moveDocFolder(id, newFolder) {
    var result = await supabase.from('project_documents').update({ folder: newFolder }).eq('id', id).select().single()
    if (!result.error && result.data) {
      setDocs(function(prev) { return prev.map(function(d) { return d.id === id ? result.data : d }) })
    }
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

  async function importDocAsBidItems(doc, changeOrderLabel) {
    setImporting(true)
    try {
      var url = supabase.storage.from('field-photos').getPublicUrl(doc.storage_path).data.publicUrl
      var res = await fetch(url)
      if (!res.ok) { alert('Failed to download file'); setImporting(false); return }
      var buf = await res.arrayBuffer()
      var wb = XLSX.read(buf)

      var sheetNames = wb.SheetNames
      var targetSheet = sheetNames.find(function(s) { return s.toLowerCase().indexOf('unit') >= 0 && s.toLowerCase().indexOf('price') >= 0 })
        || sheetNames.find(function(s) { return s.toLowerCase().indexOf('bid') >= 0 })
        || sheetNames[0]
      var ws = wb.Sheets[targetSheet]
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      function cell(row, idx) { return idx >= 0 && row && idx < row.length ? String(row[idx] == null ? '' : row[idx]).trim() : '' }

      var headerIdx = -1
      var colMap = { item: 0, desc: 1, unit: 2, qty: 3, price: -1 }
      for (var h = 0; h < Math.min(rows.length, 20); h++) {
        var row = (rows[h] || []).map(function(c) { return String(c == null ? '' : c).toLowerCase().trim() })
        var hasItem = row.findIndex(function(c) { return c.length > 0 && (c.indexOf('item') >= 0 || c.indexOf('bid') >= 0 || c.indexOf('#') >= 0 || c.indexOf('no') >= 0) })
        var hasDesc = row.findIndex(function(c) { return c.length > 0 && (c.indexOf('desc') >= 0 || c.indexOf('name') >= 0) })
        if (hasItem >= 0 && hasDesc >= 0) {
          headerIdx = h
          colMap.item = hasItem
          colMap.desc = hasDesc
          for (var ci = 0; ci < row.length; ci++) {
            if (row[ci].indexOf('unit') >= 0 && row[ci].indexOf('price') < 0) colMap.unit = ci
            if (row[ci].indexOf('qty') >= 0 || row[ci].indexOf('quant') >= 0) colMap.qty = ci
            if (row[ci].indexOf('price') >= 0 || row[ci].indexOf('cost') >= 0) colMap.price = ci
          }
          break
        }
      }

      var stopWords = ['total', 'project total', 'original contract', 'change order']
      var startRow = headerIdx >= 0 ? headerIdx + 1 : 0
      while (startRow < rows.length) {
        var sr = (rows[startRow] || []).map(function(c) { return String(c == null ? '' : c).toLowerCase() }).join(' ')
        if (sr.indexOf('from previous') >= 0 || sr.indexOf('sub-header') >= 0) { startRow++; continue }
        break
      }

      var dataRows = []
      for (var di = startRow; di < rows.length; di++) {
        var r = rows[di]
        var itemVal = cell(r, colMap.item)
        var descVal = cell(r, colMap.desc)
        var fullRow = (r || []).map(function(c) { return String(c == null ? '' : c).toLowerCase() }).join(' ')
        var isStop = stopWords.some(function(sw) { return fullRow.indexOf(sw) >= 0 })
        if (isStop) continue
        if (!descVal) continue
        if (!itemVal && !descVal) continue
        dataRows.push(r)
      }

      if (dataRows.length === 0) {
        alert('No items found. Expected columns with Item/No and Description headers.')
        setImporting(false)
        return
      }

      // Auto-detect unit column from data
      var commonUnits = ['ls', 'lf', 'ea', 'cy', 'sy', 'sf', 'ton', 'gal']
      if (dataRows.length > 0) {
        var firstData = dataRows[0]
        for (var uc = 0; uc < (firstData || []).length; uc++) {
          var cv = String(firstData[uc] == null ? '' : firstData[uc]).toLowerCase().trim()
          if (commonUnits.indexOf(cv) >= 0) {
            colMap.unit = uc
            if (uc > 0 && !isNaN(parseFloat(firstData[uc - 1]))) colMap.qty = uc - 1
            break
          }
        }
      }
      if (colMap.price < 0 && colMap.unit >= 0) { colMap.price = colMap.unit + 1 }

      // If importing as CO or replacing bid items
      if (!changeOrderLabel && bidItems.length > 0) {
        if (!window.confirm('Replace ' + bidItems.length + ' existing bid items with ' + dataRows.length + ' from this file?')) {
          setImporting(false)
          return
        }
        await supabase.from('contract_items').delete().eq('project_id', project.id).is('change_order', null)
      }

      var maxSort = bidItems.reduce(function(m, b) { return Math.max(m, b.sort_order || 0) }, 0)
      var inserts = dataRows.map(function(r, i) {
        var obj = {
          project_id: project.id,
          org_id: project.org_id,
          item_number: cell(r, colMap.item),
          description: cell(r, colMap.desc),
          unit: cell(r, colMap.unit),
          contract_quantity: colMap.qty >= 0 ? parseFloat(r[colMap.qty]) || 0 : 0,
          sort_order: changeOrderLabel ? maxSort + 1 + i : i,
          change_order: changeOrderLabel || null,
        }
        if (colMap.price >= 0) {
          var priceVal = parseFloat(String(r[colMap.price]).replace(/[^0-9.\-]/g, ''))
          if (!isNaN(priceVal)) { obj.unit_price = priceVal }
        }
        return obj
      })

      var result = await supabase.from('contract_items').insert(inserts).select()
      if (!result.error && result.data) {
        if (changeOrderLabel) {
          setBidItems(function(prev) { return prev.concat(result.data) })
        } else {
          setBidItems(function(prev) {
            var kept = prev.filter(function(b) { return b.change_order })
            return kept.concat(result.data)
          })
        }
        alert('Imported ' + result.data.length + ' items' + (changeOrderLabel ? ' as ' + changeOrderLabel : ''))
      } else {
        alert('Import failed: ' + (result.error ? result.error.message : 'unknown'))
      }
    } catch (err) {
      alert('Failed to read file: ' + err.message)
    }
    setImporting(false)
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
          <div className="px-4 py-4 space-y-4">
            {docs.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No documents uploaded yet</p>}
            {FOLDERS.map(function(folder) {
              var folderDocs = docs.filter(function(d) { return (d.folder || 'General') === folder })
              if (folderDocs.length === 0) return null
              return <DocFolder key={folder} folder={folder} docs={folderDocs} folders={FOLDERS}
                importing={importing} onDelete={deleteDoc} onMove={moveDocFolder} onImportBid={importDocAsBidItems} />
            })}
            <div className="pt-2">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Upload to folder</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {FOLDERS.map(function(f) {
                  return (
                    <button key={f} onClick={function() { setUploadFolder(f) }}
                      className={'px-3 py-1.5 rounded-lg border text-xs transition-colors ' + (uploadFolder === f ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-slate-700 text-slate-500 active:bg-slate-800')}>
                      {f}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'bid' && (
          <div className="px-4 py-4 space-y-3">
            {bidItems.length === 0 && (
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-1">No bid items yet</p>
                <p className="text-slate-600 text-xs">Upload an Excel file in Documents, then tap "Import as Bid Items"</p>
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
        <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.dwg,.dxf" multiple onChange={handleDocUpload} className="hidden" />
        <button onClick={function() { docRef.current && docRef.current.click() }} disabled={uploading}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>
      </div>
    </div>
  )
}

function DocFolder(props) {
  var [open, setOpen] = useState(true)
  var folder = props.folder
  var folderDocs = props.docs
  var folders = props.folders

  return (
    <div>
      <button onClick={function() { setOpen(function(o) { return !o }) }}
        className="w-full flex items-center justify-between py-1.5 active:opacity-70">
        <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">{folder}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-xs">{folderDocs.length}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-slate-600" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="space-y-2 mt-1">
          {folderDocs.map(function(doc) {
            var url = supabase.storage.from('field-photos').getPublicUrl(doc.storage_path).data.publicUrl
            var ext = (doc.file_type || '').toLowerCase()
            var isExcel = ext === 'xls' || ext === 'xlsx' || ext === 'csv'
            return (
              <div key={doc.id} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <a href={url} target="_blank" rel="noreferrer" className="text-slate-200 text-sm truncate block active:text-orange-400">
                      {doc.file_name}
                    </a>
                    <p className="text-slate-600 text-xs mt-0.5">{doc.file_type ? doc.file_type.toUpperCase() : ''}</p>
                  </div>
                  <select
                    value={doc.folder || 'General'}
                    onChange={function(e) { props.onMove(doc.id, e.target.value) }}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-1.5 py-1 text-slate-400 text-xs focus:outline-none">
                    {folders.map(function(f) { return <option key={f} value={f}>{f}</option> })}
                  </select>
                  <button onClick={function() { props.onDelete(doc.id, doc.storage_path) }}
                    className="text-slate-600 active:text-red-400 text-xs flex-shrink-0">x</button>
                </div>
                {isExcel && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={function() { props.onImportBid(doc, null) }}
                      disabled={props.importing}
                      className="flex-1 text-orange-400 text-xs py-1.5 border border-orange-500/30 rounded-lg active:bg-orange-500/10 disabled:opacity-50">
                      {props.importing ? '...' : 'Import as Bid Items'}
                    </button>
                    <button onClick={function() {
                      var label = window.prompt('Change Order label (e.g. CO #1):')
                      if (label && label.trim()) { props.onImportBid(doc, label.trim()) }
                    }}
                      disabled={props.importing}
                      className="flex-1 text-slate-400 text-xs py-1.5 border border-slate-700 rounded-lg active:bg-slate-700 disabled:opacity-50">
                      {props.importing ? '...' : 'Import as CO'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
