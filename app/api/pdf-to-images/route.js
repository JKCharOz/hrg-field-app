import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    var body = await req.json()
    var pdfUrl = body.url
    var page_num = body.page || 1

    if (!pdfUrl) return NextResponse.json({ error: 'No URL' }, { status: 400 })

    var browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1600, height: 1200 },
      executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
      headless: chromium.headless,
    })

    var pg = await browser.newPage()

    // Use PDF.js via a data URL to render the PDF page
    var html = '<!DOCTYPE html><html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script></head><body style="margin:0;background:#fff;"><canvas id="c"></canvas><script>'
      + 'pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";'
      + 'async function render(){'
      + 'var pdf=await pdfjsLib.getDocument("' + pdfUrl + '").promise;'
      + 'document.title=String(pdf.numPages);'
      + 'var p=await pdf.getPage(' + page_num + ');'
      + 'var vp=p.getViewport({scale:2});'
      + 'var c=document.getElementById("c");'
      + 'c.width=vp.width;c.height=vp.height;'
      + 'await p.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;'
      + 'document.title="done_"+pdf.numPages;'
      + '} render();'
      + '</script></body></html>'

    await pg.setContent(html, { waitUntil: 'domcontentloaded' })

    // Wait for rendering to complete
    await pg.waitForFunction('document.title.startsWith("done_")', { timeout: 15000 })

    var titleVal = await pg.title()
    var numPages = parseInt(titleVal.split('_')[1]) || 1

    var screenshot = await pg.screenshot({ type: 'png', fullPage: true })
    await browser.close()

    var base64 = Buffer.from(screenshot).toString('base64')
    return NextResponse.json({ image: 'data:image/png;base64,' + base64, numPages: numPages })
  } catch (err) {
    console.error('pdf-to-images error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
