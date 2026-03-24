import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

var SUPABASE_URL = 'https://jwksvwyoyxrakaagcxyk.supabase.co'

async function replaceImagesWithBase64(html, supabaseAdmin) {
  var imgRegex = /<img([^>]*)src="([^"]+)"([^>]*)>/g
  var matches = []
  var match
  while ((match = imgRegex.exec(html)) !== null) {
    matches.push({ full: match[0], before: match[1], url: match[2], after: match[3] })
  }

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i]
    if (m.url.startsWith('data:')) continue
    var b64 = null

    try {
      if (m.url === '/hrg-logo.png' || m.url.includes('hrg-logo.png')) {
        var logoPath = path.join(process.cwd(), 'public', 'hrg-logo.png')
        var logoBuf = fs.readFileSync(logoPath)
        b64 = 'data:image/png;base64,' + logoBuf.toString('base64')
      } else if (m.url.includes('/storage/v1/object/public/field-photos/')) {
        var storagePath = m.url.split('/field-photos/')[1]
        if (storagePath) {
          var dl = await supabaseAdmin.storage.from('field-photos').download(storagePath)
          if (!dl.error && dl.data) {
            var buf = Buffer.from(await dl.data.arrayBuffer())
            var ext = storagePath.split('.').pop().toLowerCase()
            var mime = ext === 'png' ? 'image/png' : 'image/jpeg'
            b64 = 'data:' + mime + ';base64,' + buf.toString('base64')
          }
        }
      } else {
        var res = await fetch(m.url)
        if (res.ok) {
          var buf2 = Buffer.from(await res.arrayBuffer())
          var ct = res.headers.get('content-type') || 'image/png'
          b64 = 'data:' + ct + ';base64,' + buf2.toString('base64')
        }
      }
    } catch(e) {}

    if (b64) {
      html = html.replace(m.full, '<img' + m.before + 'src="' + b64 + '"' + m.after + '>')
    }
  }
  return html
}

export async function POST(req) {
  try {
    var supabaseAdmin = createClient(
      SUPABASE_URL,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3a3N2d3lveXhyYWthYWdjeHlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyMjk4NCwiZXhwIjoyMDg4OTk4OTg0fQ.n1xjNrR2SXydg26YbKCfzvPXCM926xr--IOeXtGprFQ'
    )
    var body = await req.json()
    var reportId = body.reportId
    var clientHtml = body.html
    if (!reportId) { return Response.json({ error: 'No reportId' }, { status: 400 }) }
    if (!clientHtml) { return Response.json({ error: 'No HTML provided' }, { status: 400 }) }

    var repResult = await supabaseAdmin.from('daily_reports').select('*').eq('id', reportId).single()
    if (repResult.error || !repResult.data) { return Response.json({ error: 'Report not found' }, { status: 404 }) }
    var report = repResult.data

    var processedHtml = await replaceImagesWithBase64(clientHtml, supabaseAdmin)

    var fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:10px;color:#000;margin:0;padding:16px}table{border-collapse:collapse}*{box-sizing:border-box}p{margin:2px 0}img{max-width:100%}</style></head><body>' + processedHtml + '</body></html>'

    var browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
      headless: chromium.headless,
    })
    var page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' })
    var pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } })
    await browser.close()

    var fileName = report.project_id + '/' + String(report.report_number).padStart(3, '0') + '-' + Date.now() + '.pdf'
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
