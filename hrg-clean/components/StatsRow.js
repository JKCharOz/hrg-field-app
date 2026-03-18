'use client'

export function StatsRow(props) {
  var counts = props.counts || {}
  var stats = [
    { label: 'Photos', value: counts.photos || 0 },
    { label: 'Delivered', value: counts.materialsDelivered || 0 },
    { label: 'Installed', value: counts.quantityInstalled || 0 },
    { label: 'Equipment', value: counts.equipment || 0 },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 px-4">
      {stats.map(function(s) {
        return (
          <div key={s.label} className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-xl py-3">
            <span className={(s.value > 0 ? 'text-orange-400' : 'text-slate-600') + ' text-xl font-bold font-mono leading-none'}>{s.value}</span>
            <span className="text-slate-500 uppercase tracking-wide mt-0.5 text-center leading-tight" style={{ fontSize: '10px' }}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
