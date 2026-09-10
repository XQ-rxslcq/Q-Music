/** 自定义协议：本机文件 ↔ qmusic:// URL（可移植，不写死盘符规则） */
export function toMediaUrl(filePath: string): string {
  return `qmusic://local/${encodeURIComponent(filePath)}`
}

export function fromMediaUrl(url: string): string {
  const prefix = 'qmusic://local/'
  if (!url.startsWith(prefix)) return url
  return decodeURIComponent(url.slice(prefix.length))
}
