import {
  type HttpLinkSourceOwner,
  resolveLocalhostHttpLinkDisplayUrl
} from '@/lib/browser/navigation/http-link-routing'
import { classifyExternalAppUrl } from '../../../../../shared/external-app-url'
import { getTerminalCustomAppSchemeOpenHint } from './terminal-link-open-hints'

export async function formatTerminalUrlTooltip(
  url: string,
  openLinkHint: string,
  sourceOwner: HttpLinkSourceOwner
): Promise<string | null> {
  const classified = classifyExternalAppUrl(url)
  if (classified.ok && classified.kind === 'custom') {
    // Why: custom schemes never use Orca/browser routing; avoid HTTP-style hints (#13225).
    return `${url} (${getTerminalCustomAppSchemeOpenHint()})`
  }
  const labeledUrl = await resolveLocalhostHttpLinkDisplayUrl(url, sourceOwner)
  if (!labeledUrl) {
    return null
  }
  try {
    const originalHost = new URL(url).host
    return `${labeledUrl} (${originalHost}; ${openLinkHint})`
  } catch {
    return `${labeledUrl} (${openLinkHint})`
  }
}
