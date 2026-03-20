'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

var SKY_OPTIONS = ['Clear', 'Cloudy', 'Rain', 'Snow', 'Fog']
var SITE_OPTIONS = ['Dry', 'Wet', 'Muddy', 'Snow Covered', 'Frozen']
var WORK_PERIOD_OPTIONS = ['Day Work', 'Night Work']

export function DailyConditions(props) {
var report = props.report
var onUpdate = props.onUpdate

var [open, setOpen] = useState(false)
var [localValues, setLocalValues] = useState({
sky: [],
temperature: '',
wind: [],
work_period: null,
re: '',
})

useEffect(function() {
if (report) {
setLocalValues({
sky: report.weather_conditions ? String(report.weather_conditions).split(',') : [],
temperature: report.weather_temp || '',
wind: report.site_conditions ? String(report.site_conditions).split(',') : [],
work_period: report.work_period || null,
re: report.re || '',
})
}
}, [report && report.id])

async function toggleMulti(field, dbField, value) {
var current = localValues[field] || []
var next = current.includes(value)
? current.filter(function(v) { return v !== value })
: current.concat([value])
setLocalValues(function(prev) {
var updated = Object.assign({}, prev)
updated[field] = next
return updated
})
if (!report || !report.id) return
var payload = {}
payload[dbField] = next.length > 0 ? next.join(',') : null
var result = await supabase.from('daily_reports').update(payload).eq('id', report.id).select().single()
if (!result.error && result.data) { onUpdate(result.data) }
}

async function toggleSingle(field, dbField, value) {
var current = localValues[field]
var next = current === value ? null : value
setLocalValues(function(prev) {
var updated = Object.assign({}, prev)
updated[field] = next
return updated
})
if (!report || !report.id) return
var payload = {}
payload[dbField] = next
var result = await supabase.from('daily_reports').update(payload).eq('id', report.id).select().single()
if (!result.error && result.data) { onUpdate(result.data) }
}

async function saveRe(value) {
setLocalValues(function(prev) { return Object.assign({}, prev, { re: value }) })
if (!report || !report.id) return
var result = await supabase.from('daily_reports').update({ re: value }).eq('id', report.id).select().single()
if (!result.error && result.data) { onUpdate(result.data) }
}

async function saveTempText(value) {
setLocalValues(function(prev) { return Object.assign({}, prev, { temperature: value }) })
if (!report || !report.id) return
var result = await supabase.from('daily_reports').update({ weather_temp: value }).eq('id', report.id).select().single()
if (!result.error && result.data) { onUpdate(result.data) }
}

var parts = []
if (localValues.sky && localValues.sky.length > 0) parts.push(localValues.sky.join(', '))
if (localValues.temperature) parts.push(localValues.temperature)
if (localValues.wind && localValues.wind.length > 0) parts.push(localValues.wind.join(', '))
if (localValues.work_period) parts.push(localValues.work_period)
var summary = parts.join(' / ')

function MultiChips(chipProps) {
return (
<div className="flex flex-wrap gap-2">
{chipProps.options.map(function(val) {
var active = (localValues[chipProps.field] || []).includes(val)
return (
<button key={val} onClick={function() { toggleMulti(chipProps.field, chipProps.dbField, val) }}
className={'px-3 py-1.5 rounded-lg border text-sm transition-colors ' +
(active ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-slate-600 bg-slate-700/40 text-slate-300 active:bg-slate-600')}>
{val}
</button>
)
})}
</div>
)
}

function SingleChips(chipProps) {
return (
<div className="flex flex-wrap gap-2">
{chipProps.options.map(function(val) {
var active = localValues[chipProps.field] === val
return (
<button key={val} onClick={function() { toggleSingle(chipProps.field, chipProps.dbField, val) }}
className={'px-3 py-1.5 rounded-lg border text-sm transition-colors ' +
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
style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} className="text-slate-500">
<polyline points="6 9 12 15 18 9" />
</svg>
</button>
{open && (
<div className="border-t border-slate-700 px-4 pb-4 space-y-4">
<div className="pt-3">
<p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Weather</p>
<MultiChips options={SKY_OPTIONS} field="sky" dbField="weather_conditions" />
</div>
<div>
<p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Temperature</p>
<input
type="text"
value={localValues.temperature}
onChange={function(e) { saveTempText(e.target.value) }}
placeholder="e.g. 68F"
className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
/>
</div>
<div>
<p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Site Conditions</p>
<MultiChips options={SITE_OPTIONS} field="wind" dbField="site_conditions" />
</div>
<div>
<p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Work Period</p>
<SingleChips options={WORK_PERIOD_OPTIONS} field="work_period" dbField="work_period" />
</div>
</div>
)}
</div>
)
}