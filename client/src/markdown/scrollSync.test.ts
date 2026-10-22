import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectScrollSync } from './scrollSync'

function pane(height: number, visible: number) {
  const element = document.createElement('div')
  Object.defineProperties(element, { scrollHeight: { value: height }, clientHeight: { value: visible } })
  return element
}
afterEach(() => vi.useRealTimers())
describe('proportional scroll synchronization', () => {
  it('synchronizes user scrolling in both directions without a feedback loop', () => {
    const source = pane(1000, 200), preview = pane(1800, 200)
    const cleanup = connectScrollSync(source, preview)
    source.dispatchEvent(new WheelEvent('wheel')); source.scrollTop = 400; source.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(800)
    preview.dispatchEvent(new Event('scroll')); expect(source.scrollTop).toBe(400)
    preview.dispatchEvent(new WheelEvent('wheel')); preview.scrollTop = 400; preview.dispatchEvent(new Event('scroll'))
    expect(source.scrollTop).toBe(200)
    cleanup.pause(); source.dispatchEvent(new Event('scroll')); expect(preview.scrollTop).toBe(400)
    cleanup.destroy(); source.scrollTop = 800; source.dispatchEvent(new Event('scroll')); expect(preview.scrollTop).toBe(400)
  })
  it('ignores programmatic cursor scrolling, expired gestures and non-scroll keys', () => {
    vi.useFakeTimers()
    const source = pane(1000, 200), preview = pane(1000, 200)
    const cleanup = connectScrollSync(source, preview)
    source.scrollTop = 100; source.dispatchEvent(new Event('scroll')); expect(preview.scrollTop).toBe(0)
    source.dispatchEvent(new WheelEvent('wheel')); vi.advanceTimersByTime(300)
    source.dispatchEvent(new Event('scroll')); expect(preview.scrollTop).toBe(0)
    source.dispatchEvent(new WheelEvent('wheel')); source.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    source.dispatchEvent(new Event('scroll')); expect(preview.scrollTop).toBe(0)
    source.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' })); source.dispatchEvent(new Event('scroll')); expect(preview.scrollTop).toBe(100)
    cleanup.destroy()
  })
  it('handles short documents without division by zero', () => {
    const source = pane(200, 200), preview = pane(100, 200)
    const cleanup = connectScrollSync(source, preview)
    source.dispatchEvent(new WheelEvent('wheel')); source.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(0); cleanup.destroy()
  })
})
