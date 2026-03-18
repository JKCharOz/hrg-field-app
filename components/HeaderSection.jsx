'use client'
// components/HeaderSection.js
// Top bar: screen title, session date, inspector name, report status, back nav.

import Link from 'next/link'

export function HeaderSection({ report, project, backHref = '/' }) {
const dateLabel = report?.report_date
? new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', {
weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
})
: '—'

const STATUS_STYLES = {
draft:    'bg-slate-700 text-slate-400',
complete: 'bg-blue-900/60 text-blue-300',
exported: 'bg-emerald-900/60 text-emerald-300',
}
const status = report?.status ?? 'draft'

return (
<div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">

  {/* Row 1: back + title + status badge */}
  <div className="flex items-center gap-3 px-4 pt-3 pb-2">
    <Link
      href={backHref}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800
        text-slate-300 active:bg-slate-700 flex-shrink-0"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Link>

    <div className="min-w-0 flex-1">
      <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest leading-none mb-0.5">
        Daily Observation Report
      </p>
      <h1 className="text-white font-bold text-base leading-tight truncate">
        {project?.name ?? '—'}
      </h1>
    </div>

    <span className={`flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
      {status.toUpperCase()}
    </span>
  </div>

  {/* Row 2: date + inspector */}
  <div className="flex items-center justify-between px-4 pb-2.5">
    <span className="text-slate-500 text-xs">{dateLabel}</span>
    <span className="text-slate-500 text-xs">Inspector: {report?.inspector ?? '—'}</span>
  </div>

</div>

)
}
