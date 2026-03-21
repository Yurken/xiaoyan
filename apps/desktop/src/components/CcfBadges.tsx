import { Badge } from "@research-copilot/ui";

export function ccfRatingVariant(rating?: string): "success" | "info" | "warning" | "default" {
  if (rating === "A") return "success";
  if (rating === "B") return "info";
  if (rating === "C") return "warning";
  return "default";
}

export function ccfTypeLabel(type?: string): string {
  if (type === "journal") return "期刊";
  if (type === "conference") return "会议";
  return "";
}

export function CcfRatingBadge({ rating }: { rating?: string }) {
  if (!rating) return null;
  return <Badge variant={ccfRatingVariant(rating)}>CCF {rating}</Badge>;
}

export function VenueTypeBadge({ type }: { type?: string }) {
  const label = ccfTypeLabel(type);
  if (!label) return null;
  return <Badge variant="default">{label}</Badge>;
}
