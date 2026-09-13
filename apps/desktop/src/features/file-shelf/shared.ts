export type FileShelfSource = 'drag' | 'clipboard' | 'picker'

export interface FileShelfItem {
  id: string
  file_name: string
  is_directory: boolean
  size_bytes: number
  source_type: FileShelfSource
  available: boolean
  created_at: string
  last_copied_at: string | null
}

export interface RejectedShelfItem {
  file_name: string
  reason: string
}

export interface FileShelfStashResult {
  items: FileShelfItem[]
  rejected: RejectedShelfItem[]
}

export type FileShelfVisualKind =
  | 'folder'
  | 'image'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'code'
  | 'file'

const EXTENSION_KINDS: Partial<Record<string, FileShelfVisualKind>> = {
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image',
  doc: 'document', docx: 'document', pages: 'document', txt: 'document', md: 'document', rtf: 'document',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  js: 'code', jsx: 'code', ts: 'code', tsx: 'code', py: 'code', rs: 'code', go: 'code', java: 'code',
}

export function fileShelfVisualKind(item: FileShelfItem): FileShelfVisualKind {
  if (item.is_directory) return 'folder'
  const extension = item.file_name.split('.').pop()?.toLocaleLowerCase() ?? ''
  return EXTENSION_KINDS[extension] ?? 'file'
}

export function formatShelfBytes(bytes: number, isDirectory = false) {
  if (bytes === 0 && isDirectory) return '空文件夹'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export function formatShelfDate(value: string) {
  const normalized = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat('zh-CN', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  ).format(date)
}

export const FILE_SHELF_SOURCE_LABELS: Record<FileShelfSource, string> = {
  drag: '拖入小妍',
  clipboard: '来自剪贴板',
  picker: '手动添加',
}
