import { useEffect, useRef } from 'react'
import { useVault } from '../store/useVault'
import { readingApi } from '../lib/api'

const HEARTBEAT_MS = 20_000

/**
 * Tracks how long the user actually spends reading each note.
 *
 * A "session" spans one continuous stretch of a note being the visible, focused active tab:
 * - starts when a note tab becomes active
 * - ends when the active tab changes, the note tab closes, the browser tab is hidden/blurred,
 *   or the page unloads
 * - re-focusing the same note (or the tab becoming visible again) opens a fresh session
 *
 * Splitting on hide/blur (rather than letting one session span an idle gap) keeps server-side
 * duration accounting exact: each session's wall-clock length is the time actually read, so a
 * heartbeat every 20s can safely accumulate real elapsed seconds with only a small clamp for
 * clock hiccups. Assets and unsaved "new note" drafts are not tracked — only notes that exist
 * in the backend are meaningful "reading".
 */
export function useReadingTracker() {
  const active = useVault((s) => s.active)
  const activeTab = useVault((s) => s.openTabs.find((t) => t.id === s.active))
  const isTrackableNote = activeTab?.kind === 'note'

  const sessionRef = useRef<string | null>(null)
  const heartbeatRef = useRef<number | null>(null)

  const stopHeartbeat = () => {
    if (heartbeatRef.current != null) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }

  const endSession = (useBeacon: boolean) => {
    const id = sessionRef.current
    if (!id) return
    sessionRef.current = null
    stopHeartbeat()
    if (useBeacon) readingApi.endBeacon(id)
    else readingApi.end(id).catch(() => {})
  }

  const startSession = (noteId: string) => {
    readingApi
      .start(noteId)
      .then(({ id }) => {
        // the active note may have changed again while the request was in flight
        if (useVault.getState().active !== noteId) { readingApi.endBeacon(id); return }
        sessionRef.current = id
        heartbeatRef.current = window.setInterval(() => {
          if (sessionRef.current) readingApi.heartbeat(sessionRef.current).catch(() => {})
        }, HEARTBEAT_MS)
      })
      .catch(() => {})
  }

  // start/stop tracking as the active note changes
  useEffect(() => {
    endSession(false)
    if (isTrackableNote && active && document.visibilityState === 'visible' && document.hasFocus()) {
      startSession(active)
    }
    return () => endSession(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isTrackableNote])

  // pause on hide/blur, resume a fresh session on show/focus
  useEffect(() => {
    const pause = () => endSession(false)
    const resume = () => {
      if (!sessionRef.current && isTrackableNote && active && document.visibilityState === 'visible' && document.hasFocus()) {
        startSession(active)
      }
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? resume() : pause())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', resume)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', resume)
      window.removeEventListener('blur', pause)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isTrackableNote])

  // best-effort close if the tab/app is closed outright — registered once; reads
  // sessionRef at unload time so it always closes whatever session is current
  useEffect(() => {
    const onPageHide = () => endSession(true)
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
