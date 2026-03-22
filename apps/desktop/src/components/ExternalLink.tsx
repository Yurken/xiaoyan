import type { ReactNode } from "react";
import { clsx } from "clsx";
import { openLink } from "../lib/links";

interface ExternalLinkProps {
  href?: string | null;
  children: ReactNode;
  className?: string;
  title?: string;
}

export default function ExternalLink({ href, children, className, title }: ExternalLinkProps) {
  const value = href?.trim();

  if (!value) {
    return <span className={className} title={title}>{children}</span>;
  }

  return (
    <a
      href={value}
      title={title}
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
