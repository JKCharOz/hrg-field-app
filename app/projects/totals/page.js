'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

export default function TotalsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>}>
      <TotalsPage />
    </Suspense>
  )
}

function TotalsPage() {
  var params = useSearchParams()
  var router = useRouter()
  var [project, setProject] = useState(null)
  var [loading, setLoading] = useState(true)
  var [contractItems, setContractItems] = useState([])
  var [installedByItem, setInstalledByItem] = useState({})
  var [quantities, setQuantities] = useState([])
  var [materials, setMaterials] = useState([])
  var [equipment, setEquipment] = useState([])
  var [crew, setCrew] = useState([])
  var [photos, setPhotos] = useState([])
  var [storedByItem, setStoredByItem] = useState({})
  var [fullPhoto, setFullPhoto] = useState(null)
  var [activeTab, setActiveTab] = useState('contract')

  var projectId = params.get('id')

  useEffect(function() {
    if (projectId) loadAll()
  }, [projectId])

  async function loadAll() {
    setLoading(true)
    var projResult = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (projResult.data) setProject(projResult.data)

    var all = await Promise.all([
      supabase.from('daily_reports').select('id').eq('project_id', projectId),
      supabase.from('contract_items').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('materials').select('*').eq('project_id', projectId).eq('is_delivery', false),
      supabase.from('materials').select('*').eq('project_id', projectId).eq('is_delivery', true),
      supabase.from('field_photos').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('stored_materials').select('*').eq('project_id', projectId),
    ])

    var reportIds = (all[0].data || []).map(function(r) { return r.id })
    var ciData = all[1].data || []
    var installedData = all[2].data || []
    var deliveredData = all[3].data || []

    setContractItems(ciData)

    // Build installed-to-date map by contract_item_id
    var byItem = {}
    installedData.forEach(function(m) {
      if (m.contract_item_id) {
        if (!byItem[m.contract_item_id]) byItem[m.contract_item_id] = 0
        byItem[m.contract_item_id] += parseFloat(m.quantity) || 0
      }
    })
    setInstalledByItem(byItem)

    // Build stored materials map by contract_item_id
    var storedData = all[5].data || []
    var storedMap = {}
    storedData.forEach(function(s) {
      if (s.contract_item_id) {
        if (!storedMap[s.contract_item_id]) storedMap[s.contract_item_id] = 0
        storedMap[s.contract_item_id] += parseFloat(s.quantity) || 0
      }
    })
    setStoredByItem(storedMap)

    setQuantities(aggregateByDescUnit(installedData))
    setMaterials(aggregateByDescUnit(deliveredData))

    if (reportIds.length > 0) {
      var more = await Promise.all([
        supabase.from('equipment_logs').select('*').in('report_id', reportIds),
        supabase.from('crew_logs').select('*').in('report_id', reportIds),
      ])
      setEquipment(aggregateEquipment(more[0].data || []))
      setCrew(aggregateCrew(more[1].data || []))
    }

    setPhotos(all[4].data || [])
    setLoading(false)
  }

  function aggregateByDescUnit(items) {
    var map = {}
    items.forEach(function(m) {
      var key = (m.material_type || '') + '|' + (m.unit || '')
      if (!map[key]) map[key] = { description: m.material_type, unit: m.unit, total: 0 }
      map[key].total += parseFloat(m.quantity) || 0
    })
    return Object.values(map).sort(function(a, b) { return a.description.localeCompare(b.description) })
  }

  function aggregateEquipment(items) {
    var map = {}
    items.forEach(function(e) {
      var desc = e.description || e.equip_type || ''
      if (desc.indexOf(' - ') > 0) desc = desc.split(' - ').slice(1).join(' - ')
      var key = (e.equip_type || '') + '|' + desc
      if (!map[key]) map[key] = { type: e.equip_type, description: desc, count: 0, totalHours: 0 }
      map[key].count += parseInt(e.quantity) || 1
      map[key].totalHours += parseFloat(e.hours) || 0
    })
    return Object.values(map).sort(function(a, b) { return b.count - a.count })
  }

  function aggregateCrew(items) {
    var map = {}
    items.forEach(function(c) {
      var role = c.role || 'Other'
      if (!map[role]) map[role] = 0
      map[role] += parseInt(c.quantity) || 0
    })
    return Object.keys(map).map(function(role) { return { role: role, total: map[role] } }).sort(function(a, b) { return b.total - a.total })
  }

  function groupPhotosByMonth(photos) {
    var groups = {}
    photos.forEach(function(p) {
      var d = new Date(p.created_at)
      var monthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      var dateKey = d.toISOString().split('T')[0]
      if (!groups[monthKey]) groups[monthKey] = {}
      if (!groups[monthKey][dateKey]) groups[monthKey][dateKey] = []
      groups[monthKey][dateKey].push(p)
    })
    return groups
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 text-sm">Loading totals...</p>
      </div>
    )
  }

  var photoGroups = groupPhotosByMonth(photos)
  var months = Object.keys(photoGroups).sort().reverse()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="bg-slate-900 border-b border-slate-700 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={function() { router.back() }}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700 flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest leading-none mb-0.5">Project Totals</p>
            <h1 className="text-white font-bold text-base leading-tight truncate">{project ? project.project_name : ''}</h1>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-700 px-4 pt-2">
        {['contract', 'totals', 'photos'].map(function(t) {
          var labels = { contract: 'Contract', totals: 'Totals', photos: 'Photos' }
          return (
            <button key={t} onClick={function() { setActiveTab(t) }}
              className={'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-center ' + (activeTab === t ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-500')}>
              {labels[t]}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-4 space-y-6">

        {activeTab === 'contract' && (
          <ContractProgress contractItems={contractItems} installedByItem={installedByItem} storedByItem={storedByItem} projectName={project ? project.project_name : 'Project'} />
        )}

        {activeTab === 'totals' && (
          <div className="space-y-6">
            <Section title="Quantity Installed">
              {quantities.length === 0 && <Empty />}
              {quantities.map(function(q, i) {
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-200 text-sm">{q.description}</span>
                    <span className="text-orange-400 text-sm font-mono">{formatNum(q.total)} {q.unit}</span>
                  </div>
                )
              })}
            </Section>

            <Section title="Materials Delivered">
              {materials.length === 0 && <Empty />}
              {materials.map(function(m, i) {
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-200 text-sm">{m.description}</span>
                    <span className="text-orange-400 text-sm font-mono">{formatNum(m.total)} {m.unit}</span>
                  </div>
                )
              })}
            </Section>

            <Section title="Equipment">
              {equipment.length === 0 && <Empty />}
              {equipment.map(function(e, i) {
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800">
                    <div className="min-w-0">
                      <span className="text-slate-200 text-sm">{e.type}{e.description && e.description !== e.type ? ' - ' + e.description : ''}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-slate-400 text-xs">{e.count}x</span>
                      {e.totalHours > 0 && <span className="text-orange-400 text-xs font-mono">{formatNum(e.totalHours)} hrs</span>}
                    </div>
                  </div>
                )
              })}
            </Section>

            <Section title="Crew">
              {crew.length === 0 && <Empty />}
              {crew.map(function(c, i) {
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-200 text-sm">{c.role}</span>
                    <span className="text-orange-400 text-sm font-mono">{c.total}</span>
                  </div>
                )
              })}
            </Section>
          </div>
        )}

        {activeTab === 'photos' && (
          <div>
            {photos.length === 0 && <Empty />}
            {months.map(function(monthKey) {
              var monthLabel = new Date(monthKey + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              var dates = Object.keys(photoGroups[monthKey]).sort().reverse()
              return (
                <div key={monthKey} className="mb-4">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{monthLabel}</p>
                  {dates.map(function(dateKey) {
                    var dateLabel = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    var dayPhotos = photoGroups[monthKey][dateKey]
                    return <DatePhotoGroup key={dateKey} label={dateLabel} photos={dayPhotos} onTap={setFullPhoto} />
                  })}
                </div>
              )
            })}
          </div>
        )}

      </div>

      {fullPhoto && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={function() { setFullPhoto(null) }}>
          <button onClick={function() { setFullPhoto(null) }}
            className="absolute top-12 right-4 text-white text-2xl z-10 bg-black/50 w-10 h-10 rounded-full flex items-center justify-center">×</button>
          <img src={fullPhoto} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  )
}

function ContractProgress(props) {
  var items = props.contractItems || []
  var installed = props.installedByItem || {}
  var stored = props.storedByItem || {}
  var projectName = props.projectName || 'Project'

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 text-sm">No contract items uploaded</p>
        <p className="text-slate-600 text-xs mt-1">Upload a bid schedule in Project Files</p>
      </div>
    )
  }

  // Group by change_order
  var groups = {}
  var groupOrder = []
  items.forEach(function(ci) {
    var key = ci.change_order || '__original__'
    if (!groups[key]) { groups[key] = []; groupOrder.push(key) }
    groups[key].push(ci)
  })

  // Calculate totals
  var originalValue = 0, originalEarned = 0, revisedValue = 0, revisedEarned = 0, totalStored = 0

  items.forEach(function(ci) {
    var contractValue = (parseFloat(ci.contract_quantity) || 0) * (parseFloat(ci.unit_price) || 0)
    var installedQty = installed[ci.id] || 0
    var earnedValue = installedQty * (parseFloat(ci.unit_price) || 0)
    var storedValue = (stored[ci.id] || 0) * (parseFloat(ci.unit_price) || 0)
    revisedValue += contractValue
    revisedEarned += earnedValue
    totalStored += storedValue
    if (!ci.change_order) {
      originalValue += contractValue
      originalEarned += earnedValue
    }
  })

  var coValue = revisedValue - originalValue
  var overallPct = revisedValue > 0 ? Math.round(revisedEarned / revisedValue * 1000) / 10 : 0

  function handleExport() {
    var rows = [['Item No.', 'Description', 'Unit', 'Unit Price', 'Contract Qty', 'Contract Value', 'Installed To Date', 'Earned To Date', 'Stored Materials', '% Complete', 'Change Order']]
    items.forEach(function(ci) {
      var contractQty = parseFloat(ci.contract_quantity) || 0
      var unitPrice = parseFloat(ci.unit_price) || 0
      var contractVal = contractQty * unitPrice
      var instQty = installed[ci.id] || 0
      var earnedVal = instQty * unitPrice
      var storedQty = stored[ci.id] || 0
      var pct = contractQty > 0 ? Math.round(instQty / contractQty * 1000) / 10 : 0
      rows.push([
        ci.item_number || '',
        ci.description || '',
        ci.unit || '',
        unitPrice,
        contractQty,
        contractVal,
        instQty,
        earnedVal,
        storedQty,
        pct / 100,
        ci.change_order || 'Original'
      ])
    })
    // Add summary rows
    rows.push([])
    rows.push(['', '', '', '', '', 'Original Contract', '', formatMoney(originalValue)])
    if (coValue > 0) rows.push(['', '', '', '', '', 'Change Orders', '', formatMoney(coValue)])
    rows.push(['', '', '', '', '', 'Revised Contract', '', formatMoney(revisedValue)])
    rows.push(['', '', '', '', '', 'Earned to Date', '', formatMoney(revisedEarned)])
    if (totalStored > 0) rows.push(['', '', '', '', '', 'Stored Materials', '', formatMoney(totalStored)])
    rows.push(['', '', '', '', '', '% Complete', '', overallPct + '%'])

    var ws = XLSX.utils.aoa_to_sheet(rows)
    // Set column widths
    ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }]
    // Format price/value columns as currency and % column
    var wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contract Progress')
    XLSX.writeFile(wb, projectName.replace(/[^a-zA-Z0-9 ]/g, '') + ' - Contract Progress.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 space-y-2">
        <div className="flex justify-between"><span className="text-slate-400 text-xs">Original Contract</span><span className="text-slate-200 text-xs font-mono">${formatMoney(originalValue)}</span></div>
        {coValue > 0 && <div className="flex justify-between"><span className="text-slate-400 text-xs">Change Orders</span><span className="text-slate-200 text-xs font-mono">${formatMoney(coValue)}</span></div>}
        <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-white text-sm font-semibold">Revised Contract</span><span className="text-white text-sm font-mono font-semibold">${formatMoney(revisedValue)}</span></div>
        <div className="flex justify-between"><span className="text-orange-400 text-sm">Earned to Date</span><span className="text-orange-400 text-sm font-mono font-semibold">${formatMoney(revisedEarned)}</span></div>
        {totalStored > 0 && <div className="flex justify-between"><span className="text-slate-400 text-xs">Stored Materials</span><span className="text-slate-300 text-xs font-mono">${formatMoney(totalStored)}</span></div>}
        <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
          <div className="bg-orange-500 h-2 rounded-full" style={{ width: Math.min(overallPct, 100) + '%' }} />
        </div>
        <p className="text-slate-500 text-xs text-right">{overallPct}% complete</p>
      </div>

      <button onClick={handleExport}
        className="w-full border border-orange-500/30 text-orange-400 py-2.5 rounded-xl text-sm font-semibold active:bg-orange-500/10">
        Export to Excel
      </button>

      {groupOrder.map(function(key) {
        var label = key === '__original__' ? 'Original Contract' : key
        var groupItems = groups[key]
        return (
          <div key={key}>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-0 px-3 py-2 border-b border-slate-700 bg-slate-800">
                <span className="col-span-1 text-slate-500 text-xs font-semibold">#</span>
                <span className="col-span-4 text-slate-500 text-xs font-semibold">Description</span>
                <span className="col-span-2 text-slate-500 text-xs font-semibold text-right">Contract</span>
                <span className="col-span-2 text-slate-500 text-xs font-semibold text-right">Installed</span>
                <span className="col-span-1 text-slate-500 text-xs font-semibold text-right">Stored</span>
                <span className="col-span-2 text-slate-500 text-xs font-semibold text-right">%</span>
              </div>
              {groupItems.map(function(ci) {
                var contractQty = parseFloat(ci.contract_quantity) || 0
                var installedQty = installed[ci.id] || 0
                var storedQty = stored[ci.id] || 0
                var pct = contractQty > 0 ? Math.round(installedQty / contractQty * 1000) / 10 : 0
                var pctColor = pct >= 100 ? 'text-emerald-400' : pct > 0 ? 'text-orange-400' : 'text-slate-600'
                return (
                  <div key={ci.id} className="grid grid-cols-12 gap-0 px-3 py-2 border-b border-slate-800/50">
                    <span className="col-span-1 text-orange-400 text-xs font-mono">{ci.item_number}</span>
                    <div className="col-span-4 min-w-0">
                      <p className="text-slate-200 text-xs truncate">{ci.description}</p>
                      <p className="text-slate-600 text-xs">{ci.unit}{ci.unit_price ? ' @ $' + Number(ci.unit_price).toFixed(2) : ''}</p>
                    </div>
                    <span className="col-span-2 text-slate-400 text-xs font-mono text-right">{formatNum(contractQty)}</span>
                    <span className="col-span-2 text-slate-200 text-xs font-mono text-right">{installedQty > 0 ? formatNum(installedQty) : '—'}</span>
                    <span className="col-span-1 text-slate-400 text-xs font-mono text-right">{storedQty > 0 ? formatNum(storedQty) : '—'}</span>
                    <span className={'col-span-2 text-xs font-mono text-right ' + pctColor}>{pct > 0 ? pct + '%' : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatMoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Section(props) {
  return (
    <div>
      <p className="text-white font-bold text-sm uppercase tracking-wider mb-2">{props.title}</p>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-1">
        {props.children}
      </div>
    </div>
  )
}

function Empty() {
  return <p className="text-slate-600 text-sm py-3 text-center">No data yet</p>
}

function DatePhotoGroup(props) {
  var [open, setOpen] = useState(false)
  var [zipping, setZipping] = useState(false)

  async function downloadZip() {
    setZipping(true)
    try {
      var zip = new JSZip()
      await Promise.all(props.photos.map(async function(p, i) {
        var url = supabase.storage.from('field-photos').getPublicUrl(p.storage_path).data.publicUrl
        var res = await fetch(url)
        if (!res.ok) return
        var blob = await res.blob()
        var ext = p.file_name ? p.file_name.split('.').pop() : 'jpg'
        zip.file('photo-' + (i + 1) + '.' + ext, blob)
      }))
      var content = await zip.generateAsync({ type: 'blob' })
      var a = document.createElement('a')
      a.href = URL.createObjectURL(content)
      a.download = props.label.replace(/[^a-zA-Z0-9]/g, '-') + '-photos.zip'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) { alert('Download failed: ' + e.message) }
    setZipping(false)
  }

  return (
    <div className="mb-2">
      <button onClick={function() { setOpen(function(o) { return !o }) }}
        className="w-full flex items-center justify-between py-1.5 active:opacity-70">
        <span className="text-slate-500 text-xs">{props.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-xs">{props.photos.length} photos</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-slate-600" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="mt-1">
          <div className="grid grid-cols-4 gap-1.5">
            {props.photos.map(function(p) {
              var url = supabase.storage.from('field-photos').getPublicUrl(p.storage_path).data.publicUrl
              return (
                <button key={p.id} onClick={function() { props.onTap(url) }}
                  className="aspect-square rounded-lg overflow-hidden bg-slate-800">
                  <img src={url} className="w-full h-full object-cover" loading="lazy" />
                </button>
              )
            })}
          </div>
          <button onClick={downloadZip} disabled={zipping}
            className="w-full mt-2 py-2 text-orange-400 text-xs font-semibold border border-orange-500/30 rounded-lg active:bg-orange-500/10 disabled:opacity-50">
            {zipping ? 'Zipping...' : 'Download ' + props.photos.length + ' Photos'}
          </button>
        </div>
      )}
    </div>
  )
}

function formatNum(n) {
  if (n === Math.floor(n)) return String(n)
  return n.toFixed(1)
}
