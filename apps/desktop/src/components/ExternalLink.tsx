import type { CSSProperties, ReactNode } from "react";
import { clsx } from "clsx";
import { openLink } from "../lib/links";

interface ExternalLinkProps {
  href?: string | null;
  children: ReactNode;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

export default function ExternalLink({ href, children, className, title, style }: ExternalLinkProps) {
  const value = href?.trim();

  if (!value) {
    return <span className={className} style={style} title={title}>{children}</span>;
  }

  return (
    <a
      href={value}
      title={title}
      style={style}
      rel="noreferrer"
      className={clsx("cursor-pointer", className)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void openLink(value);
      }}
    >
      {children}
    </a>
  );
}
