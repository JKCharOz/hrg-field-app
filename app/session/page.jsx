'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ORG_ID = '5c7d8ed6-aaaa-4ced-92e8-69894a0cedc1'

const WEATHER_CONDITIONS = [
  { value: 'sunny', label: '☀️ Sunny' },
  { value: 'cloudy', label: '⛅ Cloudy' },
  { value: 'overcast', label: '☁️ Overcast' },
  { value: 'rain', label: '🌧️ Rain' },
  { value: 'fog', label: '🌫️ Fog' },
]

const SITE_CONDITIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'wet', label: 'Wet' },
  { value: 'dusty', label: 'Dusty' },
  { value: 'muddy', label: 'Muddy' },
  { value: 'day_work', label: 'Day Work' },
  { value: 'night_work', label: 'Night Work' },
]

function getTodayString() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

function getTimeString() {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function SessionStartPage() {
  const [project, setProject] = useState(null)
  const [date, setDate] = useState(getTodayString())
  const [startTime] = useState(getTimeString())
  const [weatherTemp, setWeatherTemp] = useState('')
  const [weatherCondition, setWeatherCondition] = useState('')
  const [siteConditions, setSiteConditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const params = new URLSearchParams(window.location.search)
      const projectId = params.get('project')
      if (!projectId) { window.location.href = '/projects'; return }

      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (!proj) { window.location.href = '/projects'; return }
      setProject(proj)

      const { data: lastReport } = await supabase
        .from('daily_reports')
        .select('weather_temp, weather_conditions, site_conditions')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false })
        .limit(1)
        .single()

      if (lastReport) {
        if (lastReport.weather_temp) setWeatherTemp(lastReport.weather_temp)
        if (lastReport.weather_conditions) setWeatherCondition(lastReport.weather_conditions)
        if (lastReport.site_conditions) setSiteConditions(lastReport.site_conditions)
      }

      setLoading(false)
    }
    load()
  }, [])

  function toggleSiteCondition(val) {
    setSiteConditions(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    )
  }

  async function handleStartLog() {
    if (!weatherCondition) { setError('Please select a weather condition.'); return }
    if (!weatherTemp) { setError('Please enter the temperature.'); return }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { count } = await supabase
      .from('daily_reports')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)

    const reportNumber = String((count || 0) + 1).padStart(3, '0')

    const { data: report, error: insertError } = await supabase
      .from('daily_reports')
      .insert({
        project_id: project.id,
        org_id: ORG_ID,
        inspector_id: user.id,
        report_number: reportNumber,
        report_date: date,
        session_start_time: startTime,
        weather_temp: weatherTemp,
        weather_conditions: weatherCondition,
        site_conditions: siteConditions,
        status: 'draft'
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    window.location.href = `/log?report=${report.id}&project=${project.id}`
  }

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingText}>Loading project...</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => window.location.href = '/projects'} style={styles.backBtn}>
          ← Projects
        </button>
        <img src="/logo.png" alt="SiteDoc" style={styles.logo} />
      </div>

      <div style={styles.projectBanner}>
        <div style={styles.projectName}>{project.project_name}</div>
        <div style={styles.projectSub}>{project.project_number} · {project.general_contractor}</div>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <div style={styles.sectionLabel}>DATE</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.dateInput} />
          <div style={styles.dateDisplay}>{formatDisplayDate(date)}</div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.sectionLabel}>TEMPERATURE</div>
          <div style={styles.tempRow}>
            <input type="number" placeholder="72" value={weatherTemp} onChange={e => setWeatherTemp(e.target.value)} style={styles.tempInput} />
            <div style={styles.tempUnit}>°F</div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.sectionLabel}>WEATHER CONDITIONS</div>
          <div style={styles.chipRow}>
            {WEATHER_CONDITIONS.map(w => (
              <button key={w.value} onClick={() => setWeatherCondition(w.value)}
                style={{ ...styles.chip, ...(weatherCondition === w.value ? styles.chipActive : {}) }}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.sectionLabel}>SITE CONDITIONS</div>
          <div style={styles.chipRow}>
            {SITE_CONDITIONS.map(s => (
              <button key={s.value} onClick={() => toggleSiteCondition(s.value)}
                style={{ ...styles.chip, ...(siteConditions.includes(s.value) ? styles.chipActive : {}) }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.sectionLabel}>START TIME</div>
          <div style={styles.timeDisplay}>{startTime}</div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button onClick={handleStartLog} disabled={saving}
          style={{ ...styles.startBtn, ...(saving ? styles.startBtnDisabled : {}) }}>
          {saving ? 'Starting...' : '▶  Start Daily Log'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { fontFamily: "'DM Sans', -apple-system, sans-serif", background: '#0f1b2d', minHeight: '100vh', color: '#f0f4f8', maxWidth: 430, margin: '0 auto' },
  loadingScreen: { background: '#0f1b2d', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 16 },
  header: { background: 'linear-gradient(135deg, #0f2744 0%, #1a3a5c 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  backBtn: { background: 'none', border: 'none', color: '#7eb8f7', fontSize: 15, cursor: 'pointer', padding: '4px 0' },
  logo: { height: 32, objectFit: 'contain' },
  projectBanner: { background: 'linear-gradient(135deg, #1a3a5c 0%, #0f2744 100%)', padding: '16px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  projectName: { fontSize: 18, fontWeight: 700, color: '#ffffff' },
  projectSub: { fontSize: 13, color: 'rgba(126,184,247,0.8)', marginTop: 3 },
  content: { padding: '8px 20px 40px' },
  section: { paddingTop: 20, paddingBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(126,184,247,0.7)', marginBottom: 10 },
  dateInput: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#fff', fontSize: 17, padding: '14px 16px', width: '100%', boxSizing: 'border-box', colorScheme: 'dark' },
  dateDisplay: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8, paddingLeft: 2 },
  divider: { height: 1, background: 'rgba(255,255,255,0.07)', marginTop: 16 },
  tempRow: { display: 'flex', alignItems: 'center', gap: 10 },
  tempInput: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#fff', fontSize: 28, fontWeight: 700, padding: '12px 16px', width: 110, boxSizing: 'border-box', textAlign: 'center' },
  tempUnit: { fontSize: 22, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, color: 'rgba(255,255,255,0.7)', fontSize: 14, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  chipActive: { background: 'rgba(59,130,246,0.25)', border: '1px solid #3b82f6', color: '#7eb8f7', fontWeight: 600 },
  timeDisplay: { fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' },
  error: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#fca5a5', fontSize: 14, padding: '12px 16px', marginTop: 20 },
  startBtn: { width: '100%', padding: '18px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', border: 'none', borderRadius: 16, color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', marginTop: 32, letterSpacing: '0.01em', boxShadow: '0 4px 20px rgba(22,163,74,0.35)', fontFamily: 'inherit' },
  startBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
}
