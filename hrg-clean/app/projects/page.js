'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProjectsPage() {
  var router = useRouter()
  var [projects, setProjects] = useState([])
  var [profile, setProfile] = useState(null)
  var [loading, setLoading] = useState(true)
  var [pageError, setPageError] = useState(null)
  var [creating, setCreating] = useState({})

  useEffect(function() { loadData() }, [])

  async function loadData() {
    var authResult = await supabase.auth.getUser()
    if (authResult.error || !authResult.data || !authResult.data.user) {
      setPageError('Not authenticated.')
      setLoading(false)
      return
    }
    var user = authResult.data.user
    var profResult = await supabase.from('users').select('org_id').eq('id', user.id).single()
    if (profResult.error || !profResult.data || !profResult.data.org_id) {
      setPageError('Could not load your organisation. Contact your administrator.')
      setLoading(false)
      return
    }
    var orgId = profResult.data.org_id
    setProfile({ id: user.id, org_id: orgId })
    var projResult = await supabase.from('projects').select('*').eq('org_id', orgId).order('project_name', { ascending: true })
    if (projResult.error) {
      setPageError('Failed to load projects.')
    } else {
      setProjects(projResult.data || [])
    }
    setLoading(false)
  }

  async function handleProjectPress(project) {
    if (creating[project.id]) return
    setCreating(function(prev) { var n = Object.assign({}, prev); n[project.id] = 'loading'; return n })
    try {
      if (!profile) throw new Error('User profile not loaded.')
      var countResult = await supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('project_id', project.id)
      if (countResult.error) throw countResult.error
      var nextNumber = (countResult.count || 0) + 1
      var now = new Date()
      var reportDate = now.toISOString().split('T')[0]
      var sessionStart = now.toTimeString().slice(0, 8)
      var insertResult = await supabase.from('daily_reports').insert({
        project_id: project.id,
        org_id: profile.org_id,
        inspector_id: profile.id,
        report_number: nextNumber,
        report_date: reportDate,
        session_start_time: sessionStart,
        status: 'in_progress',
        created_at: now.toISOString(),
      }).select().single()
      if (insertResult.error) throw insertResult.error
      router.push('/report/daily-log?report=' + insertResult.data.id)
    } catch (err) {
      console.error('Failed to create report:', err.message)
      setCreating(function(prev) { var n = Object.assign({}, prev); n[project.id] = 'error'; return n })
      setTimeout(function() {
        setCreating(function(prev) { var n = Object.assign({}, prev); n[project.id] = null; return n })
      }, 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 text-sm">Loading projects...</p>
      </div>
    )
  }
  if (pageError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-white font-bold">{pageError}</p>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="bg-slate-900 border-b border-slate-700 px-4 pt-12 pb-4">
        <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-0.5">HRG Field Log</p>
        <h1 className="text-white font-bold text-xl">Projects</h1>
      </div>
      <div className="px-4 py-4 space-y-3">
        {projects.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">No projects found for your organization.</p>
        )}
        {projects.map(function(project) {
          var state = creating[project.id]
          var isLoading = state === 'loading'
          var isError = state === 'error'
          return (
            <button key={project.id} onClick={function() { handleProjectPress(project) }} disabled={isLoading}
              className="w-full text-left bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 active:bg-slate-700 disabled:opacity-60 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-bold text-base leading-tight truncate">{project.project_name}</p>
                  {project.project_number && <p className="text-orange-400 text-xs font-mono mt-0.5">{project.project_number}</p>}
                  {project.location && <p className="text-slate-500 text-xs mt-1">{project.location}</p>}
                </div>
                <div className="flex-shrink-0 mt-0.5">
                  {isLoading && <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />}
                  {isError && <span className="text-red-400 text-xs font-medium">Failed - tap to retry</span>}
                  {!isLoading && !isError && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
