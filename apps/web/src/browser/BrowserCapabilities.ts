import { reactive } from 'vue'
import { ulid } from 'ulid'

export class BrowserCapabilities {
  readonly state = reactive({
    pendingCopy: null as { id: string; text: string } | null,
    message: '',
  })
  describe() {
    const nav = typeof navigator === 'undefined' ? undefined : navigator
    return {
      screenSharing: !!nav?.mediaDevices?.getDisplayMedia,
      clipboardRead: !!nav?.clipboard?.readText,
      clipboardWrite: !!nav?.clipboard?.writeText,
      otherBrowserTabs: false,
      desktopInput: 'Requires the paired local bridge',
      permissions:
        'Screen sharing and clipboard operations require a visible user action and browser permission.',
    }
  }
  proposeCopy(text: string) {
    if (!this.describe().clipboardWrite)
      throw new Error('Clipboard writing is unavailable in this browser.')
    if (!text || text.length > 2000)
      throw new Error('Clipboard text must contain 1 to 2000 characters.')
    if (this.state.pendingCopy) throw new Error('Review the current clipboard request first.')
    const proposal = { id: ulid(), text }
    this.state.pendingCopy = proposal
    this.state.message = ''
    return { proposalId: proposal.id, status: 'awaiting_user' as const }
  }
  async approveCopy() {
    const proposal = this.state.pendingCopy
    if (!proposal) throw new Error('No clipboard request is pending.')
    // Called directly by the visible button to retain browser user activation.
    await navigator.clipboard.writeText(proposal.text)
    if (this.state.pendingCopy?.id === proposal.id) this.state.pendingCopy = null
    this.state.message = 'Copied to your clipboard.'
  }
  denyCopy() {
    this.state.pendingCopy = null
    this.state.message = 'Clipboard request dismissed. Nothing copied.'
  }
  async readText() {
    if (!this.describe().clipboardRead)
      throw new Error('Clipboard reading is unavailable. Paste into the text box instead.')
    const text = await navigator.clipboard.readText()
    if (text.length > 2000)
      throw new Error('Clipboard text exceeds 2000 characters. Paste a smaller selection.')
    return text
  }
  async copyText(text: string) {
    if (!this.describe().clipboardWrite)
      throw new Error('Clipboard writing is unavailable. Select and copy the text instead.')
    if (text.length > 2000) throw new Error('Clipboard text exceeds 2000 characters.')
    await navigator.clipboard.writeText(text)
  }
}
