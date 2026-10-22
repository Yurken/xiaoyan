import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { safeListen } from '../../../lib/tauriEvent'

export function useAssistantSettingsHandoff() {
  const navigate = useNavigate()
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void safeListen('assistant:open-settings', () => {
      navigate('/settings', { state: { settingsSection: 'desktop_assistant' } })
    }).then((stop) => {
      if (disposed) stop()
      else unlisten = stop
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [navigate])
}
