const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

export function resolveOpenAICompatibleUrl(baseUrl: string | undefined, path: string): string {
  const trimmedBase = (baseUrl?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const versionedBase = /\/v(?:1|1beta)$/.test(trimmedBase) ? trimmedBase : `${trimmedBase}/v1`;
  const pathWithoutVersion = normalizedPath.replace(/^\/v(?:1|1beta)(?=\/|$)/, "");
  return `${versionedBase}${pathWithoutVersion}`;
}

export function resolveOpenAIRealtimeUrl(baseUrl: string | undefined, path: string): string {
  return resolveOpenAICompatibleUrl(baseUrl, path)
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
}
