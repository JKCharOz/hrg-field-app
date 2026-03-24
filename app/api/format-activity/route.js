import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    var body = await req.json()
    var note = (body.note || '').trim()
    var contractor = (body.contractor || '').trim()

    if (!note) return NextResponse.json({ text: '' })

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ text: '', error: 'missing OPENAI_API_KEY' }, { status: 500 })
    }

    var client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    var result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You convert shorthand construction inspector field notes into one clean, professional sentence for a daily observation report. Rules: Start with the contractor name if provided. Use correct construction terminology. Expand abbreviations (lf=linear feet, cy=cubic yards, sy=square yards, sf=square feet, mh=manhole, rcp=reinforced concrete pipe, pvc=PVC, hdpe=HDPE, di=ductile iron, ac=asphalt concrete, agg=aggregate, tc=traffic control). Keep unit abbreviations uppercase after numbers (20 LF, 50 CY). Add appropriate context only when obvious from the activity (e.g. "backfilled" implies trench, "mobilized" implies job site). Do NOT invent specific measurements, locations, or details not in the note. End with a period. Return ONLY the sentence.',
        },
        {
          role: 'user',
          content: (contractor ? 'Contractor: ' + contractor + '\n' : '') + 'Note: ' + note,
        },
      ],
    })

    var text = result.choices[0].message.content.trim()
    return NextResponse.json({ text: text })
  } catch (e) {
    console.error('format-activity error:', e.message || e)
    return NextResponse.json({ text: '', error: e.message || 'unknown error' }, { status: 500 })
  }
}
