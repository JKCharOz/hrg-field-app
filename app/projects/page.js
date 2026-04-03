'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProjectDocsModal } from '@/components/ProjectDocsModal'


function InProgressSection(props) {
  var [open, setOpen] = React.useState(false)
  return (
    <div className="mb-3">
      <button onClick={function() { setOpen(function(o) { return !o }) }}
        className="w-full flex items-center justify-between py-1.5 mb-1">
        <p className="text-teal-400 text-xs uppercase tracking-wider font-semibold">Reports In Progress ({props.reports.length})</p>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="space-y-1.5">
          {props.reports.map(function(r) {
            return (
              <div key={r.id} className="flex items-center gap-2">
                <button onClick={function() { props.router.push('/report/daily-log?report=' + r.id) }}
                  className="flex-1 flex items-center justify-between bg-slate-800 border border-teal-800 rounded-xl px-4 py-2.5 active:bg-slate-700">
                  <span className="text-slate-200 text-sm">Report #{r.report_number}</span>
                  <span className="text-slate-500 text-xs">{r.report_date}</span>
                </button>
                <button onClick={function() {
                  if (window.confirm('Delete Report #' + r.report_number + '?')) { props.onDelete(r.id) }
                }} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-red-400 text-xs active:bg-red-900/20">Del</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default function ProjectsPage() {
  var router = useRouter()
  var [projects, setProjects] = useState([])
  var [profile, setProfile] = useState(null)
  var [loading, setLoading] = useState(true)
  var [pageError, setPageError] = useState(null)
  var [creating, setCreating] = useState({})
  var [reports, setReports] = useState([])
  var [docsProject, setDocsProject] = useState(null)

  useEffect(function() {
    loadData()
    function onFocus() { loadData() }
    window.addEventListener('focus', onFocus)
    return function() { window.removeEventListener('focus', onFocus) }
  }, [])

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
    var repResult = await supabase.from('daily_reports').select('id, project_id, report_number, report_date, status, pdf_url').eq('org_id', orgId).order('report_date', { ascending: false })
    if (!repResult.error) { setReports(repResult.data || []) }
    setLoading(false)
  }

  async function handleProjectPress(project) {
    if (creating[project.id]) return
    setCreating(function(prev) { var n = Object.assign({}, prev); n[project.id] = 'loading'; return n })
    try {
      if (!profile) throw new Error('User profile not loaded.')
      var now = new Date()
      var reportDate = now.toISOString().split('T')[0]
      var existingResult = await supabase.from('daily_reports').select('id').eq('project_id', project.id).eq('inspector_id', profile.id).eq('report_date', reportDate).maybeSingle()
      if (existingResult.data) { router.push('/report/daily-log?report=' + existingResult.data.id); return }
      var countResult = await supabase.from('daily_reports').select('id', { count: 'exact', head: true }).eq('project_id', project.id)
      if (countResult.error) throw countResult.error
      var nextNumber = (countResult.count || 0) + 1
      var sessionStart = now.toTimeString().slice(0, 8)
      var insertResult = await supabase.from('daily_reports').insert({
        project_id: project.id,
        org_id: profile.org_id,
        inspector_id: profile.id,
        report_number: nextNumber,
        report_date: reportDate,
        session_start_time: sessionStart,
        status: 'draft',
        created_at: now.toISOString(),
      }).select().single()
      if (insertResult.error) throw insertResult.error
      var newReportId = insertResult.data.id
      var prevResult = await supabase
        .from('daily_reports')
        .select('id')
        .eq('project_id', project.id)
        .neq('id', newReportId)
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (prevResult.data) {
        var prevEquip = await supabase
          .from('equipment_logs')
          .select('equip_type, description, quantity, hours, contractor, entry_type')
          .eq('report_id', prevResult.data.id)
        if (!prevEquip.error && prevEquip.data && prevEquip.data.length > 0) {
          var equipRows = prevEquip.data.map(function(e) {
            return {
              report_id: newReportId,
              project_id: project.id,
              org_id: profile.org_id,
              equip_type: e.equip_type,
              description: e.description,
              quantity: e.quantity,
              hours: null,
              contractor: e.contractor,
              entry_type: e.entry_type || 'equipment',
              logged_at: new Date().toISOString(),
            }
          })
          await supabase.from('equipment_logs').insert(equipRows)
        }
        var prevCrew = await supabase
          .from('crew_logs')
          .select('role, quantity, contractor')
          .eq('report_id', prevResult.data.id)
        if (!prevCrew.error && prevCrew.data && prevCrew.data.length > 0) {
          var crewRows = prevCrew.data.map(function(c) {
            return {
              report_id: newReportId,
              project_id: project.id,
              org_id: profile.org_id,
              role: c.role,
              quantity: c.quantity,
              contractor: c.contractor,
              created_at: new Date().toISOString(),
            }
          })
          await supabase.from('crew_logs').insert(crewRows)
        }
      }
      router.push('/report/daily-log?report=' + newReportId)
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
        <div className="flex items-center justify-between">
          <h1 className="text-white font-bold text-xl">Projects</h1>
          <div className="flex items-center gap-2">
            <button onClick={function() { router.push('/settings') }}
              className="text-slate-400 text-sm px-3 py-2 rounded-xl border border-slate-700 active:bg-slate-700">Settings</button>
            <button onClick={function() { router.push('/projects/new') }}
              className="bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-orange-600 transition-colors">+ New Project</button>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 space-y-6">
        {projects.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">No projects found for your organization.</p>
        )}
        {projects.map(function(project) {
          var projectReports = reports.filter(function(r) { return r.project_id === project.id })
          var inProgress = projectReports.filter(function(r) { return r.status !== 'completed' })
          var completed = projectReports.filter(function(r) { return r.status === 'completed' })
          var state = creating[project.id]
          var isLoading = state === 'loading'
          var isError = state === 'error'
          return (
            <div key={project.id}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white font-bold text-base">{project.project_name}</p>
                  {project.project_number && <p className="text-orange-400 text-xs font-mono">{project.project_number}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={function() { setDocsProject(project) }}
                    className="text-slate-400 text-xs px-2 py-1 border border-slate-700 rounded-lg active:bg-slate-700">Files</button>
                  <button onClick={function() { router.push('/projects/totals?id=' + project.id) }}
                    className="text-orange-400 text-xs px-2 py-1 border border-orange-500/30 rounded-lg active:bg-orange-500/10">Totals</button>
                  <button onClick={function() { router.push('/projects/edit?id=' + project.id) }}
                    className="text-slate-500 text-xs px-2 py-1 border border-slate-700 rounded-lg active:bg-slate-700">Edit</button>
                </div>
              </div>
              <button onClick={function() { handleProjectPress(project) }} disabled={isLoading}
                className="w-full mb-3 bg-teal-900/40 border border-teal-700 rounded-xl px-4 py-3 text-left active:bg-teal-800/50 disabled:opacity-60 transition-colors">
                <p className="text-teal-300 text-xs font-semibold uppercase tracking-wider">
                  {isLoading ? 'Opening...' : isError ? 'Failed - tap to retry' : '+ Start New Report'}
                </p>
              </button>
              {inProgress.length > 0 && (
                <InProgressSection reports={inProgress} router={router} onDelete={function(id) {
                  setReports(function(prev) { return prev.filter(function(r) { return r.id !== id }) })
                  supabase.from('daily_reports').delete().eq('id', id)
                }} />
              )}
              {completed.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: '#a05070' }}>Completed Reports</p>
                  <div className="space-y-1.5">
                    {completed.map(function(r) {
                      return (
                        <button key={r.id} onClick={function() { router.push('/report/preview?report=' + r.id) }}
                          className="w-full flex items-center justify-between bg-slate-800 border rounded-xl px-4 py-2.5 active:bg-slate-700" style={{ borderColor: '#a05070' }}>
                          <span className="text-slate-200 text-sm">Report #{r.report_number}</span>
                          <span className="text-slate-500 text-xs">{r.report_date}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {docsProject && <ProjectDocsModal project={docsProject} onClose={function() { setDocsProject(null) }} />}
    </div>
  )
}
