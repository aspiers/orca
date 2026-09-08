import type {
  HttpLinkActionDestinations as TerminalHttpLinkActionDestinations,
  HttpLinkRoutingPreferenceRequester as TerminalLinkRoutingPreferenceRequester
} from '@/lib/browser/navigation/http-link-destinations'
import type { Terminal } from '@xterm/xterm'
import type { LinkHandlerDeps } from '../files/terminal-link-handlers'
import {
  isTerminalLinkDirectActivation,
  isTerminalOwnedLinkGesture
} from '../gestures/terminal-link-activation'
import { handleOscLink } from '../terminal-osc-link-routing'
import {
  findHttpLinkAtTerminalMouseEvent,
  handleTerminalHttpLink
} from './terminal-url-link-hit-testing'
import type { HttpLinkSourceOwner } from '@/lib/browser/navigation/http-link-routing'
import type { TerminalLinkActionContext } from '../terminal-link-action-request'
import { classifyExternalAppUrl } from '../../../../../../shared/external-app-url'

type TerminalWebLinkClickDeps = Pick<
  LinkHandlerDeps,
  | 'worktreeId'
  | 'worktreePath'
  | 'startupCwd'
  | 'runtimeEnvironmentId'
  | 'terminalHomePath'
  | 'sourceTabId'
> & {
  terminal: Terminal | null
  sourceOwner?: HttpLinkSourceOwner
  requestOpenLinksInAppPreference?: TerminalLinkRoutingPreferenceRequester
  linkActionContext?: TerminalLinkActionContext | null
  actionDestinations?: TerminalHttpLinkActionDestinations
}

export function handleTerminalWebLinkClick(
  url: string,
  event: MouseEvent | undefined,
  deps: TerminalWebLinkClickDeps
): boolean {
  if (!event) {
    return false
  }

  // Why: custom OS handoff is Mod/Ctrl only. Plain click stays on the HTTP action
  // menu path and must not open a confirm dialog (#13225).
  const classified = classifyExternalAppUrl(url)
  if (classified.ok && classified.kind === 'custom') {
    if (!isTerminalLinkDirectActivation(event)) {
      return false
    }
    event.preventDefault()
    void Promise.resolve(window.api.shell.openUrl(classified.url)).catch(() => undefined)
    deps.terminal?.clearSelection()
    return true
  }

  if (!isTerminalOwnedLinkGesture(event)) {
    return false
  }

  let handled: boolean
  const completeUrl = deps.terminal ? findHttpLinkAtTerminalMouseEvent(deps.terminal, event) : null
  if (completeUrl) {
    handled = handleTerminalHttpLink(completeUrl, event, {
      worktreeId: deps.worktreeId,
      sourceTabId: deps.sourceTabId,
      sourceOwner:
        deps.sourceOwner ??
        (deps.runtimeEnvironmentId
          ? { kind: 'runtime', runtimeEnvironmentId: deps.runtimeEnvironmentId }
          : { kind: 'local' }),
      requestOpenLinksInAppPreference: deps.requestOpenLinksInAppPreference,
      linkActionContext: deps.linkActionContext,
      actionDestinations: deps.actionDestinations
    })
    // Use logical hit testing because WebLinksAddon knows only a physical row of wrapped URLs.
    event.preventDefault()
  } else {
    handled = handleOscLink(url, event, deps)
  }

  if (handled) {
    // Clear selection/listeners before navigation can steal focus ahead of xterm mouseup cleanup.
    deps.terminal?.clearSelection()
  }
  return handled
}
