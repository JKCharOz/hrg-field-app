'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

var SKY_OPTIONS = ['Clear','Partly Cloudy','Cloudy','Rain','Heavy Rain','Snow','Fog']
var TEMP_OPTIONS = ['Below 32F','32-45F','46-60F','61-75F','76-85F','Above 85F']
var WIND_OPTIONS = ['Calm','Light','Moderate','Strong','Gusts']

export function DailyConditions(props) {
  var report = props.report
  var onUpdate = props.onUpdate
  var [open, setOpen] = useState(false)
  var [busy, setBusy] = useState(false)

  async function saveField(field, value) {
    if (!report || !report.id) return
    setBusy(true)
    var payload = {}
    payload[field] = value
    payload.updated_at = new Date().toISOString()
    var result = await supabase.from('daily_reports').update(payload).eq('id', report.id).select().single()
    setBusy(false)
    if (!result.error && result.data) { onUpdate(result.data) }
  }

  function toggle(field, value) {
    var current = report ? report[field] : null
    saveField(field, current === value ? null : value)
  }

  var parts = []
  if (report && report.sky) parts.push(report.sky)
  if (report && report.temperature) parts.push(report.temperature)
  if (report && report.wind) parts.push(report.wind)
  var summary = parts.join(' / ')

  function Chips(chipProps) {
    return (
      <div className="flex flex-wrap gap-2">
        {chipProps.options.map(function(val) {
          var active = report && report[chipProps.field] === val
          return (
            <button key={val} onClick={function() { toggle(chipProps.field, val) }} disabled={busy}
              className={'px-3 py-1.5 rounded-lg border text-sm transition-colors disabled:opacity-50 ' +
                (active ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-slate-600 bg-slate-700/40 text-slate-300 active:bg-slate-600')}>
              {val}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mx-4 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
      <button onClick={function() { setOpen(function(o) { return !o }) }}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-700/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex-shrink-0">Daily Conditions</span>
          {summary
            ? <span className="text-slate-400 text-xs truncate">/ {summary}</span>
            : <span className="text-slate-600 text-xs">Tap to set</span>}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          className="text-slate-500">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-700 px-4 pb-4 space-y-4">
          <div className="pt-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Weather</p>
            <Chips options={SKY_OPTIONS} field="sky" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Temperature</p>
            <Chips options={TEMP_OPTIONS} field="temperature" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Wind</p>
            <Chips options={WIND_OPTIONS} field="wind" />
          </div>
        </div>
      )}
    </div>
  )
}
