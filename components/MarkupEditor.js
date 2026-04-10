'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function MarkupEditor(props) {
  var imageUrl = props.imageUrl
  var project = props.project
  var originalName = props.originalName || 'markup'
  var onClose = props.onClose
  var onSaved = props.onSaved

  var canvasRef = useRef(null)
  var containerRef = useRef(null)
  var [tool, setTool] = useState('draw')
  var [color, setColor] = useState('#22c55e')
  var [lineWidth, setLineWidth] = useState(3)
  var [drawing, setDrawing] = useState(false)
  var [imgLoaded, setImgLoaded] = useState(false)
  var [saving, setSaving] = useState(false)
  var [textMode, setTextMode] = useState(false)
  var [textInput, setTextInput] = useState('')
  var [textPos, setTextPos] = useState(null)
  var [history, setHistory] = useState([])
  var imgRef = useRef(null)
  var scaleRef = useRef(1)

  useEffect(function() {
    var img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = function() {
      imgRef.current = img
      setupCanvas(img)
      setImgLoaded(true)
    }
    img.onerror = function() { alert('Failed to load image') }
    img.src = imageUrl
  }, [imageUrl])

  function setupCanvas(img) {
    var canvas = canvasRef.current
    if (!canvas) return
    var container = containerRef.current
    var maxW = container ? container.clientWidth : window.innerWidth
    var maxH = window.innerHeight - 160
    var scale = Math.min(maxW / img.width, maxH / img.height, 1)
    scaleRef.current = scale
    canvas.width = img.width
    canvas.height = img.height
    canvas.style.width = Math.floor(img.width * scale) + 'px'
    canvas.style.height = Math.floor(img.height * scale) + 'px'
    var ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    saveHistory()
  }

  function saveHistory() {
    var canvas = canvasRef.current
    if (!canvas) return
    var data = canvas.toDataURL()
    setHistory(function(prev) { return prev.concat([data]) })
  }

  function undo() {
    if (history.length < 2) return
    var newHistory = history.slice(0, -1)
    var lastData = newHistory[newHistory.length - 1]
    setHistory(newHistory)
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    var img = new Image()
    img.onload = function() { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height) }
    img.src = lastData
  }

  function getPos(e) {
    var canvas = canvasRef.current
    var rect = canvas.getBoundingClientRect()
    var touch = e.touches ? e.touches[0] : e
    var x = (touch.clientX - rect.left) / scaleRef.current
    var y = (touch.clientY - rect.top) / scaleRef.current
    return { x: x, y: y }
  }

  function handleStart(e) {
    e.preventDefault()
    var pos = getPos(e)
    if (tool === 'text') {
      setTextPos(pos)
      setTextMode(true)
      return
    }
    setDrawing(true)
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth / scaleRef.current
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function handleMove(e) {
    if (!drawing) return
    e.preventDefault()
    var pos = getPos(e)
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function handleEnd(e) {
    if (!drawing) return
    setDrawing(false)
    saveHistory()
  }

  function placeText() {
    if (!textInput.trim() || !textPos) return
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    var fontSize = Math.max(14, 18 / scaleRef.current)
    ctx.font = 'bold ' + fontSize + 'px Arial'
    ctx.fillStyle = color
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.strokeText(textInput.trim(), textPos.x, textPos.y)
    ctx.fillText(textInput.trim(), textPos.x, textPos.y)
    setTextInput('')
    setTextMode(false)
    setTextPos(null)
    saveHistory()
  }

  async function handleSave() {
    setSaving(true)
    try {
      var canvas = canvasRef.current
      var blob = await new Promise(function(resolve) { canvas.toBlob(resolve, 'image/png') })
      var fileName = project.id + '/docs/markup-' + Date.now() + '.png'
      var upload = await supabase.storage.from('field-photos').upload(fileName, blob, { contentType: 'image/png', upsert: false })
      if (upload.error) { alert('Upload failed: ' + upload.error.message); setSaving(false); return }
      var insert = await supabase.from('project_documents').insert({
        project_id: project.id,
        org_id: project.org_id,
        file_name: 'Markup - ' + originalName,
        storage_path: fileName,
        file_type: 'png',
        folder: 'Plans',
      }).select().single()
      if (!insert.error) {
        if (onSaved) { onSaved(insert.data) }
      }
      onClose()
    } catch (err) {
      alert('Save failed: ' + err.message)
    }
    setSaving(false)
  }

  var COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#ffffff', '#000000']

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <button onClick={onClose} className="text-slate-400 text-sm active:text-white">Cancel</button>
        <p className="text-white text-sm font-semibold">Markup</p>
        <button onClick={handleSave} disabled={saving}
          className="text-orange-400 text-sm font-semibold active:text-orange-300 disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 p-2"
        style={{ touchAction: 'none' }}>
        {!imgLoaded && <p className="text-slate-500 text-sm">Loading image...</p>}
        <canvas ref={canvasRef}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          style={{ display: imgLoaded ? 'block' : 'none', touchAction: 'none' }}
        />
      </div>

      {textMode && (
        <div className="absolute inset-x-0 bottom-20 px-4 z-20">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex gap-2">
            <input type="text" value={textInput} onChange={function(e) { setTextInput(e.target.value) }}
              placeholder="Type label..."
              autoFocus
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            <button onClick={placeText} disabled={!textInput.trim()}
              className="bg-orange-500 text-white font-bold px-4 rounded-lg text-sm active:bg-orange-600 disabled:opacity-40">Place</button>
            <button onClick={function() { setTextMode(false); setTextPos(null) }}
              className="text-slate-400 text-sm px-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button onClick={function() { setTool('draw') }}
              className={'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (tool === 'draw' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-slate-500 border border-slate-700')}>
              Draw
            </button>
            <button onClick={function() { setTool('text') }}
              className={'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (tool === 'text' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-slate-500 border border-slate-700')}>
              Text
            </button>
          </div>
          <button onClick={undo} disabled={history.length < 2}
            className="text-slate-500 text-xs px-3 py-1.5 border border-slate-700 rounded-lg active:bg-slate-800 disabled:opacity-30">
            Undo
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {COLORS.map(function(c) {
              return (
                <button key={c} onClick={function() { setColor(c) }}
                  className={'w-7 h-7 rounded-full border-2 ' + (color === c ? 'border-white' : 'border-slate-600')}
                  style={{ backgroundColor: c }} />
              )
            })}
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-slate-600 text-xs">Thin</span>
            <input type="range" min="1" max="8" value={lineWidth}
              onChange={function(e) { setLineWidth(parseInt(e.target.value)) }}
              className="flex-1" />
            <span className="text-slate-600 text-xs">Thick</span>
          </div>
        </div>
      </div>
    </div>
  )
}
