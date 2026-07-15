import type { ResearchInterest } from "@research-copilot/types";
import { Select } from "@research-copilot/ui";
import { buildInterestOptions } from "./shared";

interface FieldDynamicsFiltersProps {
  interests: ResearchInterest[];
  interestId: string;
  onInterestChange: (value: string) => void;
}

export function FieldDynamicsFilters({
  interests,
  interestId,
  onInterestChange,
}: FieldDynamicsFiltersProps) {
  const interestOptions = buildInterestOptions(interests).map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <Select
      value={interestId}
      onChange={onInterestChange}
      options={interestOptions}
      aria-label="筛选兴趣"
      className="w-48"
    />
  );
}
