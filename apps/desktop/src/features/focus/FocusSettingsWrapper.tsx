import Settings from "../../pages/Settings";
import FocusPageFrame from "./FocusPageFrame";

export default function FocusSettingsWrapper() {
  return (
    <FocusPageFrame title="设置" settings={false}>
      <Settings />
    </FocusPageFrame>
  );
}
