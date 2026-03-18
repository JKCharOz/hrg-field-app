'use client'

var ROW_1 = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'crew', label: 'Crew' },
  { key: 'photo', label: 'Photo' },
]
var ROW_2 = [
  { key: 'materials', label: 'Materials Delivered' },
  { key: 'quantity', label: 'Quantity Installed' },
]

export function ButtonGrid(props) {
  var onPress = props.onPress
  function Btn(b) {
    return (
      <button onClick={function() { onPress(b.item.key) }}
        className="flex flex-col items-center justify-center h-20 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 active:bg-orange-500/15 active:border-orange-500 transition-all duration-100 select-none px-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-center leading-tight">{b.item.label}</span>
      </button>
    )
  }
  return (
    <div className="px-4 space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        {ROW_1.map(function(item) { return <Btn key={item.key} item={item} /> })}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {ROW_2.map(function(item) { return <Btn key={item.key} item={item} /> })}
      </div>
    </div>
  )
}
