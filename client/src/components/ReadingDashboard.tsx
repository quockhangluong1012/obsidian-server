import { useEffect, useMemo, useState } from 'react'
import { useVault } from '../store/useVault'
import { useViewport } from '../hooks/useViewport'
import { readingApi, type NoteReadingStatDto, type ReadingRange, type ReadingSummaryDto } from '../lib/api'

const RANGES: { key: ReadingRange; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: '1y', label: '1 năm' },
  { key: 'all', label: 'Tất cả' },
]

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds)
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

function bucketLabel(startIso: string, range: ReadingRange): string {
  const d = new Date(startIso)
  if (range === 'today') return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (range === '7d' || range === '30d') return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  return d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' })
}

type SortKey = 'totalSeconds' | 'lastReadAt' | 'sessionCount' | 'title'

function Chart({ summary, range }: { summary: ReadingSummaryDto; range: ReadingRange }) {
  const unit = range === 'today' ? 60 : 3600 // minutes for hourly buckets, hours otherwise
  const unitLabel = range === 'today' ? 'phút' : 'giờ'
  const values = summary.buckets.map((b) => b.seconds / unit)
  const max = Math.max(1, ...values)

  const width = 640
  const height = 200
  const padL = 34
  const padB = 22
  const padT = 10
  const plotW = width - padL - 8
  const plotH = height - padT - padB
  const n = values.length

  const points = values.map((v, i) => {
    const x = padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = padT + plotH - (v / max) * plotH
    return { x, y, v, bucket: summary.buckets[i] }
  })
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[n - 1]?.x.toFixed(1) ?? padL} ${padT + plotH} L ${points[0]?.x.toFixed(1) ?? padL} ${padT + plotH} Z`

  // thin label set: show at most ~8 x-axis labels so they don't overlap
  const labelStride = Math.max(1, Math.ceil(n / 8))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[200px]" role="img" aria-label={`Biểu đồ thời gian đọc theo ${unitLabel}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={padL}
          x2={width - 8}
          y1={padT + plotH * (1 - f)}
          y2={padT + plotH * (1 - f)}
          stroke="var(--bd)"
          strokeWidth={1}
        />
      ))}
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={padL - 6} y={padT + plotH * (1 - f) + 3} textAnchor="end" fontSize={10} fill="var(--tx2)">
          {(max * f).toFixed(max * f < 10 ? 1 : 0)}
        </text>
      ))}
      {n > 0 && <path d={areaPath} fill="var(--pri)" opacity={0.12} stroke="none" />}
      {n > 1 && <path d={linePath} fill="none" stroke="var(--pri)" strokeWidth={2} />}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={p.v > 0 ? 2.6 : 1.6} fill="var(--pri)" opacity={p.v > 0 ? 1 : 0.35} />
          <title>{`${bucketLabel(p.bucket.startUtc, range)} · ${formatDuration(p.bucket.seconds)}`}</title>
          {i % labelStride === 0 && (
            <text x={p.x} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--tx2)">
              {bucketLabel(p.bucket.startUtc, range)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export function ReadingDashboard() {
  const s = useVault()
  const { isPhone } = useViewport()
  const [range, setRange] = useState<ReadingRange>('today')
  const [summary, setSummary] = useState<ReadingSummaryDto | null>(null)
  const [notes, setNotes] = useState<NoteReadingStatDto[]>([])
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('totalSeconds')
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    if (!s.dashboardOpen) return
    let cancelled = false
    setLoading(true)
    Promise.all([readingApi.summary(range), readingApi.notes()])
      .then(([sum, list]) => {
        if (cancelled) return
        setSummary(sum)
        setNotes(list)
      })
      .catch(() => { if (!cancelled) { setSummary(null); setNotes([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [s.dashboardOpen, range])

  const sortedNotes = useMemo(() => {
    const copy = notes.slice()
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortKey === 'lastReadAt') cmp = a.lastReadAt.localeCompare(b.lastReadAt)
      else cmp = a[sortKey] - b[sortKey]
      return sortDesc ? -cmp : cmp
    })
    return copy
  }, [notes, sortKey, sortDesc])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(true) }
  }

  if (!s.dashboardOpen) return null

  const sortArrow = (key: SortKey) => (key === sortKey ? (sortDesc ? '↓' : '↑') : '')

  return (
    <div onClick={() => s.setDashboardOpen(false)} className="fixed inset-0 z-[99] flex items-end md:items-center justify-center md:p-6 bg-[rgba(18,20,38,.5)]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:w-[880px] md:max-w-full max-h-[92dvh] md:max-h-[86dvh] flex flex-col rounded-t-[22px] md:rounded-[14px] bg-[var(--bg)] border border-[var(--bd)] overflow-hidden"
        style={{ boxShadow: '0 20px 54px rgba(16,18,40,.38)', paddingBottom: 'var(--safe-b)' }}
      >
        <div className="md:hidden self-center w-10 h-1 rounded-full bg-[var(--bd)] mt-2" />
        <div className="flex items-center gap-2.5 p-4 md:p-3.5 px-5 md:px-4 shrink-0 border-b border-[var(--bd)]">
          <span className="material-symbols-rounded text-xl text-[var(--pri)]">monitoring</span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] md:text-[14.5px] font-medium">Thời gian đọc</div>
            <div className="text-[12px] md:text-[11.5px] text-[var(--tx2)]">
              {summary ? `Tổng cộng: ${formatDuration(summary.totalSeconds)}` : loading ? 'Đang tải…' : '—'}
            </div>
          </div>
          <span
            onClick={() => s.setDashboardOpen(false)}
            className="tap grid place-items-center w-11 h-11 md:w-[34px] md:h-[34px] shrink-0 rounded-full material-symbols-rounded text-[20px] md:text-[19px] text-[var(--tx2)] hover:bg-[var(--hov)]"
          >
            close
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-5 md:px-4 pt-3.5 md:pt-3 shrink-0 overflow-x-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="tap shrink-0 h-8 px-3.5 rounded-full text-[12.5px] font-medium"
              style={range === r.key ? { background: 'var(--pri)', color: 'var(--priC)' } : { background: 'var(--surf)', color: 'var(--tx2)' }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-4 flex flex-col gap-5">
          <div className="rounded-[12px] border border-[var(--bd)] bg-[var(--surf)] p-3 md:p-3.5">
            {summary && summary.buckets.length > 0 ? (
              <Chart summary={summary} range={range} />
            ) : (
              <div className="h-[200px] grid place-items-center text-[13px] text-[var(--tx2)]">
                {loading ? 'Đang tải…' : 'Chưa có dữ liệu đọc trong khoảng thời gian này'}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] tracking-[0.06em] uppercase text-[var(--tx2)]">Chi tiết theo note ({notes.length})</div>
            <div className="rounded-[12px] border border-[var(--bd)] overflow-hidden">
              <table className="w-full text-[13px] md:text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-[var(--surf)] text-[var(--tx2)] text-left">
                    <th className="px-3 py-2 font-medium cursor-pointer select-none" onClick={() => toggleSort('title')}>Note {sortArrow('title')}</th>
                    {!isPhone && <th className="px-3 py-2 font-medium">Thư mục</th>}
                    <th className="px-3 py-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort('totalSeconds')}>Thời gian đọc {sortArrow('totalSeconds')}</th>
                    {!isPhone && <th className="px-3 py-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort('sessionCount')}>Số phiên {sortArrow('sessionCount')}</th>}
                    <th className="px-3 py-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort('lastReadAt')}>Đọc gần nhất {sortArrow('lastReadAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNotes.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--tx2)]">Chưa đọc note nào</td></tr>
                  )}
                  {sortedNotes.map((n) => (
                    <tr
                      key={n.noteId}
                      onClick={() => { s.openNote(n.noteId); s.setDashboardOpen(false); s.setView('reading') }}
                      className="border-t border-[var(--bd)] hover:bg-[var(--hov)] cursor-pointer"
                    >
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
                          {n.active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--pri)] shrink-0" title="Đang đọc" />}
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{n.title}</span>
                        </div>
                      </td>
                      {!isPhone && <td className="px-3 py-2 text-[var(--tx2)] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{n.path}</td>}
                      <td className="px-3 py-2 text-right font-medium">{formatDuration(n.totalSeconds)}</td>
                      {!isPhone && <td className="px-3 py-2 text-right text-[var(--tx2)]">{n.sessionCount}</td>}
                      <td className="px-3 py-2 text-right text-[var(--tx2)]">{new Date(n.lastReadAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
