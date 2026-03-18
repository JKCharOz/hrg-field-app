'use client'
import Link from 'next/link'

export function HeaderSection(props) {
  var report = props.report
  var project = props.project
  var backHref = props.backHref || '/projects'
  var dateLabel = ''
  if (report && report.report_date) {
    dateLabel = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  }
  var status = (report && report.status) ? report.status : 'in_progress'
  var statusLabel = status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'
  var statusClass = status === 'completed'
    ? 'bg-emerald-900/60 text-emerald-300'
    : 'bg-slate-700 text-slate-400'
  var projectName = (project && project.project_name) ? project.project_name : ''
  var inspectorId = (report && report.inspector_id) ? report.inspector_id : ''
  return (
    <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <Link href={backHref} className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest leading-none mb-0.5">
            Daily Observation Report
          </p>
          <h1 className="text-white font-bold text-base leading-tight truncate">{projectName}</h1>
        </div>
        <span className={'flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full ' + statusClass}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 pb-2.5">
        <span className="text-slate-500 text-xs">{dateLabel}</span>
        <span className="text-slate-500 text-xs">{inspectorId ? 'Inspector: ' + inspectorId : ''}</span>
      </div>
    </div>
  )
}
