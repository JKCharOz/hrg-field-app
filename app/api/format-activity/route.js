import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    var body = await req.json()
    var note = (body.note || '').trim()
    var contractor = (body.contractor || '').trim()

    if (!note) return NextResponse.json({ text: '' })

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ text: '', error: 'missing GEMINI_API_KEY' }, { status: 500 })
    }

    var genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    var model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    var prompt = 'Convert this inspector field note into one clean, professional sentence for a daily construction observation report.\n\n'
      + (contractor ? 'Contractor: ' + contractor + '\n' : '')
      + 'Note: ' + note + '\n\n'
      + 'Rules:\n'
      + '- Start with the contractor name if provided\n'
      + '- Use correct construction terminology\n'
      + '- Expand abbreviations (lf=linear feet, cy=cubic yards, sy=square yards, sf=square feet, mh=manhole, rcp=reinforced concrete pipe, pvc=PVC, hdpe=HDPE, di=ductile iron, ac=asphalt concrete, agg=aggregate, rebar=rebar, tc=traffic control)\n'
      + '- Keep unit abbreviations uppercase after the number (20 LF, 50 CY)\n'
      + '- Add appropriate context only when obvious from the activity (e.g. "backfilled" implies trench, "mobilized" implies job site)\n'
      + '- Do NOT invent specific measurements, locations, or details not in the note\n'
      + '- End with a period\n'
      + '- Return ONLY the sentence, nothing else'

    var result = await model.generateContent(prompt)
    var text = result.response.text().trim()

    return NextResponse.json({ text: text })
  } catch (e) {
    console.error('format-activity error:', e.message || e)
    return NextResponse.json({ text: '', error: e.message || 'unknown error' }, { status: 500 })
  }
}
