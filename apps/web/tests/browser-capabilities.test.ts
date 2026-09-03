import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserCapabilities } from '../src/browser/BrowserCapabilities'
afterEach(() => vi.unstubAllGlobals())
describe('Browser clipboard boundaries', () => {
  it('does not read or write clipboard when reporting capabilities or proposing text', async () => {
    const readText = vi.fn().mockResolvedValue('private draft'),
      writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { readText, writeText } })
    const browser = new BrowserCapabilities()
    expect(browser.describe().otherBrowserTabs).toBe(false)
    browser.proposeCopy('Reviewed note')
    expect(readText).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
    expect(() => browser.proposeCopy('Replace pending text')).toThrow('Review')
    await browser.approveCopy()
    expect(writeText).toHaveBeenCalledExactlyOnceWith('Reviewed note')
    expect(browser.state.pendingCopy).toBeNull()
  })
  it('keeps a denied permission request reviewable and supports dismissal', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const browser = new BrowserCapabilities()
    browser.proposeCopy('Draft')
    await expect(browser.approveCopy()).rejects.toThrow('Permission denied')
    expect(browser.state.pendingCopy?.text).toBe('Draft')
    browser.denyCopy()
    expect(browser.state.pendingCopy).toBeNull()
    expect(writeText).toHaveBeenCalledTimes(1)
  })
  it('reports unavailable APIs and bounds user-requested clipboard reads', async () => {
    vi.stubGlobal('navigator', {})
    const browser = new BrowserCapabilities()
    expect(browser.describe().clipboardRead).toBe(false)
    await expect(browser.readText()).rejects.toThrow('unavailable')
    vi.stubGlobal('navigator', {
      clipboard: { readText: vi.fn().mockResolvedValue('x'.repeat(2001)) },
    })
    await expect(browser.readText()).rejects.toThrow('exceeds')
  })
})
