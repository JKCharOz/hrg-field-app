'use client'
// components/StatsRow.js
// Displays four summary counts derived from the correct source tables:
//   Photos            → field_photos
//   Materials Deliv.  → materials where is_delivery = true
//   Qty Installed     → materials where is_delivery = false
//   Equipment         → equipment_logs

export function StatsRow({ counts = {} }) {
const stats = [
{ label: 'Photos',     value: counts.photos              ?? 0, emoji: '📷' },
{ label: 'Delivered',  value: counts.materialsDelivered  ?? 0, emoji: '📦' },
{ label: 'Installed',  value: counts.quantityInstalled   ?? 0, emoji: '📏' },
{ label: 'Equipment',  value: counts.equipment           ?? 0, emoji: '🚜' },
]

return (
<div className="grid grid-cols-4 gap-2 px-4">
{stats.map(s => (
<div
key={s.label}
className="flex flex-col items-center bg-slate-800 border border-slate-700 rounded-xl py-3"
>
<span className="text-lg leading-none mb-0.5">{s.emoji}</span>
<span className={`text-xl font-bold font-mono leading-none ${s.value > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
{s.value}
</span>
<span className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5 text-center leading-tight">
{s.label}
</span>
</div>
))}
</div>
)
}
