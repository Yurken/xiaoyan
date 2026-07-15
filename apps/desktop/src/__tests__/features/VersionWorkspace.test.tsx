import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@testing-library/user-event";
import VersionWorkspace from "../../features/submission/VersionWorkspace";
import type { PaperVersion, Submission } from "../../features/submission/shared";
import { render, screen } from "../helpers/render";

const submission: Submission = {
  id: "submission-1",
  title: "论文 A",
  venue: "CHI",
  venueType: "conference",
  status: "writing",
};

const version: PaperVersion = {
  id: "version-1",
  submissionId: submission.id,
  tag: "v1",
  label: "初稿",
  stage: "writing",
  content: "abstract",
  notes: "",
  createdAt: new Date("2026-07-14T08:00:00Z"),
};

describe("VersionWorkspace", () => {
  it("允许修改已保存版本的显示标签", async () => {
    const onRenameVersion = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(
      <VersionWorkspace
        submissions={[submission]}
        versions={[version]}
        versionCounts={{ [submission.id]: 1 }}
        versionSubId={submission.id}
        compareIds={null}
        renamingVersionId={null}
        onSelectSubmission={vi.fn()}
        onSetCompareIds={vi.fn()}
        onOpenSaveModal={vi.fn()}
        onRenameVersion={onRenameVersion}
        onUploadVersionFile={vi.fn()}
        onDownloadVersionFile={vi.fn()}
        onPolishVersion={vi.fn()}
        onOpenMockReview={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重命名" }));
    const input = screen.getByRole("textbox", { name: "版本标签" });
    await user.clear(input);
    await user.type(input, "返修稿");
    await user.click(screen.getByRole("button", { name: "保存名称" }));

    expect(onRenameVersion).toHaveBeenCalledWith("version-1", "返修稿");
  });
});
