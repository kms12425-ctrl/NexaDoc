/** Only deliberate scrolling leads synchronization; cursor/formatting scrolls do not. */
export function connectScrollSync(source: HTMLElement, preview: HTMLElement) {
  let leader: HTMLElement | null = null
  let until = 0
  const cleanups: Array<() => void> = []
  for (const [pane, other] of [[source, preview], [preview, source]]) {
    const arm = () => { leader = pane; until = Date.now() + 250 }
    const pointer = (event: PointerEvent) => {
      const bounds = pane.getBoundingClientRect()
      if (event.clientX >= bounds.right - (pane.offsetWidth - pane.clientWidth || 16)) arm()
    }
    const key = (event: KeyboardEvent) => {
      if (['PageUp', 'PageDown'].includes(event.key) || (event.ctrlKey && ['Home', 'End'].includes(event.key))) arm()
      else { leader = null }
    }
    const scroll = () => {
      if (leader !== pane || Date.now() > until) return
      until = Date.now() + 250
      const range = pane.scrollHeight - pane.clientHeight
      if (range <= 0) return
      const ratio = Math.max(0, Math.min(1, pane.scrollTop / range))
      other.scrollTop = ratio * Math.max(0, other.scrollHeight - other.clientHeight)
    }
    pane.addEventListener('wheel', arm, { passive: true })
    pane.addEventListener('touchmove', arm, { passive: true })
    pane.addEventListener('pointerdown', pointer)
    pane.addEventListener('keydown', key)
    pane.addEventListener('scroll', scroll, { passive: true })
    cleanups.push(() => {
      pane.removeEventListener('wheel', arm); pane.removeEventListener('touchmove', arm)
      pane.removeEventListener('pointerdown', pointer); pane.removeEventListener('keydown', key); pane.removeEventListener('scroll', scroll)
    })
  }
  return { destroy: () => cleanups.forEach((cleanup) => cleanup()), pause: () => { leader = null } }
}
