'use client'
import { useEffect as _ue } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignaturePage() {
  var router = useRouter()
  var canvasRef = useRef(null)
  var [mode, setMode] = useState('draw')
  var [typedName, setTypedName] = useState('')
  var [drawing, setDrawing] = useState(false)
  var [saving, setSaving] = useState(false)
  var [currentSig, setCurrentSig] = useState(null)
  var [userId, setUserId] = useState(null)
  var [cleared, setCleared] = useState(false)

  useEffect(function() {
    loadUser()
  }, [])

  useEffect(function() {
    if (mode === 'draw') {
      setTimeout(function() { initCanvas() }, 100)
    }
  }, [mode])

  async function loadUser() {
    var authResult = await supabase.auth.getUser()
    if (authResult.error || !authResult.data.user) return
    var uid = authResult.data.user.id
    setUserId(uid)
    var result = await supabase.from('users').select('signature_url').eq('id', uid).single()
    if (!result.error && result.data) { setCurrentSig(result.data.signature_url) }
  }

  function initCanvas() {
    var canvas = canvasRef.current
    if (!canvas) return
    var ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function getPos(e, canvas) {
    var rect = canvas.getBoundingClientRect()
    var scaleX = canvas.width / rect.width
    var scaleY = canvas.height / rect.height
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e) {
    e.preventDefault()
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    var pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  function draw(e) {
    e.preventDefault()
    if (!drawing) return
    var canvas = canvasRef.current
    var ctx = canvas.getContext('2d')
    var pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw(e) {
    e.preventDefault()
    setDrawing(false)
  }

  function clearCanvas() {
    var canvas = canvasRef.current
    if (!canvas) return
    var ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setCleared(true)
  }

  function getTypedSigCanvas() {
    var canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 100
    var ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1e3a5f'
    ctx.font = '52px "Dancing Script", cursive'
    ctx.textBaseline = 'middle'
    ctx.fillText(typedName, 16, 54)
    return canvas
  }

  async function handleSave() {
    if (saving || !userId) return
    setSaving(true)
    var canvas
    if (mode === 'draw') {
      canvas = canvasRef.current
      if (!canvas) { setSaving(false); return }
    } else {
      if (!typedName.trim()) { setSaving(false); return }
      canvas = getTypedSigCanvas()
    }
    var dataUrl = canvas.toDataURL('image/png')
    var base64 = dataUrl.split(',')[1]
    var binary = atob(base64)
    var array = new Uint8Array(binary.length)
    for (var i = 0; i < binary.length; i++) { array[i] = binary.charCodeAt(i) }
    var blob = new Blob([array], { type: 'image/png' })
    var fileName = 'signatures/' + userId + '.png'
    var uploadResult = await supabase.storage.from('reports').upload(fileName, blob, { contentType: 'image/png', upsert: true })
    if (uploadResult.error) { setSaving(false); alert('Upload failed: ' + uploadResult.error.message); return }
    var urlResult = supabase.storage.from('reports').getPublicUrl(fileName)
    var sigUrl = urlResult.data.publicUrl
    await supabase.from('users').update({ signature_url: sigUrl }).eq('id', userId)
    setCurrentSig(sigUrl)
    setSaving(false)
    alert('Signature saved!')
  }

  async function handleClear() {
    if (!userId) return
    await supabase.from('users').update({ signature_url: null }).eq('id', userId)
    setCurrentSig(null)
    clearCanvas()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap" />
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700">
        <button onClick={function() { router.back() }} className="text-orange-400 text-sm">Back</button>
        <p className="text-white text-sm font-semibold">My Signature</p>
        <button onClick={handleSave} disabled={saving} className="text-orange-400 text-sm disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {currentSig && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Current Signature</p>
            <img src={currentSig} className="h-12 object-contain bg-white rounded px-2 py-1" />
            <button onClick={handleClear} className="mt-2 text-red-400 text-xs">Clear Signature</button>
          </div>
        )}

        <div className="flex bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <button onClick={function() { setMode('draw') }}
            className={'flex-1 py-3 text-sm font-semibold transition-colors ' + (mode === 'draw' ? 'bg-orange-500 text-white' : 'text-slate-400 active:bg-slate-700')}>
            Draw
          </button>
          <button onClick={function() { setMode('type') }}
            className={'flex-1 py-3 text-sm font-semibold transition-colors ' + (mode === 'type' ? 'bg-orange-500 text-white' : 'text-slate-400 active:bg-slate-700')}>
            Type
          </button>
        </div>

        {mode === 'draw' && (
          <div>
            <p className="text-slate-500 text-xs mb-2">Draw your signature below</p>
            <div className="rounded-xl overflow-hidden border border-slate-600" style={{ touchAction: 'none' }}>
              <canvas ref={canvasRef} width={600} height={150}
                style={{ width: '100%', height: '150px', display: 'block', backgroundColor: '#fff', cursor: 'crosshair' }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              />
            </div>
            <button onClick={clearCanvas} className="mt-2 text-slate-500 text-xs">Clear</button>
          </div>
        )}

        {mode === 'type' && (
          <div>
            <p className="text-slate-500 text-xs mb-2">Type your name to generate a signature</p>
            <input type="text" value={typedName} onChange={function(e) { setTypedName(e.target.value) }}
              placeholder="Your full name..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-orange-500" />
            {typedName && (
              <div className="mt-3 bg-white rounded-xl px-4 py-3">
                <p style={{ fontFamily: '"Dancing Script", cursive', fontSize: '36px', color: '#1e3a5f', margin: 0 }}>{typedName}</p>
              </div>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Signature'}
        </button>
      </div>
    </div>
  )
}
