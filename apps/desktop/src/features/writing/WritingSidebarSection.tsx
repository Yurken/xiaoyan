import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

interface WritingSidebarSectionProps {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function WritingSidebarSection({
  title,
  icon,
  badge,
  action,
  children,
  defaultOpen = true,
  className,
}: WritingSidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={clsx(
        "writing-sidebar-section",
        !isOpen && "writing-sidebar-section--collapsed",
        className,
      )}
    >
      <div className="writing-sidebar-section__header">
        <button
          type="button"
          className="writing-sidebar-section__toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <span className="writing-sidebar-section__identity">
            <span className="writing-sidebar-section__icon">{icon}</span>
            <span className="writing-sidebar-section__title">{title}</span>
            {badge}
          </span>
          <span
            className={clsx(
              "writing-sidebar-section__chevron",
              !isOpen && "writing-sidebar-section__chevron--collapsed",
            )}
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4" />
          </span>
        </button>
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {action}
        </div>
      </div>

      {isOpen && <div className="writing-sidebar-section__content">{children}</div>}
    </section>
  );
}
