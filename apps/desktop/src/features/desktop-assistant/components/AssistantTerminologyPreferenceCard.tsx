import { useMemo, useState } from 'react'
import { Save, X } from 'lucide-react'
import { Button } from '@research-copilot/ui'
import {
  ASSISTANT_TRANSLATION_LANGUAGES,
  type AssistantTerminologyPreference,
  type AssistantTranslationTargetLanguage,
} from '../shared'

interface AssistantTerminologyPreferenceCardProps {
  preferences: AssistantTerminologyPreference[]
  targetLanguage: AssistantTranslationTargetLanguage
  saving?: boolean
  disabled?: boolean
  error?: string | null
  onSave: (
    sourceTerm: string,
    preferredTranslation: string,
    targetLanguage: AssistantTranslationTargetLanguage,
  ) => Promise<boolean> | boolean
  onRemove: (
    sourceTerm: string,
    targetLanguage: AssistantTranslationTargetLanguage,
  ) => Promise<boolean> | boolean
}

const inputStyle = {
  background: 'var(--rc-control-bg)',
  borderColor: 'var(--rc-control-border)',
  color: 'var(--rc-text)',
}

export function AssistantTerminologyPreferenceCard({
  preferences,
  targetLanguage,
  saving = false,
  disabled = false,
  error,
  onSave,
  onRemove,
}: AssistantTerminologyPreferenceCardProps) {
  const [sourceTerm, setSourceTerm] = useState('')
  const [preferredTranslation, setPreferredTranslation] = useState('')
  const languageLabel = ASSISTANT_TRANSLATION_LANGUAGES.find(
    (language) => language.value === targetLanguage,
  )?.label ?? targetLanguage
  const recentPreferences = useMemo(
    () => preferences
      .filter((preference) => preference.target_language === targetLanguage)
      .slice(0, 4),
    [preferences, targetLanguage],
  )

  const submit = async () => {
    const source = sourceTerm.trim()
    const preferred = preferredTranslation.trim()
    if (!source || !preferred || disabled || saving) return
    if (await onSave(source, preferred, targetLanguage)) {
      setSourceTerm('')
      setPreferredTranslation('')
    }
  }

  return (
    <section
      aria-label="固定术语译法"
      className="mb-4 rounded-xl border px-3 py-3"
      style={{ borderColor: 'var(--rc-border)' }}
    >
      <div className="text-xs font-medium" style={{ color: 'var(--rc-text)' }}>
        固定术语译法 · {languageLabel}
      </div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--rc-text-muted)' }}>
        遇到多种译法时，保存你选定的表达；后续原文命中该术语时会优先采用。
      </p>

      <form
        className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <input
          aria-label="原术语"
          value={sourceTerm}
          onChange={(event) => setSourceTerm(event.target.value)}
          placeholder="原术语"
          maxLength={120}
          disabled={disabled || saving}
          className="min-w-0 rounded-xl border px-2 py-1.5 text-xs outline-none"
          style={inputStyle}
        />
        <input
          aria-label="选定译法"
          value={preferredTranslation}
          onChange={(event) => setPreferredTranslation(event.target.value)}
          placeholder="选定译法"
          maxLength={120}
          disabled={disabled || saving}
          className="min-w-0 rounded-xl border px-2 py-1.5 text-xs outline-none"
          style={inputStyle}
        />
        <Button
          type="submit"
          size="sm"
          aria-label="保存术语偏好"
          disabled={!sourceTerm.trim() || !preferredTranslation.trim() || disabled || saving}
        >
          <Save size={12} />
        </Button>
      </form>

      {recentPreferences.length > 0 && (
        <ul aria-label="已保存术语偏好" className="mt-2 space-y-1">
          {recentPreferences.map((preference) => (
            <li
              key={`${preference.target_language}:${preference.source_term.toLocaleLowerCase()}`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]"
              style={{ background: 'var(--rc-control-bg)', color: 'var(--rc-text)' }}
            >
              <span className="min-w-0 flex-1 truncate">
                {preference.source_term} → {preference.preferred_translation}
              </span>
              <button
                type="button"
                aria-label={`删除术语偏好：${preference.source_term}`}
                disabled={disabled || saving}
                onClick={() => void onRemove(preference.source_term, targetLanguage)}
                className="rounded p-0.5 disabled:opacity-50"
                style={{ color: 'var(--rc-text-muted)' }}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px]" style={{ color: 'var(--rc-danger, #D92B21)' }}>
          {error}
        </p>
      )}
    </section>
  )
}
