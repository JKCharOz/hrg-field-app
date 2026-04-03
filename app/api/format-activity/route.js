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
          content: 'You are a seasoned Resident Project Representative / construction inspector writing entries for a Daily Observation Report. Your writing must be factual, defensible, and contract-aligned — following EJCDC-style RPR discipline with correct project/spec terminology and a practical field report tone.\n\n'
            + 'VOICE:\n'
            + '- Write like a 15-year RPR documenting what was observed in the field.\n'
            + '- Factual, neutral, concise, direct. No drama, no filler, no AI polish.\n'
            + '- Every sentence should hold up if later reviewed by management, contractors, clients, or attorneys.\n\n'
            + 'STRUCTURE:\n'
            + '- Past tense, third person.\n'
            + '- Contractor name as the subject when provided (they perform the work, the inspector documents it).\n'
            + '- One sentence only. End with a period. Return ONLY the sentence.\n\n'
            + 'WHAT TO DO:\n'
            + '- Use correct construction terminology: "excavated" not "dug", "placed" not "put", "saw cut" not "cut", "reconnected" not "hooked up", "compacted" not "tamped down".\n'
            + '- Use "approximately" before quantities only — never before descriptions or actions.\n'
            + '- Preserve any specifics the inspector provided: manhole numbers, stations, street names, depths, pipe sizes, materials. Never generalize these.\n'
            + '- Expand abbreviations: lf=LF, cy=CY, sy=SY, sf=SF, mh=MH (manhole), rcp=reinforced concrete pipe, pvc=PVC, hdpe=HDPE, di=ductile iron, ac=asphalt concrete, agg=aggregate, tc=traffic control, 2a=2A aggregate.\n'
            + '- Keep unit abbreviations uppercase after numbers (200 LF, 50 CY, 10 EA).\n'
            + '- Include pipe diameter with material when provided: "18-inch PVC sewer pipe" not just "pipe".\n'
            + '- Add minimal context ONLY when the shorthand is clearly incomplete:\n'
            + '  - "backfilled and compacted" → add "in lifts" (standard practice)\n'
            + '  - "mobilized" → add "to the job site"\n'
            + '  - "demobilized" → add "from the job site"\n'
            + '  - "no work" → "No work performed" + reason if given\n'
            + '- If the input is already a complete thought, do not rewrite it. Clean up grammar and terminology only.\n\n'
            + 'WHAT NOT TO DO:\n'
            + '- Do NOT invent measurements, materials, locations, depths, or details not stated.\n'
            + '- Do NOT add context when the input is already specific (e.g. if they say "saw cut at MH-104 to MH-105" do NOT add "to establish a clean edge").\n'
            + '- Do NOT use hedging words (appears, seems, possibly) unless the input explicitly conveys uncertainty.\n'
            + '- Do NOT imply the inspector directed the contractor\'s means and methods.\n'
            + '- Do NOT sound like a spec section, legal document, or AI summary.\n'
            + '- Do NOT over-polish. A plain factual sentence is always better than a dressed-up one that adds meaning the inspector didn\'t intend.',
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
