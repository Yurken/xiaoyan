import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistentStringState } from '../../hooks/usePersistentStringState'
import { SETTINGS_ACTIVE_SECTION_STORAGE_KEY, SETTINGS_SECTIONS, type SettingsSectionKey } from './pageConfig'

const sectionKeys = SETTINGS_SECTIONS.map((section) => section.key)

export function useSettingsSection() {
  const location = useLocation()
  const selection = usePersistentStringState<SettingsSectionKey>(SETTINGS_ACTIVE_SECTION_STORAGE_KEY, 'assistant', sectionKeys)
  const [, setSection] = selection
  useEffect(() => {
    const requested = (location.state as { settingsSection?: SettingsSectionKey } | null)?.settingsSection
    if (requested && sectionKeys.includes(requested)) setSection(requested)
  }, [location.key, location.state, setSection])
  return selection
}
