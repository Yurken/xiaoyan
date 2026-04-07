import { useMemo, useState } from "react";
import { friendLinkSectionId } from "./shared";
import { YANWEB_FRIEND_LINK_SECTIONS } from "../../lib/yanweb-links";

export function useFriendLinks() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(YANWEB_FRIEND_LINK_SECTIONS.map((section, index) => [section.title, index === 0])),
  );

  const allExpanded = useMemo(
    () => YANWEB_FRIEND_LINK_SECTIONS.every((section) => openSections[section.title]),
    [openSections],
  );

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const setAllSections = (open: boolean) => {
    setOpenSections(Object.fromEntries(YANWEB_FRIEND_LINK_SECTIONS.map((section) => [section.title, open])));
  };

  const revealSection = (title: string, index: number) => {
    setOpenSections((prev) => ({ ...prev, [title]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(friendLinkSectionId(index))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return {
    panelProps: {
      openSections,
      allExpanded,
      onToggleAll: () => setAllSections(!allExpanded),
      onRevealSection: revealSection,
      onToggleSection: toggleSection,
    },
  };
}
