import {
  AssistantImageAssetsPanel,
  AssistantInboxWorkspace,
} from '../features/desktop-assistant/components'
import {
  useAssistantImageAssets,
  useAssistantInbox,
} from '../features/desktop-assistant/hooks'
import { FileShelfWorkspace, useFileShelf } from '../features/file-shelf'

export default function AssistantInbox() {
  const inbox = useAssistantInbox()
  const imageAssets = useAssistantImageAssets()
  const shelf = useFileShelf({ listenForDrops: true })
  return (
    <FileShelfWorkspace
      controller={shelf}
      secondaryContent={(
        <AssistantInboxWorkspace
          embedded
          controller={inbox}
          assetsPanel={<AssistantImageAssetsPanel controller={imageAssets} />}
        />
      )}
    />
  )
}
