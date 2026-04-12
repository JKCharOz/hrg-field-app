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
  var overlayRef = useRef(null)
  var containerRef = useRef(null)
  var [tool, setTool] = useState('pan')
  var [color, setColor] = useState('#22c55e')
  var [lineWidth, setLineWidth] = useState(3)
  var [opacity, setOpacity] = useState(1)
  var [imgLoaded, setImgLoaded] = useState(false)
  var [saving, setSaving] = useState(false)
  var [textMode, setTextMode] = useState(false)
  var [textInput, setTextInput] = useState('')
  var [textPos, setTextPos] = useState(null)
  var [history, setHistory] = useState([])
  var [showTools, setShowTools] = useState(true)
  var imgRef = useRef(null)

  // Pan/zoom state
  var [viewScale, setViewScale] = useState(1)
  var [viewOffset, setViewOffset] = useState({ x: 0, y: 0 })
  var panStart = useRef(null)
  var pinchStart = useRef(null)
  var baseScale = useRef(1)

  // Shape drawing state
  var drawStart = useRef(null)
  var drawingActive = useRef(false)

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
    canvas.width = img.width
    canvas.height = img.height
    var ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    // Fit to screen
    var container = containerRef.current
    var maxW = container ? container.clientWidth - 16 : window.innerWidth - 16
    var maxH = window.innerHeight - 200
    var fitScale = Math.min(maxW / img.width, maxH / img.height, 1)
    setViewScale(fitScale)
    setViewOffset({ x: 0, y: 0 })
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

  function canvasStyle() {
    return {
      display: imgLoaded ? 'block' : 'none',
      transformOrigin: '0 0',
      transform: 'translate(' + viewOffset.x + 'px,' + viewOffset.y + 'px) scale(' + viewScale + ')',
      touchAction: 'none',
    }
  }

  function getCanvasPos(clientX, clientY) {
    var canvas = canvasRef.current
    var container = containerRef.current
    if (!canvas || !container) return { x: 0, y: 0 }
    var rect = container.getBoundingClientRect()
    var x = (clientX - rect.left - viewOffset.x) / viewScale
    var y = (clientY - rect.top - viewOffset.y) / viewScale
    return { x: x, y: y }
  }

  function getCtx() {
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.lineWidth = lineWidth / viewScale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    return ctx
  }

  function restoreCtx(ctx) {
    ctx.globalAlpha = 1
  }

  // Overlay canvas for shape preview (line, arrow, rect, circle)
  function clearOverlay() {
    var ov = overlayRef.current
    if (!ov) return
    var ctx = ov.getContext('2d')
    ctx.clearRect(0, 0, ov.width, ov.height)
  }

  function drawShapePreview(startPos, endPos) {
    var ov = overlayRef.current
    if (!ov) return
    var ctx = ov.getContext('2d')
    ctx.clearRect(0, 0, ov.width, ov.height)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.lineWidth = lineWidth / viewScale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (tool === 'line') {
      ctx.beginPath()
      ctx.moveTo(startPos.x, startPos.y)
      ctx.lineTo(endPos.x, endPos.y)
      ctx.stroke()
    } else if (tool === 'arrow') {
      drawArrowOnCtx(ctx, startPos, endPos)
    } else if (tool === 'rect') {
      ctx.beginPath()
      ctx.rect(startPos.x, startPos.y, endPos.x - startPos.x, endPos.y - startPos.y)
      ctx.stroke()
    } else if (tool === 'circle') {
      var rx = Math.abs(endPos.x - startPos.x) / 2
      var ry = Math.abs(endPos.y - startPos.y) / 2
      var cx = (startPos.x + endPos.x) / 2
      var cy = (startPos.y + endPos.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawArrowOnCtx(ctx, from, to) {
    var headLen = Math.max(15, 20 / viewScale)
    var dx = to.x - from.x
    var dy = to.y - from.y
    var angle = Math.atan2(dy, dx)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  }

  function commitShape(startPos, endPos) {
    var ctx = getCtx()
    if (tool === 'line') {
      ctx.beginPath()
      ctx.moveTo(startPos.x, startPos.y)
      ctx.lineTo(endPos.x, endPos.y)
      ctx.stroke()
    } else if (tool === 'arrow') {
      drawArrowOnCtx(ctx, startPos, endPos)
    } else if (tool === 'rect') {
      ctx.beginPath()
      ctx.rect(startPos.x, startPos.y, endPos.x - startPos.x, endPos.y - startPos.y)
      ctx.stroke()
    } else if (tool === 'circle') {
      var rx = Math.abs(endPos.x - startPos.x) / 2
      var ry = Math.abs(endPos.y - startPos.y) / 2
      var cx = (startPos.x + endPos.x) / 2
      var cy = (startPos.y + endPos.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    restoreCtx(ctx)
    clearOverlay()
    saveHistory()
  }

  // Touch/mouse handlers
  function handleStart(e) {
    if (tool === 'pan') {
      if (e.touches && e.touches.length === 2) {
        var t1 = e.touches[0], t2 = e.touches[1]
        var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        pinchStart.current = dist
        baseScale.current = viewScale
        return
      }
      var touch = e.touches ? e.touches[0] : e
      panStart.current = { x: touch.clientX - viewOffset.x, y: touch.clientY - viewOffset.y }
      return
    }
    e.preventDefault()
    var pos = getCanvasPos(e.touches ? e.touches[0].clientX : e.clientX, e.touches ? e.touches[0].clientY : e.clientY)

    if (tool === 'text') {
      setTextPos(pos)
      setTextMode(true)
      return
    }

    if (tool === 'eraser') {
      drawingActive.current = true
      var ctx = canvasRef.current.getContext('2d')
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineWidth = (lineWidth * 3) / viewScale
      ctx.lineCap = 'round'
      return
    }

    if (tool === 'draw') {
      drawingActive.current = true
      var ctx2 = getCtx()
      ctx2.beginPath()
      ctx2.moveTo(pos.x, pos.y)
      return
    }

    // line, arrow, rect, circle
    drawStart.current = pos
    drawingActive.current = true
  }

  function handleMove(e) {
    if (tool === 'pan') {
      if (e.touches && e.touches.length === 2 && pinchStart.current) {
        var t1 = e.touches[0], t2 = e.touches[1]
        var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        var newScale = baseScale.current * (dist / pinchStart.current)
        setViewScale(Math.max(0.2, Math.min(5, newScale)))
        return
      }
      if (panStart.current) {
        var touch = e.touches ? e.touches[0] : e
        setViewOffset({ x: touch.clientX - panStart.current.x, y: touch.clientY - panStart.current.y })
      }
      return
    }
    if (!drawingActive.current) return
    e.preventDefault()
    var pos = getCanvasPos(e.touches ? e.touches[0].clientX : e.clientX, e.touches ? e.touches[0].clientY : e.clientY)

    if (tool === 'eraser') {
      var ctx = canvasRef.current.getContext('2d')
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      return
    }

    if (tool === 'draw') {
      var ctx2 = canvasRef.current.getContext('2d')
      ctx2.lineTo(pos.x, pos.y)
      ctx2.stroke()
      return
    }

    if (drawStart.current) {
      drawShapePreview(drawStart.current, pos)
    }
  }

  function handleEnd(e) {
    if (tool === 'pan') {
      panStart.current = null
      pinchStart.current = null
      return
    }
    if (!drawingActive.current) return
    drawingActive.current = false

    if (tool === 'eraser') {
      var ctx = canvasRef.current.getContext('2d')
      ctx.globalCompositeOperation = 'source-over'
      // Redraw base image under the erased areas
      var canvas = canvasRef.current
      var tempData = canvas.toDataURL()
      var baseImg = imgRef.current
      var tempImg = new Image()
      tempImg.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(baseImg, 0, 0)
        ctx.drawImage(tempImg, 0, 0)
        saveHistory()
      }
      // Actually just save history for eraser
      saveHistory()
      return
    }

    if (tool === 'draw') {
      saveHistory()
      return
    }

    if (drawStart.current) {
      var pos = e.changedTouches ? getCanvasPos(e.changedTouches[0].clientX, e.changedTouches[0].clientY) : getCanvasPos(e.clientX, e.clientY)
      commitShape(drawStart.current, pos)
      drawStart.current = null
    }
  }

  function placeText() {
    if (!textInput.trim() || !textPos) return
    var ctx = getCtx()
    var fontSize = Math.max(14, 20 / viewScale)
    ctx.font = 'bold ' + fontSize + 'px Arial'
    ctx.globalAlpha = opacity
    ctx.strokeStyle = '#000'
    ctx.lineWidth = Math.max(1, 2 / viewScale)
    ctx.strokeText(textInput.trim(), textPos.x, textPos.y)
    ctx.fillStyle = color
    ctx.fillText(textInput.trim(), textPos.x, textPos.y)
    restoreCtx(ctx)
    setTextInput('')
    setTextMode(false)
    setTextPos(null)
    saveHistory()
  }

  function handleWheel(e) {
    e.preventDefault()
    var delta = e.deltaY > 0 ? 0.9 : 1.1
    var newScale = Math.max(0.2, Math.min(5, viewScale * delta))
    // Zoom toward cursor position
    var rect = containerRef.current.getBoundingClientRect()
    var mx = e.clientX - rect.left
    var my = e.clientY - rect.top
    var newOffX = mx - (mx - viewOffset.x) * (newScale / viewScale)
    var newOffY = my - (my - viewOffset.y) * (newScale / viewScale)
    setViewScale(newScale)
    setViewOffset({ x: newOffX, y: newOffY })
  }

  function zoomIn() {
    setViewScale(function(s) { return Math.min(5, s * 1.3) })
  }

  function zoomOut() {
    setViewScale(function(s) { return Math.max(0.2, s * 0.7) })
  }

  function zoomFit() {
    var canvas = canvasRef.current
    if (!canvas) return
    var container = containerRef.current
    var maxW = container ? container.clientWidth - 16 : window.innerWidth - 16
    var maxH = window.innerHeight - 200
    var fitScale = Math.min(maxW / canvas.width, maxH / canvas.height, 1)
    setViewScale(fitScale)
    setViewOffset({ x: 0, y: 0 })
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

  // Setup overlay canvas to match main canvas
  useEffect(function() {
    if (!imgLoaded) return
    var canvas = canvasRef.current
    var ov = overlayRef.current
    if (canvas && ov) {
      ov.width = canvas.width
      ov.height = canvas.height
    }
  }, [imgLoaded])

  var COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#a855f7', '#ffffff', '#000000']
  var TOOLS = [
    { id: 'pan', label: 'Pan' },
    { id: 'draw', label: 'Draw' },
    { id: 'line', label: 'Line' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'rect', label: 'Rect' },
    { id: 'circle', label: 'Circle' },
    { id: 'text', label: 'Text' },
    { id: 'eraser', label: 'Erase' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-2 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <button onClick={onClose} className="text-slate-400 text-sm active:text-white">Cancel</button>
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="text-slate-400 text-sm w-8 h-8 flex items-center justify-center border border-slate-700 rounded-lg active:bg-slate-800">−</button>
          <button onClick={zoomFit} className="text-slate-500 text-xs px-2 h-8 flex items-center justify-center border border-slate-700 rounded-lg active:bg-slate-800">{Math.round(viewScale * 100)}%</button>
          <button onClick={zoomIn} className="text-slate-400 text-sm w-8 h-8 flex items-center justify-center border border-slate-700 rounded-lg active:bg-slate-800">+</button>
          <button onClick={function() { setShowTools(function(v) { return !v }) }} className="text-slate-500 text-xs px-2 h-8 flex items-center justify-center border border-slate-700 rounded-lg ml-1">
            {showTools ? 'Hide' : 'Tools'}
          </button>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="text-orange-400 text-sm font-semibold active:text-orange-300 disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden bg-slate-950 relative"
        style={{ touchAction: tool === 'pan' ? 'auto' : 'none' }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onWheel={handleWheel}>
        {!imgLoaded && <p className="text-slate-500 text-sm absolute inset-0 flex items-center justify-center">Loading image...</p>}
        <canvas ref={canvasRef} style={canvasStyle()} />
        <canvas ref={overlayRef} style={Object.assign({}, canvasStyle(), { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' })} />
      </div>

      {textMode && (
        <div className="absolute inset-x-0 bottom-24 px-4 z-20">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex gap-2">
            <input type="text" value={textInput} onChange={function(e) { setTextInput(e.target.value) }}
              placeholder="Type label..."
              autoFocus
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            <button onClick={placeText} disabled={!textInput.trim()}
              className="bg-orange-500 text-white font-bold px-4 rounded-lg text-sm active:bg-orange-600 disabled:opacity-40">Place</button>
            <button onClick={function() { setTextMode(false); setTextPos(null) }}
              className="text-slate-400 text-sm px-2">X</button>
          </div>
        </div>
      )}

      {showTools && (
        <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700 px-3 py-2 space-y-2">
          <div className="flex gap-1 overflow-x-auto">
            {TOOLS.map(function(t) {
              return (
                <button key={t.id} onClick={function() { setTool(t.id) }}
                  className={'px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ' + (tool === t.id ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'text-slate-500 border border-slate-700')}>
                  {t.label}
                </button>
              )
            })}
            <button onClick={undo} disabled={history.length < 2}
              className="px-2.5 py-1.5 text-slate-500 text-xs border border-slate-700 rounded-lg active:bg-slate-800 disabled:opacity-30 flex-shrink-0">
              Undo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {COLORS.map(function(c) {
                return (
                  <button key={c} onClick={function() { setColor(c) }}
                    className={'w-6 h-6 rounded-full border-2 flex-shrink-0 ' + (color === c ? 'border-white' : 'border-slate-600')}
                    style={{ backgroundColor: c }} />
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-slate-600 text-xs w-8">Size</span>
              <input type="range" min="1" max="10" value={lineWidth}
                onChange={function(e) { setLineWidth(parseInt(e.target.value)) }}
                className="flex-1" />
            </div>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-slate-600 text-xs w-8">Opacity</span>
              <input type="range" min="10" max="100" value={Math.round(opacity * 100)}
                onChange={function(e) { setOpacity(parseInt(e.target.value) / 100) }}
                className="flex-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
