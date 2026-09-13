import CompanionRenderer from "../features/companion/CompanionRenderer";
import { useAssistantDockVisibility } from "../features/desktop-assistant/hooks";

export default function XiaoYanPet({ inline = false }: { inline?: boolean } = {}) {
  const { isDockVisible } = useAssistantDockVisibility();

  // 桌面小妍出现后，主窗口内的角色退场；关闭桌面显示后再回到窗口。
  if (isDockVisible) return null;

  return <CompanionRenderer inline={inline} />;
}
