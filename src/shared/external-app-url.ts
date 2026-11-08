import { PROSE_URL_AFTER_SCHEME_SOURCE } from './prose-url-boundary'

/**
 * Classify URLs for shell handoff. http(s) stay on the existing path;
 * other schemes need an explicit user-approved openExternal (#13225).
 */

// Why: hard-deny schemes that can hand off to shell/exec paths even after a
// confirm (Follina-style / UNC / JNLP). User cancel is not enough (#13225).
const DENIED_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:',
  'chrome:',
  'chrome-extension:',
  'ms-appx:',
  'ms-appx-web:',
  'smb:',
  'jnlp:',
  'ms-msdt:',
  'search-ms:',
  'search:',
  'shell:',
  'hcp:',
  'ms-appinstaller:',
  'ms-its:',
  'ms-help:',
  'ms-cxh:',
  'ms-cxh-full:',
  'jar:',
  'view-source:'
])

export type ExternalAppUrlClassification =
  | { ok: true; kind: 'http'; url: string; protocol: string }
  | { ok: true; kind: 'custom'; url: string; protocol: string; schemeLabel: string }
  | { ok: false; reason: 'invalid' | 'denied' | 'unsupported' }

/** Match http(s) and custom app schemes like obsidian://, vscode:// in terminal text. */
// Why: the url body reuses the terminal HTTP pattern (IPv6 hosts, prose punctuation).
// No `i` flag, so custom schemes stay lowercase-only (`Error://` is log noise) while
// http(s) keeps any case. Lookbehind prevents mid-token restarts (file → ile://);
// negative lookahead skips denied schemes so they are not underlined as dead links (#13225).
export const TERMINAL_WEB_AND_APP_URL_REGEX = new RegExp(
  String.raw`(?<![a-zA-Z0-9+.-])(?:[Hh][Tt][Tt][Pp][Ss]?|(?!(?:javascript|data|vbscript|file|about|blob|chrome-extension|chrome|ms-appx-web|ms-appx|smb|jnlp|ms-msdt|search-ms|search|shell|hcp|ms-appinstaller|ms-its|ms-help|ms-cxh-full|ms-cxh|jar|view-source)(?![a-zA-Z0-9+.-]))[a-z][a-z0-9+.-]{1,31})${PROSE_URL_AFTER_SCHEME_SOURCE}`,
  'u'
)

export function classifyExternalAppUrl(rawUrl: string): ExternalAppUrlClassification {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { ok: false, reason: 'invalid' }
  }
  const rawScheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]
  if (rawScheme && !/^(?:https?)$/i.test(rawScheme) && rawScheme !== rawScheme.toLowerCase()) {
    return { ok: false, reason: 'unsupported' }
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  const protocol = parsed.protocol.toLowerCase()
  if (protocol === 'http:' || protocol === 'https:') {
    return { ok: true, kind: 'http', url: parsed.toString(), protocol }
  }
  if (DENIED_PROTOCOLS.has(protocol)) {
    return { ok: false, reason: 'denied' }
  }
  // Why: scheme must look like an app protocol (letters + optional +.-), not a
  // single-letter drive-style or empty host with no path (noise from false matches).
  if (!/^[a-z][a-z0-9+.-]*:$/i.test(protocol) || protocol.length < 3) {
    return { ok: false, reason: 'unsupported' }
  }
  if (!parsed.hostname && !parsed.pathname && !parsed.search && !parsed.hash) {
    return { ok: false, reason: 'invalid' }
  }
  const schemeLabel = protocol.slice(0, -1)
  return {
    ok: true,
    kind: 'custom',
    url: parsed.toString(),
    protocol,
    schemeLabel
  }
}
