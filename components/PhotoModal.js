'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export function PhotoModal(props) {
  var report = props.report
  var onClose = props.onClose
  var [photos, setPhotos] = useState([])
  var [loading, setLoading] = useState(true)
  var [uploading, setUploading] = useState(false)
  var fileRef = useRef(null)

  useEffect(function() {
    if (report && report.id) { loadPhotos() }
  }, [report && report.id])

  async function loadPhotos() {
    setLoading(true)
    var result = await supabase.from('field_photos').select('*').eq('report_id', report.id).order('created_at', { ascending: true })
    setLoading(false)
    if (!result.error && result.data) { setPhotos(result.data) }
  }

  async function handleFileChange(e) {
    var files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    var fileArray = Array.from(files)
    var results = await Promise.all(fileArray.map(async function(file, i) {
      var ext = file.name.split('.').pop()
      var fileName = report.id + '/' + Date.now() + '-' + i + '.' + ext
      var uploadResult = await supabase.storage.from('field-photos').upload(fileName, file, { upsert: false })
      if (uploadResult.error) return null
      var insertResult = await supabase.from('field_photos').insert({
        report_id: report.id,
        project_id: report.project_id,
        org_id: report.org_id,
        storage_path: fileName,
        file_name: file.name,
        is_report_photo: false,
      }).select().single()
      if (!insertResult.error && insertResult.data) return insertResult.data
      return null
    }))
    var newPhotos = results.filter(function(r) { return r !== null })
    if (newPhotos.length > 0) { setPhotos(function(prev) { return prev.concat(newPhotos) }) }
    setUploading(false)
    e.target.value = ''
  }

  var reportPhotos = photos.filter(function(p) { return p.is_report_photo }).sort(function(a, b) { return (a.report_order || 0) - (b.report_order || 0) })

  async function toggleReportPhoto(photo) {
    if (!photo.is_report_photo && reportPhotos.length >= 4) { return }
    var nextValue = !photo.is_report_photo
    var nextOrder = null
    if (nextValue) {
      var maxOrder = reportPhotos.reduce(function(max, p) { return Math.max(max, p.report_order || 0) }, 0)
      nextOrder = maxOrder + 1
    }
    var result = await supabase.from('field_photos').update({ is_report_photo: nextValue, report_order: nextOrder }).eq('id', photo.id).select().single()
    if (!result.error && result.data) { setPhotos(function(prev) { return prev.map(function(p) { return p.id === photo.id ? result.data : p }) }) }
  }

  async function movePhoto(photo, direction) {
    var current = photo.report_order || 0
    var swap = reportPhotos.find(function(p) { return p.report_order === current + direction })
    if (!swap) return
    await supabase.from('field_photos').update({ report_order: current + direction }).eq('id', photo.id)
    await supabase.from('field_photos').update({ report_order: current }).eq('id', swap.id)
    setPhotos(function(prev) {
      return prev.map(function(p) {
        if (p.id === photo.id) return Object.assign({}, p, { report_order: current + direction })
        if (p.id === swap.id) return Object.assign({}, p, { report_order: current })
        return p
      })
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <h3 className="text-white font-bold text-lg">Photos</h3>
        <button onClick={onClose} className="text-slate-400 text-sm active:text-white">Done</button>
      </div>
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Report Photos</p>
            <p className="text-slate-600 text-xs">{reportPhotos.length} of 4</p>
          </div>
          {reportPhotos.length === 0 && <p className="text-slate-600 text-xs py-2">Check photos below to include up to 4 in the report</p>}
          <div className="space-y-2 mt-2">
            {reportPhotos.map(function(photo) {
              return (
                <div key={photo.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-2">
                  <img src={supabase.storage.from('field-photos').getPublicUrl(photo.storage_path).data.publicUrl} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-400 text-xs">Report #{photo.report_order}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={function() { movePhoto(photo, -1) }} disabled={photo.report_order === 1}
                      className="text-slate-500 active:text-slate-200 disabled:opacity-20 text-xs px-2 py-1 bg-slate-700 rounded">Up</button>
                    <button onClick={function() { movePhoto(photo, 1) }} disabled={photo.report_order === reportPhotos.length}
                      className="text-slate-500 active:text-slate-200 disabled:opacity-20 text-xs px-2 py-1 bg-slate-700 rounded">Dn</button>
                  </div>
                  <button onClick={function() { toggleReportPhoto(photo) }}
                    className="text-red-400 text-xs px-2 py-1 border border-red-800 rounded-lg active:bg-red-900 flex-shrink-0">Remove</button>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mx-4 border-t border-slate-800 mt-2 mb-3" />
        <div className="px-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">All Photos</p>
          {loading && <p className="text-slate-600 text-sm">Loading...</p>}
          {!loading && photos.length === 0 && <p className="text-slate-600 text-sm">No photos yet. Tap below to add one.</p>}
          <div className="grid grid-cols-3 gap-2">
            {photos.map(function(photo) {
              var included = photo.is_report_photo
              var atLimit = reportPhotos.length >= 4
              return (
                <div key={photo.id} className="relative">
                  <img src={supabase.storage.from('field-photos').getPublicUrl(photo.storage_path).data.publicUrl} className="w-full aspect-square object-cover rounded-xl" />
                  <button onClick={function() { toggleReportPhoto(photo) }} disabled={!included && atLimit}
                    className={'absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-30 ' +
                      (included ? 'bg-orange-500 border-orange-500' : 'bg-slate-900/80 border-slate-500 active:border-orange-400')}>
                    {included && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-slate-950/95 border-t border-slate-800 p-4">
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
        <button onClick={function() { fileRef.current && fileRef.current.click() }} disabled={uploading}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base active:bg-orange-600 disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading...' : 'Take / Add Photo'}
        </button>
      </div>
    </div>
  )
}
