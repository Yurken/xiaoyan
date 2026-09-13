import type {
  AssistantDataPolicy,
  ImportConfig,
  ImportRetentionPolicy,
  ImportTarget,
} from './shared'

export function defaultImportRetentionPolicy(
  retentionDays: AssistantDataPolicy['inbox_retention_days'],
): Exclude<ImportRetentionPolicy, 'permanent'> {
  if (retentionDays === 1) return '1_day'
  if (retentionDays === 30) return '30_days'
  if (retentionDays === null) return 'manual'
  return '7_days'
}

export function importStorageLabel(target: ImportTarget): string {
  switch (target) {
    case 'image':
      return '小妍本地应用数据 / assistant_images'
    case 'later':
      return '小妍本地数据库 / 稍后处理箱'
    case 'paper':
      return '小妍本地数据库 / 论文导入候选'
    case 'note':
      return '小妍本地数据库 / 知识笔记'
  }
}

export function estimateImportBytes(
  content: string,
  originalContent: string | undefined,
  config: Pick<ImportConfig, 'target' | 'preserveOriginal'>,
): number {
  const primary = config.target === 'image' ? originalContent ?? content : content
  let bytes = encodedContentBytes(primary)
  if (
    config.target !== 'image'
    && config.preserveOriginal
    && originalContent
    && originalContent !== content
    && !originalContent.startsWith('data:image/')
  ) {
    bytes += encodedContentBytes(originalContent)
  }
  return bytes
}

function encodedContentBytes(content: string): number {
  if (!content.startsWith('data:')) return new TextEncoder().encode(content).byteLength
  const comma = content.indexOf(',')
  if (comma < 0) return new TextEncoder().encode(content).byteLength
  const encoded = content.slice(comma + 1).replace(/\s/g, '')
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding)
}

export function formatImportBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
