import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

var supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    var { reportId } = await req.json()
    if (!reportId) { return Response.json({ error: 'No reportId' }, { status: 400 }) }

    var repResult = await supabaseAdmin.from('daily_reports').select('*').eq('id', reportId).single()
    if (repResult.error || !repResult.data) { return Response.json({ error: 'Report not found' }, { status: 404 }) }
    var report = repResult.data

    var projResult = await supabaseAdmin.from('projects').select('*').eq('id', report.project_id).single()
    var project = projResult.data || {}

    var all = await Promise.all([
      supabaseAdmin.from('activity_logs').select('*').eq('report_id', reportId).order('logged_at', { ascending: true }),
      supabaseAdmin.from('materials').select('*').eq('report_id', reportId),
      supabaseAdmin.from('equipment_logs').select('*').eq('report_id', reportId),
      supabaseAdmin.from('field_photos').select('*').eq('report_id', reportId).eq('is_report_photo', true).order('report_order', { ascending: true }).limit(4),
      supabaseAdmin.from('crew_logs').select('*').eq('report_id', reportId),
    ])
    var activities = all[0].data || []
    var materials = all[1].data || []
    var equipment = all[2].data || []
    var photos = all[3].data || []
    var crew = all[4].data || []

    var inspResult = report.inspector_id
      ? await supabaseAdmin.from('users').select('full_name, signature_url').eq('id', report.inspector_id).maybeSingle()
      : { data: null }
    var signedBy = inspResult.data && inspResult.data.full_name ? inspResult.data.full_name : 'Inspector'
    var signatureUrl = inspResult.data && inspResult.data.signature_url ? inspResult.data.signature_url : null
    var sigImgTag = ''
    if (signatureUrl) {
      try {
        var sigRes = await fetch(signatureUrl)
        var sigBuf = await sigRes.arrayBuffer()
        var sigB64 = Buffer.from(sigBuf).toString('base64')
        sigImgTag = '<img src="data:image/png;base64,' + sigB64 + '" style="height:48px;width:200px;display:block;margin-top:4px;object-fit:contain" />'
      } catch(e) { sigImgTag = '' }
    }
    var signatureBase64 = null
    if (signatureUrl) {
      try {
        var sigFetch = await fetch(signatureUrl)
        var sigBuffer = await sigFetch.arrayBuffer()
        signatureBase64 = 'data:image/png;base64,' + Buffer.from(sigBuffer).toString('base64')
      } catch (e) { signatureBase64 = null }
    }

    var delivered = materials.filter(function(m) { return m.is_delivery === true })
    var installed = materials.filter(function(m) { return m.is_delivery === false })

    var reportDate = report.report_date
      ? new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : ''
    var weekday = report.report_date
      ? new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
      : ''

    var wc = report.weather_conditions && report.weather_conditions !== '[]' ? String(report.weather_conditions).replace(/^\{\},?/, '') : ''
    var weatherVals = wc ? wc.split(',').map(function(s) { return s.trim() }).filter(Boolean) : []
    var sc = report.site_conditions && report.site_conditions !== '[]' ? String(report.site_conditions).replace(/^\{\},?/, '') : ''
    var siteVals = sc ? sc.split(',').map(function(s) { return s.trim() }).filter(Boolean) : []

    var crewMap = {}
    crew.forEach(function(c) { crewMap[c.role] = (crewMap[c.role] || 0) + (c.quantity || 0) })

    var EQUIP_MAP = {
      'Excavator': 'Excavators', 'excavator': 'Excavators',
      'Backhoe': 'Backhoes', 'backhoe': 'Backhoes',
      'Loader': 'Loaders', 'loader': 'Loaders',
      'Pump': 'Pumps', 'Compressor': 'Compressors',
      'Compactor / Roller': 'Pavers & Rollers', 'Paver': 'Pavers & Rollers',
      'Dump Truck': 'Haul Trucks', 'dump truck': 'Haul Trucks',
      'Dozer': 'Misc. Equipment', 'Grader': 'Misc. Equipment',
      'Service Truck': 'Support Truck', 'Other': 'Misc. Equipment'
    }
    var equipByType = {}
    equipment.forEach(function(e) {
      var t = EQUIP_MAP[e.equip_type] || e.equip_type || 'Misc. Equipment'
      if (!equipByType[t]) equipByType[t] = []
      equipByType[t].push(e.description || e.equip_type)
    })

    var SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    var chk = function(v, l) { return (v ? '[X]' : '[ ]') + ' ' + l }
    var na = function(v) { return v || 'N/A' }
    var ECOLS = ['Excavators','Backhoes','Loaders','Pumps','Compressors']
    var ECOLS2 = ['Boxes & Shoring','Support Truck','Pavers & Rollers','Haul Trucks','Misc. Equipment']
    var eRows = Math.max(...ECOLS.concat(ECOLS2).map(function(k) { return equipByType[k] ? equipByType[k].length : 0 }), 2)

    function equipRows(cols) {
      var rows = ''
      for (var i = 0; i < eRows; i++) {
        rows += '<tr>'
        cols.forEach(function(col) {
          var items = equipByType[col] || []
          rows += '<td style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #eee;font-size:9px">' + (items[i] || '') + '</td>'
        })
        rows += '</tr>'
      }
      return rows
    }

    function activityRows() {
      if (!activities.length) return '<p style="color:#888;margin:0">N/A</p>'
      return activities.map(function(a) {
        var t = new Date(a.logged_at)
        var h = t.getHours(); var mn = t.getMinutes()
        var ampm = h >= 12 ? 'PM' : 'AM'
        var h12 = h % 12 || 12
        var mm = mn < 10 ? '0' + mn : '' + mn
        return '<p style="margin:1px 0"><strong>' + h12 + ':' + mm + ' ' + ampm + '</strong> -- ' + (a.notes || '') + '</p>'
      }).join('')
    }

    function qtyRows() {
      var rows = installed.length > 0 ? installed : [{id:'e1',material_type:'',quantity:'',unit:'',location_ref:''},{id:'e2',material_type:'',quantity:'',unit:'',location_ref:''},{id:'e3',material_type:'',quantity:'',unit:'',location_ref:''},{id:'e4',material_type:'',quantity:'',unit:'',location_ref:''}]
      return rows.map(function(m, i) {
        return '<tr><td style="padding:3px 4px;border-right:1px solid #000;border-bottom:1px solid #eee">' + (installed.length > 0 ? i+1 : '') + '</td><td style="padding:3px 4px;border-right:1px solid #000;border-bottom:1px solid #eee">' + (m.material_type||'') + '</td><td style="padding:3px 4px;border-right:1px solid #000;border-bottom:1px solid #eee">' + (m.quantity||'') + '</td><td style="padding:3px 4px;border-right:1px solid #000;border-bottom:1px solid #eee">' + (m.unit||'') + '</td><td style="padding:3px 4px;border-bottom:1px solid #eee">' + (m.location_ref||'') + '</td></tr>'
      }).join('')
    }

    function photoHtml() {
      if (!photos.length) return ''
      var cells = photos.map(function(p) {
        var url = SUPABASE_URL + '/storage/v1/object/public/field-photos/' + p.storage_path
        return '<div style="border:1px solid #ccc;overflow:hidden"><img src="' + url + '" style="width:100%;height:180px;object-fit:cover;display:block" />' + (p.caption ? '<p style="margin:4px 6px;font-size:9px;color:#444">' + p.caption + '</p>' : '') + '</div>'
      }).join('')
      return '<div style="border:1px solid #000;margin-bottom:8px"><div style="background:#d8d8d8;padding:4px 6px;font-weight:bold;border-bottom:1px solid #000;font-size:11px">Photos:</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">' + cells + '</div></div>'
    }

    function labelBlock(label, value) {
      return '<div style="border:1px solid #000;margin-bottom:8px"><div style="background:#d8d8d8;padding:4px 6px;font-weight:bold;border-bottom:1px solid #000;font-size:11px">' + label + '</div><div style="padding:6px 8px;min-height:22px;font-size:11px;white-space:pre-wrap;color:' + (value ? '#000' : '#999') + '">' + (value || 'N/A') + '</div></div>'
    }

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:20px}table{border-collapse:collapse}td,th{padding:3px 6px}*{box-sizing:border-box}p{margin:2px 0}</style></head><body>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px">'
    + '<img src="' + process.env.NEXT_PUBLIC_APP_URL + '/hrg-logo.png" style="height:40px;object-fit:contain" />'
    + '<p style="font-weight:bold;font-size:13px;margin:0">DAILY OBSERVATION REPORT</p></div>'
    + '<table style="width:100%;margin-bottom:8px;border:1px solid #000"><tbody>'
    + '<tr><td style="font-weight:bold;width:100px;padding:2px 4px;border-bottom:1px solid #ccc">Project:</td><td style="padding:2px 4px;border-bottom:1px solid #ccc;border-right:1px solid #000">' + na(project.project_name) + '</td><td style="font-weight:bold;width:110px;padding:2px 4px;border-bottom:1px solid #ccc">Report No:</td><td style="padding:2px 4px;border-bottom:1px solid #ccc">' + na(report.report_number) + '</td></tr>'
    + '<tr><td style="font-weight:bold;padding:2px 4px;border-bottom:1px solid #ccc">Owner:</td><td style="padding:2px 4px;border-bottom:1px solid #ccc;border-right:1px solid #000">' + na(project.owner) + '</td><td style="font-weight:bold;padding:2px 4px;border-bottom:1px solid #ccc">HRG Project No:</td><td style="padding:2px 4px;border-bottom:1px solid #ccc">' + na(project.project_number) + '</td></tr>'
    + '<tr><td style="font-weight:bold;padding:2px 4px">Re:</td><td style="padding:2px 4px;border-right:1px solid #000">' + na(report.re) + '</td><td style="font-weight:bold;padding:2px 4px">Date:</td><td style="padding:2px 4px">' + reportDate + (weekday ? ' (' + weekday + ')' : '') + '</td></tr>'
    + '</tbody></table>'
    + '<table style="width:100%;margin-bottom:8px;border:1px solid #000"><tbody><tr>'
    + '<td style="padding:4px;width:25%;vertical-align:top"><strong style="text-decoration:underline">Weather:</strong><br>Temp: ' + na(report.weather_temp) + '<br>' + chk(weatherVals.indexOf('Clear')>=0||weatherVals.indexOf('Sunny')>=0,'Sunny') + '<br>' + chk(weatherVals.indexOf('Rain')>=0||weatherVals.indexOf('Heavy Rain')>=0,'Rain') + '<br>' + chk(weatherVals.indexOf('Cloudy')>=0||weatherVals.indexOf('Partly Cloudy')>=0,'Overcast') + '<br>' + chk(weatherVals.indexOf('Fog')>=0,'Fog') + '</td>'
    + '<td style="padding:4px;width:30%;vertical-align:top;border-left:1px solid #000"><strong style="text-decoration:underline">Weekday:</strong><br>' + chk(weekday==='Monday','Monday') + ' ' + chk(weekday==='Thursday','Thursday') + '<br>' + chk(weekday==='Tuesday','Tuesday') + ' ' + chk(weekday==='Friday','Friday') + '<br>' + chk(weekday==='Wednesday','Wednesday') + ' ' + chk(weekday==='Saturday','Saturday') + '</td>'
    + '<td style="padding:4px;width:25%;vertical-align:top;border-left:1px solid #000"><strong style="text-decoration:underline">Site Conditions:</strong><br>' + chk(siteVals.indexOf('Dry')>=0,'Dry') + '<br>' + chk(siteVals.indexOf('Wet')>=0,'Wet') + '<br>' + chk(siteVals.indexOf('Muddy')>=0,'Muddy') + '<br>' + chk(siteVals.indexOf('Snow Covered')>=0,'Snow') + '</td>'
    + '<td style="padding:4px;width:20%;vertical-align:top;border-left:1px solid #000"><strong style="text-decoration:underline">Work Period:</strong><br>' + chk(report.work_period==='Day Work','Day Work') + '<br>' + chk(report.work_period==='Night Work','Night Work') + '</td>'
    + '</tr></tbody></table>'
    + '<table style="width:100%;margin-bottom:8px;border:1px solid #000"><tbody><tr><td style="padding:4px 6px;width:50%;border-right:1px solid #000"><strong>Contractors:</strong> ' + na(project.contractor) + '</td><td style="padding:2px 4px"><strong>Project Engineers:</strong> ' + na(project.project_engineer) + '</td></tr></tbody></table>'
    + '<table style="width:100%;margin-bottom:8px;border:1px solid #000"><thead><tr style="background:#d8d8d8"><td colspan="2" style="padding:4px 6px;font-weight:bold;font-size:11px">Work Force:</td></tr></thead><tbody>'
    + '<tr><td style="padding:2px 4px;width:40%;border-right:1px solid #000;border-bottom:1px solid #ccc;font-weight:bold">Hours Worked:</td><td style="padding:2px 4px;border-bottom:1px solid #ccc">' + (report.hours_worked ? report.hours_worked + ' hours' : 'N/A') + '</td></tr>'
    + ['Foreman','Operator','Laborer','Truck Driver','Superintendent','Other'].map(function(r) { return '<tr><td style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #ccc">' + r + ':</td><td style="padding:2px 4px;border-bottom:1px solid #ccc">' + (crewMap[r] || 'N/A') + '</td></tr>' }).join('')
    + '</tbody></table>'
    + '<div style="border:1px solid #000;margin-bottom:8px"><div style="background:#d8d8d8;padding:4px 6px;font-weight:bold;border-bottom:1px solid #000;font-size:11px">Equipment:</div>'
    + '<table style="width:100%"><thead><tr>' + ECOLS.map(function(c) { return '<th style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #000;font-weight:bold;text-decoration:underline;font-size:9px;text-align:left;width:20%">' + c + '</th>' }).join('') + '</tr></thead>'
    + '<tbody>' + equipRows(ECOLS)
    + '<tr>' + ECOLS2.map(function(c) { return '<th style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #000;border-top:1px solid #000;font-weight:bold;text-decoration:underline;font-size:9px;text-align:left">' + c + '</th>' }).join('') + '</tr>'
    + equipRows(ECOLS2) + '</tbody></table></div>'
    + labelBlock('Sub-Contractors:', '')
    + labelBlock('Visitors:', report.visitors)
    + labelBlock('Items Discussed & People Contacted:', report.items_discussed)
    + '<div style="border:1px solid #000;margin-bottom:8px"><div style="background:#d8d8d8;padding:4px 6px;font-weight:bold;border-bottom:1px solid #000;font-size:11px">Work Observed:</div><div style="padding:6px 8px;min-height:40px">' + activityRows() + '</div></div>'
    + '<div style="border:1px solid #000;margin-bottom:8px"><div style="background:#d8d8d8;padding:4px 6px;font-weight:bold;border-bottom:1px solid #000;font-size:11px">Quantity Installed -- IDIQ:</div>'
    + '<table style="width:100%"><thead><tr style="background:#f0f0f0"><th style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #000;width:10%;text-align:left;font-size:9px">Item No.</th><th style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #000;width:40%;text-align:left;font-size:9px">Description</th><th style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #000;width:15%;text-align:left;font-size:9px">Quantity</th><th style="padding:2px 4px;border-right:1px solid #000;border-bottom:1px solid #000;width:10%;text-align:left;font-size:9px">Unit</th><th style="padding:2px 4px;border-bottom:1px solid #000;text-align:left;font-size:9px">Sheet/STA/Note</th></tr></thead>'
    + '<tbody>' + qtyRows() + '</tbody></table></div>'
    + labelBlock('Materials Delivered:', delivered.map(function(m) { return m.material_type + ' -- ' + m.quantity + ' ' + m.unit }).join(', '))
    + labelBlock('Testing:', '')
    + labelBlock('RFI:', '')
    + labelBlock('Nonconforming Work:', '')
    + labelBlock('Remarks:', report.remarks)
    + photoHtml()
    + '<table style="width:100%;border:1px solid #000;margin-bottom:4px"><tbody>'
    + '<tr><td style="padding:4px 6px;width:70%;border-right:1px solid #000">Signed by: ' + signedBy + sigImgTag + '</td><td style="padding:4px 6px">Date: ' + reportDate + '</td></tr>'
    + '<tr><td colspan="2" style="padding:4px 6px;border-top:1px solid #000">Copies: [X] File &nbsp;&nbsp; [X] Owner &nbsp;&nbsp; [ ] Other</td></tr>'
    + '</tbody></table>'
    + '</body></html>'

    var browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    var page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await new Promise(function(r) { setTimeout(r, 3000) })
    var pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } })
    await browser.close()

    var fileName = report.project_id + '/' + String(report.report_number).padStart(3, '0') + '.pdf'
    var uploadResult = await supabaseAdmin.storage.from('reports').upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (uploadResult.error) { return Response.json({ error: uploadResult.error.message }, { status: 500 }) }

    var urlResult = supabaseAdmin.storage.from('reports').getPublicUrl(fileName)
    var pdfUrl = urlResult.data.publicUrl

    await supabaseAdmin.from('daily_reports').update({ pdf_url: pdfUrl, status: 'completed' }).eq('id', reportId)

    return Response.json({ url: pdfUrl })
  } catch (err) {
    console.error('PDF generation error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
