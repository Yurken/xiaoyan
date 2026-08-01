import {
  AssistantImageAssetsPanel,
  AssistantInboxWorkspace,
} from '../features/desktop-assistant/components'
import {
  useAssistantImageAssets,
  useAssistantInbox,
} from '../features/desktop-assistant/hooks'

export default function AssistantInbox() {
  const inbox = useAssistantInbox()
  const imageAssets = useAssistantImageAssets()
  return (
    <AssistantInboxWorkspace
      controller={inbox}
      assetsPanel={<AssistantImageAssetsPanel controller={imageAssets} />}
    />
  )
}
