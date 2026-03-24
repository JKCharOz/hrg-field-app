'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PreviewPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500 text-sm">Loading...</p></div>}>
      <PreviewPage />
    </Suspense>
  )
}

function PreviewPage() {
  var params = useSearchParams()
  var router = useRouter()
  var [data, setData] = useState(null)
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState(null)
  var [generating, setGenerating] = useState(false)
  var [pdfUrl, setPdfUrl] = useState(null)

  useEffect(function() {
    var reportId = params.get('report')
    if (!reportId) { setError('No report ID.'); setLoading(false); return }
    loadAll(reportId)
  }, [])

  async function loadAll(reportId) {
    var repResult = await supabase.from('daily_reports').select('*').eq('id', reportId).single()
    if (repResult.error || !repResult.data) { setError('Report not found.'); setLoading(false); return }
    var rep = repResult.data
    var projResult = await supabase.from('projects').select('*').eq('id', rep.project_id).single()
    var all = await Promise.all([
      supabase.from('activity_logs').select('*').eq('report_id', reportId).order('logged_at', { ascending: true }),
      supabase.from('materials').select('*').eq('report_id', reportId),
      supabase.from('equipment_logs').select('*').eq('report_id', reportId),
      supabase.from('field_photos').select('*').eq('report_id', reportId).eq('is_report_photo', true).order('report_order', { ascending: true }).limit(4),
      supabase.from('crew_logs').select('*').eq('report_id', reportId),
    ])
    var inspResult = rep.inspector_id
      ? await supabase.from('users').select('full_name, signature_url').eq('id', rep.inspector_id).maybeSingle()
      : { data: null }
    setData({
      report: rep,
      project: projResult.data || {},
      activities: all[0].data || [],
      materials: all[1].data || [],
      equipment: all[2].data || [],
      photos: all[3].data || [],
      crew: all[4].data || [],
      inspector: inspResult.data || null,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading preview...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-slate-900 px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={function() { router.back() }} className="text-orange-400 text-sm">Back</button>
        <p className="text-white text-sm font-semibold">Report Preview</p>
        <button onClick={async function() {
          setGenerating(true)
          var res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: data.report.id }) })
          var result = await res.json()
          setGenerating(false)
          if (result.url) { setPdfUrl(result.url); window.open(result.url, '_blank') }
          else { alert('PDF generation failed: ' + (result.error || 'unknown error') + (result.stack ? '\n\n' + result.stack.slice(0,200) : '')) }
        }} disabled={generating}
          className="bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 active:bg-orange-600">
          {generating ? 'Generating...' : 'Generate PDF'}
        </button>
      </div>
      <div className="p-2">
        <ReportTemplate data={data} />
      </div>
    </div>
  )
}

