import { describe, expect, it } from 'vitest'
import { fileShelfVisualKind, formatShelfBytes, type FileShelfItem } from '../../../features/file-shelf/shared'

function item(fileName: string, isDirectory = false): FileShelfItem {
  return {
    id: 'item-1',
    file_name: fileName,
    is_directory: isDirectory,
    size_bytes: 1024,
    source_type: 'drag',
    available: true,
    created_at: '2026-09-13 10:00:00',
    last_copied_at: null,
  }
}

describe('file shelf shared helpers', () => {
  it('maps common file kinds without restricting accepted extensions', () => {
    expect(fileShelfVisualKind(item('paper.pdf'))).toBe('pdf')
    expect(fileShelfVisualKind(item('figure.webp'))).toBe('image')
    expect(fileShelfVisualKind(item('dataset', true))).toBe('folder')
    expect(fileShelfVisualKind(item('model.weights'))).toBe('file')
  })

  it('formats folder and large file sizes', () => {
    expect(formatShelfBytes(0, true)).toBe('空文件夹')
    expect(formatShelfBytes(1024 ** 3)).toBe('1.0 GB')
  })
})
