import { describe, expect, it, vi } from 'vitest'

import { handleOscLink } from '../terminal-osc-link-routing'
import { createTerminalLinkTestDoubles } from '../terminal-link-handlers-test-fixtures'
import {
  flushAsyncWork,
  installTerminalLinkTestEnvironment,
  setPlatform
} from '../terminal-link-handlers-test-harness'

const doubles = createTerminalLinkTestDoubles()
const { storeState, deps, openUrlMock, createBrowserTabMock } = doubles

vi.mock('@/store/index', () => ({
  useAppStore: {
    getState: () => storeState
  }
}))

vi.mock('@/lib/language-detect', () => ({
  detectLanguage: (filePath: string) => (filePath.endsWith('.md') ? 'markdown' : 'plaintext')
}))

vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorkspace: vi.fn(),
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/lib/connection-context', () => ({
  getConnectionId: vi.fn(() => null)
}))

installTerminalLinkTestEnvironment(doubles)

describe('handleOscLink', () => {
  it('waits for the first-use preference before routing terminal http links', async () => {
    setPlatform('Macintosh')
    storeState.settings = { openLinksInApp: false, openLinksInAppPreferencePrompted: false }
    const requestOpenLinksInAppPreference = vi.fn(async () => {
      storeState.settings = { openLinksInApp: true, openLinksInAppPreferencePrompted: true }
      return true
    })

    handleOscLink(
      'https://example.com',
      { metaKey: true, ctrlKey: false, shiftKey: false },
      { ...deps, requestOpenLinksInAppPreference }
    )

    expect(requestOpenLinksInAppPreference).toHaveBeenCalledWith('https://example.com/')
    expect(openUrlMock).not.toHaveBeenCalled()
    expect(createBrowserTabMock).not.toHaveBeenCalled()

    await flushAsyncWork()

    expect(createBrowserTabMock).toHaveBeenCalledWith('wt-1', 'https://example.com/', {
      activate: true
    })
    expect(openUrlMock).not.toHaveBeenCalled()
  })

  it('opens custom app schemes through shell after an owned gesture', () => {
    setPlatform('Macintosh')

    expect(
      handleOscLink('obsidian://open?vault=notes', { metaKey: true, ctrlKey: false }, deps)
    ).toBe(true)
    expect(openUrlMock).toHaveBeenCalledWith('obsidian://open?vault=notes')
    expect(createBrowserTabMock).not.toHaveBeenCalled()
  })

  it('does not open custom app schemes without an owned gesture', () => {
    setPlatform('Macintosh')

    expect(handleOscLink('obsidian://open?vault=notes', undefined, deps)).toBe(false)
    expect(openUrlMock).not.toHaveBeenCalled()
  })

  it('does not open denied schemes from OSC 8', () => {
    setPlatform('Macintosh')

    expect(handleOscLink('javascript:alert(1)', { metaKey: true, ctrlKey: false }, deps)).toBe(
      false
    )
    expect(openUrlMock).not.toHaveBeenCalled()
  })
})
