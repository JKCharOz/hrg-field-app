'use client'
import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function fmtNum(n) {
  var v = parseFloat(n) || 0
  if (v === Math.round(v)) return String(Math.round(v))
  return v.toFixed(2).replace(/\.?0+$/, '')
}
function fmtMoney(n) {
  var v = parseFloat(n) || 0
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) {
  var v = parseFloat(n) || 0
  return (Math.round(v * 10) / 10).toFixed(1) + '%'
}

export default function BidPrintWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <BidPrintPage />
    </Suspense>
  )
}

function BidPrintPage() {
  var params = useSearchParams()
  var router = useRouter()
  var projectId = params.get('id')
  var [project, setProject] = useState(null)
  var [contractItems, setContractItems] = useState([])
  var [installedByItem, setInstalledByItem] = useState({})
  var [storedByItem, setStoredByItem] = useState({})
  var [genericInstalled, setGenericInstalled] = useState([])
  var [delivered, setDelivered] = useState([])
  var [equipment, setEquipment] = useState([])
  var [crew, setCrew] = useState([])
  var [loading, setLoading] = useState(true)

  useEffect(function() { if (projectId) loadAll() }, [projectId])

  async function loadAll() {
    setLoading(true)
    var projRes = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (projRes.data) setProject(projRes.data)

    var [reportsRes, ciRes, instRes, delRes, storedRes, qeRes] = await Promise.all([
      supabase.from('daily_reports').select('id').eq('project_id', projectId),
      supabase.from('contract_items').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase.from('materials').select('*').eq('project_id', projectId).eq('is_delivery', false),
      supabase.from('materials').select('*').eq('project_id', projectId).eq('is_delivery', true),
      supabase.from('stored_materials').select('*').eq('project_id', projectId),
      supabase.from('quantity_entries').select('*').eq('project_id', projectId),
    ])

    setContractItems(ciRes.data || [])

    var byItem = {}
    ;(qeRes.data || []).forEach(function(qe) {
      if (!qe.contract_item_id) return
      byItem[qe.contract_item_id] = (byItem[qe.contract_item_id] || 0) + (parseFloat(qe.quantity) || 0)
    })
    setInstalledByItem(byItem)

    var storedMap = {}
    ;(storedRes.data || []).forEach(function(s) {
      if (!s.contract_item_id) return
      storedMap[s.contract_item_id] = (storedMap[s.contract_item_id] || 0) + (parseFloat(s.quantity) || 0)
    })
    setStoredByItem(storedMap)

    var generic = (instRes.data || []).filter(function(m) { return !m.contract_item_id })
    setGenericInstalled(aggregateByDescUnit(generic))
    setDelivered(aggregateByDescUnit(delRes.data || []))

    var reportIds = (reportsRes.data || []).map(function(r) { return r.id })
    if (reportIds.length > 0) {
      var [eqRes, crRes] = await Promise.all([
        supabase.from('equipment_logs').select('*').in('report_id', reportIds),
        supabase.from('crew_logs').select('*').in('report_id', reportIds),
      ])
      setEquipment(aggregateEquipment(eqRes.data || []))
      setCrew(aggregateCrew(crRes.data || []))
    }

    setLoading(false)
  }

  function aggregateByDescUnit(items) {
    var map = {}
    items.forEach(function(m) {
      var key = (m.material_type || '') + '|' + (m.unit || '')
      if (!map[key]) map[key] = { description: m.material_type, unit: m.unit, total: 0 }
      map[key].total += parseFloat(m.quantity) || 0
    })
    return Object.values(map).sort(function(a, b) { return (a.description || '').localeCompare(b.description || '') })
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
      map[role] = (map[role] || 0) + (parseInt(c.quantity) || 0)
    })
    return Object.keys(map).map(function(role) { return { role: role, total: map[role] } }).sort(function(a, b) { return b.total - a.total })
  }

  if (loading) return <div className="min-h-screen bg-white p-8 text-slate-600">Loading...</div>
  if (!project) return <div className="min-h-screen bg-white p-8 text-slate-600">Project not found.</div>

  // Group contract items by change order
  var coGroups = {}
  var coOrder = []
  contractItems.forEach(function(ci) {
    var key = ci.change_order || '__original__'
    if (!coGroups[key]) { coGroups[key] = []; coOrder.push(key) }
    coGroups[key].push(ci)
  })

  // Summary calcs
  var originalValue = 0, originalEarned = 0
  var revisedValue = 0, revisedEarned = 0
  var totalStored = 0
  contractItems.forEach(function(ci) {
    var qty = parseFloat(ci.contract_quantity) || 0
    var price = parseFloat(ci.unit_price) || 0
    var installed = installedByItem[ci.id] || 0
    var storedQty = storedByItem[ci.id] || 0
    revisedValue += qty * price
    revisedEarned += installed * price
    totalStored += storedQty * price
    if (!ci.change_order) {
      originalValue += qty * price
      originalEarned += installed * price
    }
  })
  var coValue = revisedValue - originalValue
  var overallPct = revisedValue > 0 ? (revisedEarned / revisedValue * 100) : 0

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @page { size: letter portrait; margin: 0.4in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .page-break { page-break-before: always; }
        }
        .bid-table { width: 100%; border-collapse: collapse; }
        .bid-table th, .bid-table td { border: 1px solid #555; padding: 4px 6px; font-size: 10.5px; }
        .bid-table th { background: #eee; font-weight: 600; text-align: center; }
        .bid-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .bid-table td.desc { text-align: left; }
        .bid-table tr.totalrow td { font-weight: 700; background: #f4f4f4; }
        .bid-table tr.coheader td { font-weight: 700; background: #ddd; }
        .section-title { font-weight: 700; font-size: 13px; margin: 14px 0 6px; }
        .summary-box { border: 1px solid #444; padding: 8px 12px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px 12px; }
        .summary-box .label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
        .summary-box .value { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
      `}</style>

      <div className="no-print bg-slate-100 border-b border-slate-300 p-3 flex flex-wrap gap-3 items-center sticky top-0 z-10">
        <button onClick={function() { router.back() }}
          className="text-sm px-3 py-1.5 border border-slate-400 rounded bg-white">← Back</button>
        <p className="text-sm text-slate-700">Bid Project Summary</p>
        <button onClick={function() { window.print() }}
          className="ml-auto text-sm px-4 py-1.5 bg-black text-white rounded font-semibold">Print / Save PDF</button>
      </div>

      <div className="p-6 print:p-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold">{project.project_name}</h1>
          <p className="text-sm text-slate-700">
            {project.project_number ? project.project_number + ' · ' : ''}
            {project.owner || ''}
            {project.location ? ' · ' + project.location : ''}
          </p>
          {project.project_engineer && <p className="text-xs text-slate-600">Project Engineer: {project.project_engineer}</p>}
        </div>

        <div className="summary-box">
          <div><p className="label">Original Contract</p><p className="value">{fmtMoney(originalValue)}</p></div>
          <div><p className="label">Change Orders</p><p className="value">{fmtMoney(coValue)}</p></div>
          <div><p className="label">Revised Contract</p><p className="value">{fmtMoney(revisedValue)}</p></div>
          <div><p className="label">% Complete</p><p className="value">{fmtPct(overallPct)}</p></div>
          <div><p className="label">Earned To Date</p><p className="value">{fmtMoney(revisedEarned)}</p></div>
          <div><p className="label">Stored Materials</p><p className="value">{fmtMoney(totalStored)}</p></div>
          <div><p className="label">Earned + Stored</p><p className="value">{fmtMoney(revisedEarned + totalStored)}</p></div>
          <div><p className="label">Balance Remaining</p><p className="value">{fmtMoney(revisedValue - revisedEarned)}</p></div>
        </div>

        {contractItems.length > 0 && (
          <>
            <p className="section-title">Contract Progress</p>
            <table className="bid-table">
              <thead>
                <tr>
                  <th style={{ width: '7%' }}>Item</th>
                  <th className="text-left" style={{ width: '32%' }}>Description</th>
                  <th style={{ width: '5%' }}>Unit</th>
                  <th style={{ width: '8%' }}>Bid Qty</th>
                  <th style={{ width: '9%' }}>Unit Price</th>
                  <th style={{ width: '10%' }}>Contract Value</th>
                  <th style={{ width: '8%' }}>Installed</th>
                  <th style={{ width: '7%' }}>Stored</th>
                  <th style={{ width: '10%' }}>Earned</th>
                  <th style={{ width: '6%' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {coOrder.map(function(coKey) {
                  var rows = coGroups[coKey]
                  var coLabel = coKey === '__original__' ? 'Original Contract' : coKey
                  var coContract = 0, coEarned = 0
                  rows.forEach(function(ci) {
                    coContract += (parseFloat(ci.contract_quantity) || 0) * (parseFloat(ci.unit_price) || 0)
                    coEarned += (installedByItem[ci.id] || 0) * (parseFloat(ci.unit_price) || 0)
                  })
                  return (
                    <React.Fragment key={coKey}>
                      <tr className="coheader">
                        <td colSpan={10}>{coLabel}</td>
                      </tr>
                      {rows.map(function(ci) {
                        var qty = parseFloat(ci.contract_quantity) || 0
                        var price = parseFloat(ci.unit_price) || 0
                        var contractVal = qty * price
                        var inst = installedByItem[ci.id] || 0
                        var stored = storedByItem[ci.id] || 0
                        var earned = inst * price
                        var pct = qty > 0 ? (inst / qty * 100) : 0
                        return (
                          <tr key={ci.id}>
                            <td className="num">{ci.item_number || ''}</td>
                            <td className="desc">{ci.description || ''}</td>
                            <td className="num">{ci.unit || ''}</td>
                            <td className="num">{fmtNum(qty)}</td>
                            <td className="num">{fmtMoney(price)}</td>
                            <td className="num">{fmtMoney(contractVal)}</td>
                            <td className="num">{fmtNum(inst)}</td>
                            <td className="num">{stored > 0 ? fmtNum(stored) : ''}</td>
                            <td className="num">{fmtMoney(earned)}</td>
                            <td className="num">{fmtPct(pct)}</td>
                          </tr>
                        )
                      })}
                      <tr className="totalrow">
                        <td colSpan={5} className="desc">{coLabel} Subtotal</td>
                        <td className="num">{fmtMoney(coContract)}</td>
                        <td colSpan={2}></td>
                        <td className="num">{fmtMoney(coEarned)}</td>
                        <td className="num">{coContract > 0 ? fmtPct(coEarned / coContract * 100) : '—'}</td>
                      </tr>
                    </React.Fragment>
                  )
                })}
                <tr className="totalrow">
                  <td colSpan={5} className="desc">Revised Contract Total</td>
                  <td className="num">{fmtMoney(revisedValue)}</td>
                  <td colSpan={2}></td>
                  <td className="num">{fmtMoney(revisedEarned)}</td>
                  <td className="num">{fmtPct(overallPct)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {genericInstalled.length > 0 && (
          <>
            <p className="section-title">Quantities Installed (non-bid)</p>
            <table className="bid-table">
              <thead>
                <tr>
                  <th className="text-left" style={{ width: '70%' }}>Description</th>
                  <th style={{ width: '15%' }}>Quantity</th>
                  <th style={{ width: '15%' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {genericInstalled.map(function(q, i) {
                  return (
                    <tr key={i}>
                      <td className="desc">{q.description}</td>
                      <td className="num">{fmtNum(q.total)}</td>
                      <td className="num">{q.unit}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {delivered.length > 0 && (
          <>
            <p className="section-title">Materials Delivered</p>
            <table className="bid-table">
              <thead>
                <tr>
                  <th className="text-left" style={{ width: '70%' }}>Description</th>
                  <th style={{ width: '15%' }}>Quantity</th>
                  <th style={{ width: '15%' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {delivered.map(function(m, i) {
                  return (
                    <tr key={i}>
                      <td className="desc">{m.description}</td>
                      <td className="num">{fmtNum(m.total)}</td>
                      <td className="num">{m.unit}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {equipment.length > 0 && (
          <>
            <p className="section-title">Equipment</p>
            <table className="bid-table">
              <thead>
                <tr>
                  <th className="text-left" style={{ width: '60%' }}>Type / Description</th>
                  <th style={{ width: '15%' }}>Pieces</th>
                  <th style={{ width: '25%' }}>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map(function(e, i) {
                  return (
                    <tr key={i}>
                      <td className="desc">{e.type}{e.description && e.description !== e.type ? ' — ' + e.description : ''}</td>
                      <td className="num">{e.count}</td>
                      <td className="num">{e.totalHours > 0 ? fmtNum(e.totalHours) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {crew.length > 0 && (
          <>
            <p className="section-title">Crew</p>
            <table className="bid-table">
              <thead>
                <tr>
                  <th className="text-left" style={{ width: '70%' }}>Role</th>
                  <th style={{ width: '30%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {crew.map(function(c, i) {
                  return (
                    <tr key={i}>
                      <td className="desc">{c.role}</td>
                      <td className="num">{c.total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        <p className="text-xs text-slate-500 mt-6">Generated {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
}
