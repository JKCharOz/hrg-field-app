import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    var supabaseAdmin = createClient(
      'https://jwksvwyoyxrakaagcxyk.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3a3N2d3lveXhyYWthYWdjeHlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyMjk4NCwiZXhwIjoyMDg4OTk4OTg0fQ.n1xjNrR2SXydg26YbKCfzvPXCM926xr--IOeXtGprFQ'
    )
    var { reportId } = await req.json()
    if (!reportId) { return Response.json({ error: 'No reportId' }, { status: 400 }) }

    var repResult = await supabaseAdmin.from('daily_reports').select('*').eq('id', reportId).single()
    console.log('repResult error:', repResult.error)
    console.log('repResult data:', repResult.data ? 'found' : 'null')
    console.log('reportId:', reportId)
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (repResult.error || !repResult.data) { return Response.json({ error: repResult.error ? JSON.stringify(repResult.error) : 'Report not found - id: ' + reportId + ' key: ' + (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'MISSING') + ' url: ' + (process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING') }, { status: 404 }) }
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
    + '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACKCAYAAAAQT3cyAAAAAXNSR0IArs4c6QAAAIRlWElmTU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAASygAwAEAAAAAQAAAIoAAAAAH2FWdwAAAAlwSFlzAAALEwAACxMBAJqcGAAAABxpRE9UAAAAAgAAAAAAAABFAAAAKAAAAEUAAABFAAAMf/r8jL0AAAxLSURBVHgB7J17cB1VHcdvWh+5rwIttVLa7N4kY7EpCnZQK23c3dsmrQrjK+L46LR/+Id/6BSlhTiOBnVAbVoc1FEZkIkdtFZtEhV8jTySKKIoIEMHn0VUULEqD1uIaPz+9pHc3OzN3bN39969yTczZ/bevbtnz/nsOd+c8zu/c04qxT8SIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESIAESWIgElq3pXZ5vNzZn2o3XqYS0br4itfqiTBKYZAvFVSpp967NF4pbUhs3PtcvD2ndeGVWt3ZnCta7VILck9asN3jPyGnmG737cwXzLd75oEfkbVu6YL0812Z2pTu617rMW/zS3PTnOnc8P91prMlp3S/OtJkbJWQLVk8pK/me1oqb5De5Lr3GOju1qifb9HlnBoIRyLQXL8jp5khWN48rhiG7AgV7TKxXZdvMomLanbxq1rdO143T/RKXLZgHEOe/EaYUwySu/zOCx/PRkvv/XnLe+73K0TqW0czxrG7cgntvctJl7RFRhJi9ZHnnjmV+6W+Gc2e0bz0N+TovVzDejLxdCrH/eFYzv5TFe8H3293wII6ljB5Eeb3T/q1g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" style="height:40px;object-fit:contain" />'
    + '<p style="font-weight:bold;font-size:13px;margin:0">DAILY OBSERVATION REPORT</p></div>'
    + '<table style="width:100%;margin-bottom:8px;border:1px solid #000;table-layout:fixed"><tbody>'
    + '<tr><td style="font-weight:bold;width:18%;padding:3px 6px;border-bottom:1px solid #ccc">Project:</td><td style="width:32%;padding:3px 6px;border-bottom:1px solid #ccc;border-right:1px solid #000">' + na(project.project_name) + '</td><td style="font-weight:bold;width:18%;padding:3px 6px;border-bottom:1px solid #ccc">Report No:</td><td style="width:32%;padding:3px 6px;border-bottom:1px solid #ccc">' + na(report.report_number) + '</td></tr>'
    + '<tr><td style="font-weight:bold;padding:3px 6px;border-bottom:1px solid #ccc">Owner:</td><td style="padding:3px 6px;border-bottom:1px solid #ccc;border-right:1px solid #000">' + na(project.owner) + '</td><td style="font-weight:bold;padding:3px 6px;border-bottom:1px solid #ccc">HRG Project No:</td><td style="padding:3px 6px;border-bottom:1px solid #ccc">' + na(project.project_number) + '</td></tr>'
    + '<tr><td style="font-weight:bold;padding:3px 6px">Re:</td><td style="padding:3px 6px;border-right:1px solid #000">' + na(report.re) + '</td><td style="font-weight:bold;padding:3px 6px">Date:</td><td style="padding:3px 6px">' + reportDate + '</td></tr>'
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

    var browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
      headless: chromium.headless,
    })
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
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
