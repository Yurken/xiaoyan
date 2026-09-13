import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { writePersistentValue } from '../../../hooks/usePersistentStringState'
import { safeListen } from '../../../lib/tauriEvent'
import { COPILOT_LAST_SESSION_KEY } from '../../copilot/sessionKeys'

interface AssistantConversationHandoffEvent {
  conversation_id: string
}

export function useAssistantConversationHandoff() {
  const navigate = useNavigate()

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void safeListen<AssistantConversationHandoffEvent>(
      'assistant:open-conversation',
      (event) => {
        const conversationId = event.payload.conversation_id?.trim()
        if (!conversationId) return
        writePersistentValue(COPILOT_LAST_SESSION_KEY, conversationId)
        navigate('/chat', {
          state: { assistantConversationId: conversationId },
        })
      },
    ).then((cleanup) => {
      if (disposed) cleanup()
      else unlisten = cleanup
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [navigate])
}