export function ReportTemplate(props) {
  var d = props.data
  var report = d.report
  var project = d.project
  var activities = d.activities || []
  var materials = d.materials || []
  var equipment = d.equipment || []
  var photos = d.photos || []
  var crew = d.crew || []
  var inspector = d.inspector || null

  var delivered = materials.filter(function(m) { return m.is_delivery === true })
  var installed = materials.filter(function(m) { return m.is_delivery === false })

  var reportDate = report.report_date
    ? new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : ''

  var weekday = report.report_date
    ? new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    : ''

  var wc = report.weather_conditions && report.weather_conditions !== '[]' ? String(report.weather_conditions) : ''
  var weatherVals = wc ? wc.replace('[','').replace(']','').split(',').map(function(s) { return s.trim() }).filter(Boolean) : []
  var sc = report.site_conditions && report.site_conditions !== '[]' ? String(report.site_conditions) : ''
  var siteVals = sc ? sc.replace('[','').replace(']','').split(',').map(function(s) { return s.trim() }).filter(Boolean) : []

  var crewMap = {}
  crew.forEach(function(c) { crewMap[c.role] = (crewMap[c.role] || 0) + (c.quantity || 0) })

  var EQUIP_MAP = {
    'Excavator': 'Excavators', 'excavator': 'Excavators',
    'Backhoe': 'Backhoes', 'backhoe': 'Backhoes',
    'Loader': 'Loaders', 'loader': 'Loaders',
    'Pump': 'Pumps', 'pump': 'Pumps',
    'Compressor': 'Compressors', 'compressor': 'Compressors',
    'Compactor / Roller': 'Pavers & Rollers', 'Paver': 'Pavers & Rollers',
    'Dump Truck': 'Haul Trucks', 'dump truck': 'Haul Trucks',
    'Dozer': 'Misc. Equipment', 'Grader': 'Misc. Equipment',
    'Service Truck': 'Support Truck', 'Other': 'Misc. Equipment', 'other': 'Misc. Equipment'
  }
  var equipByType = {}
  equipment.forEach(function(e) {
    var t = EQUIP_MAP[e.equip_type] || e.equip_type || 'Misc. Equipment'
    if (!equipByType[t]) equipByType[t] = []
    equipByType[t].push(e.description || e.equip_type)
  })

  var EQUIP_COLS = ['Excavators', 'Backhoes', 'Loaders', 'Pumps', 'Compressors']
  var EQUIP_COLS2 = ['Boxes & Shoring', 'Support Truck', 'Pavers & Rollers', 'Haul Trucks', 'Misc. Equipment']

  var signedBy = inspector && inspector.full_name ? inspector.full_name : 'Inspector'
  var signatureUrl = (inspector && inspector.signature_url) ? inspector.signature_url : null

  var border = '1px solid #000'
  var cellPad = { padding: '1px 3px', borderBottom: '1px solid #ccc', fontSize: '9px', lineHeight: '1.2' }
  var headerStyle = { backgroundColor: '#e0e0e0', padding: '2px 4px', fontWeight: 'bold', borderBottom: border, fontSize: '10px' }

  var equipRows = Math.max(
    ...EQUIP_COLS.concat(EQUIP_COLS2).map(function(k) { return equipByType[k] ? equipByType[k].length : 0 }),
    2
  )

  function Check(cp) {
    return <span style={{ marginRight: '10px' }}>{cp.checked ? '[X]' : '[ ]'} {cp.label}</span>
  }

  return (
    <div id="report-template" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#000', backgroundColor: '#fff', maxWidth: '780px', margin: '0 auto', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
        <img src="/hrg-logo.png" style={{ height: '40px', objectFit: 'contain' }} />
        <p style={{ fontWeight: 'bold', fontSize: '13px', margin: 0 }}>DAILY OBSERVATION REPORT</p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', border: border, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...cellPad, fontWeight: 'bold', width: '18%' }}>Project:</td>
            <td style={{ ...cellPad, borderRight: border }}>{project.project_name || ''}</td>
            <td style={{ ...cellPad, fontWeight: 'bold', width: '18%' }}>Report No:</td>
            <td style={cellPad}>{report.report_number || ''}</td>
          </tr>
          <tr>
            <td style={{ ...cellPad, fontWeight: 'bold' }}>Owner:</td>
            <td style={{ ...cellPad, borderRight: border }}>{project.owner || ''}</td>
            <td style={{ ...cellPad, fontWeight: 'bold' }}>HRG Project No:</td>
            <td style={cellPad}>{project.project_number || ''}</td>
          </tr>
          <tr>
            <td style={{ ...cellPad, fontWeight: 'bold' }}>Re:</td>
            <td style={{ ...cellPad, borderRight: border }}>{report.re || ''}</td>
            <td style={{ ...cellPad, fontWeight: 'bold' }}>Date:</td>
            <td style={cellPad}>{reportDate}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', border: border }}>
        <tbody>
          <tr>
            <td style={{ ...cellPad, width: '25%', verticalAlign: 'top' }}>
              <strong style={{ textDecoration: 'underline' }}>Weather:</strong><br />
              <span>Temp: {report.weather_temp || ''}</span><br />
              <Check checked={weatherVals.indexOf('Clear') >= 0} label="Clear" /><br />
              <Check checked={weatherVals.indexOf('Cloudy') >= 0} label="Cloudy" /><br />
              <Check checked={weatherVals.indexOf('Rain') >= 0} label="Rain" /><br />
              <Check checked={weatherVals.indexOf('Snow') >= 0} label="Snow" /><br />
              <Check checked={weatherVals.indexOf('Fog') >= 0} label="Fog" />
            </td>
            <td style={{ ...cellPad, width: '30%', verticalAlign: 'top', borderLeft: border }}>
              <strong style={{ textDecoration: 'underline' }}>Weekday:</strong><br />
              <Check checked={weekday === 'Monday'} label="Monday" /><br />
              <Check checked={weekday === 'Tuesday'} label="Tuesday" /><br />
              <Check checked={weekday === 'Wednesday'} label="Wednesday" /><br />
              <Check checked={weekday === 'Thursday'} label="Thursday" /><br />
              <Check checked={weekday === 'Friday'} label="Friday" /><br />
              <Check checked={weekday === 'Saturday'} label="Saturday" />
            </td>
            <td style={{ ...cellPad, width: '25%', verticalAlign: 'top', borderLeft: border }}>
              <strong style={{ textDecoration: 'underline' }}>Site Conditions:</strong><br />
              <Check checked={siteVals.indexOf('Dry') >= 0} label="Dry" /><br />
              <Check checked={siteVals.indexOf('Wet') >= 0} label="Wet" /><br />
              <Check checked={siteVals.indexOf('Muddy') >= 0} label="Muddy" /><br />
              <Check checked={siteVals.indexOf('Snow Covered') >= 0} label="Snow" />
            </td>
            <td style={{ ...cellPad, width: '20%', verticalAlign: 'top', borderLeft: border }}>
              <strong style={{ textDecoration: 'underline' }}>Work Period:</strong><br />
              <Check checked={report.work_period === 'Day Work'} label="Day Work" /><br />
              <Check checked={report.work_period === 'Night Work'} label="Night Work" />
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', border: border }}>
        <tbody>
          <tr>
            <td style={{ ...cellPad, width: '50%', borderRight: border }}><strong>Contractors:</strong> {project.contractor || ''}</td>
            <td style={cellPad}><strong>Project Engineers:</strong> {project.project_engineer || ''}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', border: border }}>
        <thead><tr style={headerStyle}><td colSpan={2}>Work Force:</td></tr></thead>
        <tbody>
          <tr>
            <td style={{ ...cellPad, width: '40%', borderRight: border, fontWeight: 'bold' }}>Hours Worked:</td>
            <td style={cellPad}>{report.hours_worked ? report.hours_worked + ' hours' : 'N/A'}</td>
          </tr>
          {['Foreman', 'Operator', 'Laborer', 'Truck Driver', 'Superintendent', 'Other'].map(function(role) {
            return (
              <tr key={role}>
                <td style={{ ...cellPad, width: '40%', borderRight: border }}>{role}:</td>
                <td style={cellPad}>{crewMap[role] || 'N/A'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ border: border, marginBottom: '6px' }}>
        <div style={headerStyle}>Equipment:</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{EQUIP_COLS.map(function(col) { return <th key={col} style={{ padding: '2px 4px', borderRight: border, borderBottom: border, fontWeight: 'bold', textDecoration: 'underline', fontSize: '9px', textAlign: 'left', width: '20%' }}>{col}</th> })}</tr>
          </thead>
          <tbody>
            {Array.from({ length: equipRows }).map(function(_, i) {
              return <tr key={i}>{EQUIP_COLS.map(function(col) { var items = equipByType[col] || []; return <td key={col} style={{ padding: '2px 4px', borderRight: border, borderBottom: '1px solid #eee', fontSize: '9px' }}>{items[i] || ''}</td> })}</tr>
            })}
            <tr>{EQUIP_COLS2.map(function(col) { return <th key={col} style={{ padding: '2px 4px', borderRight: border, borderBottom: border, borderTop: border, fontWeight: 'bold', textDecoration: 'underline', fontSize: '9px', textAlign: 'left' }}>{col}</th> })}</tr>
            {Array.from({ length: equipRows }).map(function(_, i) {
              return <tr key={'b' + i}>{EQUIP_COLS2.map(function(col) { var items = equipByType[col] || []; return <td key={col} style={{ padding: '2px 4px', borderRight: border, borderBottom: '1px solid #eee', fontSize: '9px' }}>{items[i] || ''}</td> })}</tr>
            })}
          </tbody>
        </table>
      </div>

      <LabelBlock label="Sub-Contractors:" value="" />
      <LabelBlock label="Visitors:" value={report.visitors || ''} />
      <LabelBlock label="Items Discussed & People Contacted:" value={report.items_discussed || ''} />

      <div style={{ border: border, marginBottom: '6px' }}>
        <div style={headerStyle}>Work Observed:</div>
        <div style={{ padding: '4px 6px', minHeight: '40px' }}>
          {activities.length === 0
            ? <p style={{ margin: 0, color: '#888' }}>No activities logged.</p>
            : activities.map(function(a) {
                var t = new Date(a.logged_at)
                var h = t.getHours(); var mn = t.getMinutes()
                var ampm = h >= 12 ? 'PM' : 'AM'
                var h12 = h % 12 || 12
                var mm = mn < 10 ? '0' + mn : '' + mn
                return <p key={a.id} style={{ margin: '1px 0' }}><strong>{h12}:{mm} {ampm}</strong> -- {a.notes || ''}</p>
              })
          }
        </div>
      </div>

      <div style={{ border: border, marginBottom: '6px' }}>
        <div style={headerStyle}>Quantity Installed -- IDIQ:</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '2px 4px', borderRight: border, borderBottom: border, width: '10%', textAlign: 'left', fontSize: '9px' }}>Item No.</th>
              <th style={{ padding: '2px 4px', borderRight: border, borderBottom: border, width: '40%', textAlign: 'left', fontSize: '9px' }}>Description</th>
              <th style={{ padding: '2px 4px', borderRight: border, borderBottom: border, width: '15%', textAlign: 'left', fontSize: '9px' }}>Quantity</th>
              <th style={{ padding: '2px 4px', borderRight: border, borderBottom: border, width: '10%', textAlign: 'left', fontSize: '9px' }}>Unit</th>
              <th style={{ padding: '2px 4px', borderBottom: border, textAlign: 'left', fontSize: '9px' }}>Sheet/STA/Note</th>
            </tr>
          </thead>
          <tbody>
            {(installed.length === 0 ? Array.from({ length: 4 }).map(function(_, i) { return { id: 'empty' + i, material_type: '', quantity: '', unit: '', location_ref: '' } }) : installed).map(function(m, i) {
              return (
                <tr key={m.id}>
                  <td style={{ padding: '3px 4px', borderRight: border, borderBottom: '1px solid #eee' }}>{installed.length > 0 ? i + 1 : ''}</td>
                  <td style={{ padding: '3px 4px', borderRight: border, borderBottom: '1px solid #eee' }}>{m.material_type}</td>
                  <td style={{ padding: '3px 4px', borderRight: border, borderBottom: '1px solid #eee' }}>{m.quantity}</td>
                  <td style={{ padding: '3px 4px', borderRight: border, borderBottom: '1px solid #eee' }}>{m.unit}</td>
                  <td style={{ padding: '3px 4px', borderBottom: '1px solid #eee' }}>{m.location_ref || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <LabelBlock label="Materials Delivered:" value={delivered.map(function(m) { return m.material_type + ' -- ' + m.quantity + ' ' + m.unit }).join(', ')} />
      <LabelBlock label="Testing:" value="" />
      <LabelBlock label="RFI:" value="" />
      <LabelBlock label="Nonconforming Work:" value="" />
      <LabelBlock label="Remarks:" value={report.remarks || ''} />

      {photos.length > 0 && (
        <div style={{ border: border, marginBottom: '6px' }}>
          <div style={headerStyle}>Photos:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px' }}>
            {photos.map(function(p) {
              var url = 'https://jwksvwyoyxrakaagcxyk.supabase.co/storage/v1/object/public/field-photos/' + p.storage_path
              return (
                <div key={p.id} style={{ border: '1px solid #ccc' }}>
                  <img src={url} style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                  {p.caption && <p style={{ margin: '3px', fontSize: '8px', color: '#444' }}>{p.caption}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', border: border, marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 6px', width: '70%', borderRight: border }}>
              Signed by: {signedBy}
              {signatureUrl && <img src={signatureUrl} style={{ height: '32px', display: 'inline-block', marginLeft: '8px', verticalAlign: 'middle', objectFit: 'contain' }} />}
            </td>
            <td style={{ padding: '4px 6px' }}>Date: {reportDate}</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '4px 6px', borderTop: border }}>
              Copies: [X] File &nbsp;&nbsp; [X] Owner &nbsp;&nbsp; [ ] Other
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  )
}

function LabelBlock(props) {
  return (
    <div style={{ border: '1px solid #000', marginBottom: '6px' }}>
      <div style={{ backgroundColor: '#e0e0e0', padding: '2px 4px', fontWeight: 'bold', borderBottom: '1px solid #000', fontSize: '10px' }}>
        {props.label}
      </div>
      <div style={{ padding: '4px 6px', minHeight: '20px', fontSize: '10px', whiteSpace: 'pre-wrap', color: props.value ? '#000' : '#999' }}>
        {props.value || 'N/A'}
      </div>
    </div>
  )
}
