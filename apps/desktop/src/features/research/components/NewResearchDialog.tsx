/**
 * 新建研究弹窗
 */
import { useState, useRef } from 'react'
import { X, Upload, FileText } from 'lucide-react'
import { Card, CardHeader, CardTitle, IconButton, Button, Input, Textarea } from '@research-copilot/ui'
import { DEPTH_OPTIONS, LANGUAGE_OPTIONS } from '../shared'
import type { BackendResearchQuestion } from '../services/backend'

interface NewResearchDialogProps {
  show: boolean
  onClose: () => void
  onCreate: (payload: BackendResearchQuestion, files: File[]) => Promise<void>
}

export function NewResearchDialog({ show, onClose, onCreate }: NewResearchDialogProps) {
  const [title, setTitle] = useState('')
  const [field, setField] = useState('')
  const [subfield, setSubfield] = useState('')
  const [description, setDescription] = useState('')
  const [depth, setDepth] = useState<BackendResearchQuestion['depth']>('standard')
  const [iterations, setIterations] = useState(3)
  const [language, setLanguage] = useState<BackendResearchQuestion['language']>('zh')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!show) return null

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('请输入研究标题')
      return
    }

    setIsSubmitting(true)
    try {
      await onCreate(
        {
          title: title.trim(),
          field: field.trim(),
          subfield: subfield.trim(),
          description: description.trim(),
          depth,
          iterations,
          language,
        },
        files
      )
      // 重置表单
      setTitle('')
      setField('')
      setSubfield('')
      setDescription('')
      setDepth('standard')
      setIterations(3)
      setLanguage('zh')
      setFiles([])
      onClose()
    } catch (err) {
      console.error('Failed to create research:', err)
      alert(err instanceof Error ? err.message : '创建失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--rc-modal-backdrop)' }}
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg"
        padding="md"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="mb-4 px-0 pt-0">
          <CardTitle>新建研究</CardTitle>
          <IconButton size="sm" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </CardHeader>

        <div className="space-y-4">
          {/* 研究标题 */}
          <Input
            label="研究标题 *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：大语言模型在学术写作中的应用"
          />

          {/* 领域和子领域 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="研究领域"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="例如：计算机科学"
            />
            <Input
              label="子领域"
              value={subfield}
              onChange={(e) => setSubfield(e.target.value)}
              placeholder="例如：自然语言处理"
            />
          </div>

          {/* 研究描述 */}
          <Textarea
            label="研究描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="详细描述你的研究问题和目标..."
          />

          {/* 研究深度 */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              研究深度
            </label>
            <div className="flex gap-2">
              {DEPTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDepth(opt.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-center text-xs"
                  style={{
                    background: depth === opt.value ? 'var(--rc-info-chip-bg)' : 'var(--rc-control-bg)',
                    color: depth === opt.value ? 'var(--rc-info-chip-text)' : 'var(--rc-text-muted)',
                    border: `1px solid ${depth === opt.value ? 'var(--rc-info-chip-border)' : 'var(--rc-control-border)'}`,
                  }}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="mt-0.5 opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 迭代次数和语言 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="迭代次数"
              type="number"
              value={iterations}
              onChange={(e) => setIterations(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              min={1}
              max={10}
            />
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                研究语言
              </label>
              <div className="flex gap-2">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLanguage(opt.value)}
                    className="flex-1 rounded-xl px-3 py-2 text-center text-sm"
                    style={{
                      background: language === opt.value ? 'var(--rc-info-chip-bg)' : 'var(--rc-control-bg)',
                      color: language === opt.value ? 'var(--rc-info-chip-text)' : 'var(--rc-text-muted)',
                      border: `1px solid ${language === opt.value ? 'var(--rc-info-chip-border)' : 'var(--rc-control-border)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 文件上传 */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              参考材料（可选）
            </label>
            <div
              className="cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center"
              style={{
                borderColor: 'var(--rc-control-border)',
                background: 'var(--rc-control-bg)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} className="mx-auto mb-2" style={{ color: 'var(--rc-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                点击上传 PDF、Word 或文本文件
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1"
                    style={{ background: 'var(--rc-chip-bg)' }}
                  >
                    <FileText size={12} style={{ color: 'var(--rc-accent)' }} />
                    <span className="flex-1 truncate text-xs" style={{ color: 'var(--rc-text)' }}>
                      {file.name}
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-xs"
                      style={{ color: 'var(--rc-text-muted)' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={!title.trim()}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? '创建中...' : '创建研究'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
