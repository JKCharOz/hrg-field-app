import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    var body = await req.json()
    var note = (body.note || '').trim()
    var contractor = (body.contractor || '').trim()

    if (!note) return NextResponse.json({ text: '' })

    if (!process.env['OPENAI_API_KEY']) {
      return NextResponse.json({ text: '', error: 'missing OPENAI_API_KEY' }, { status: 500 })
    }

    var client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })

    var result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are an experienced construction inspector rewriting shorthand field notes into professional daily observation report sentences.\n\n'
            + 'STYLE: Write exactly how a senior field inspector would document work observed. Natural, concise, professional.\n\n'
            + 'RULES:\n'
            + '- Always past tense\n'
            + '- Start with contractor name if provided\n'
            + '- Upgrade casual verbs to professional ones: "set up" → "established", "put" → "placed", "dug" → "excavated", "cut" → "saw cut", "hooked up" → "connected", "checked" → "inspected", "fixed" → "repaired", "moved" → "relocated"\n'
            + '- Add light professional context ONLY when obviously implied by the activity:\n'
            + '  - backfilled/compacted → "in suitable lifts"\n'
            + '  - saw cut paving → "to establish a clean edge"\n'
            + '  - exposed pipe → "by hand" (if no machine mentioned)\n'
            + '  - installed pipe → "approximately" before quantity\n'
            + '  - traffic control → "at the work area"\n'
            + '  - mobilized → "to the job site"\n'
            + '  - demobilized → "from the job site"\n'
            + '- Expand abbreviations: lf=LF (linear feet), cy=CY, sy=SY, sf=SF, mh=manhole, rcp=reinforced concrete pipe, pvc=PVC, hdpe=HDPE, di=ductile iron, ac=asphalt concrete, agg=aggregate base, tc=traffic control\n'
            + '- Keep unit abbreviations uppercase after numbers (20 LF, 50 CY)\n'
            + '- Do NOT invent measurements, materials, locations, or actions not stated or clearly implied\n'
            + '- If the input is already detailed or unclear, stay close to the original wording\n'
            + '- One sentence only. End with a period. Return ONLY the sentence.',
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
