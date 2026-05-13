import { useEffect, useState } from "react";
import { submissionApi } from "../../lib/client";
import { rowToVersion, type PaperVersion, type Submission as SubmissionItem } from "./shared";

type VersionsBySubmission = Record<string, PaperVersion[]>;

export function useSubmissionVersions(
  submissions: SubmissionItem[],
  selectedSubmissionId: string,
  onError?: (error: unknown) => void,
) {
  const [versionsBySubmission, setVersionsBySubmission] = useState<VersionsBySubmission>({});

  useEffect(() => {
    if (submissions.length === 0) {
      setVersionsBySubmission({});
      return;
    }

    let cancelled = false;

    Promise.allSettled(
      submissions.map(async (submission) => {
        const response = await submissionApi.listVersions(submission.id);
        return {
          submissionId: submission.id,
          versions: (response.versions as unknown[]).map(rowToVersion),
        };
      })
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        setVersionsBySubmission((currentVersions) => {
          const nextVersions: VersionsBySubmission = {};

          results.forEach((result, index) => {
            const submissionId = submissions[index]?.id;
            if (!submissionId) {
              return;
            }

            if (result.status === "fulfilled") {
              nextVersions[submissionId] = result.value.versions;
              return;
            }

            onError?.(result.reason);
            nextVersions[submissionId] = currentVersions[submissionId] ?? [];
          });

          return nextVersions;
        });
      })
      .catch((error) => {
        onError?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [submissions, onError]);

  const versions = selectedSubmissionId ? versionsBySubmission[selectedSubmissionId] ?? [] : [];
  const versionCounts = submissions.reduce<Record<string, number>>((counts, submission) => {
    counts[submission.id] = versionsBySubmission[submission.id]?.length ?? 0;
    return counts;
  }, {});

  const appendVersion = (version: PaperVersion) => {
    setVersionsBySubmission((currentVersions) => ({
      ...currentVersions,
      [version.submissionId]: [...(currentVersions[version.submissionId] ?? []), version],
    }));
  };

  const updateVersion = (versionId: string, updater: (version: PaperVersion) => PaperVersion) => {
    setVersionsBySubmission((currentVersions) =>
      Object.fromEntries(
        Object.entries(currentVersions).map(([submissionId, versions]) => [
          submissionId,
          versions.map((version) => (version.id === versionId ? updater(version) : version)),
        ])
      ) as VersionsBySubmission
    );
  };

  const patchVersion = async (
    versionId: string,
    patch: Partial<Pick<PaperVersion, "tag" | "label" | "stage" | "content" | "notes" | "filePath" | "fileName">>
  ) => {
    const previousVersion = Object.values(versionsBySubmission)
      .flat()
      .find((version) => version.id === versionId);
    updateVersion(versionId, (version) => ({ ...version, ...patch }));
    await submissionApi.updateVersion(versionId, patch).catch((error) => {
      if (previousVersion) {
        updateVersion(versionId, (version) => {
          const stillOptimistic = (Object.entries(patch) as Array<[keyof typeof patch, unknown]>)
            .every(([key, value]) => version[key] === value);
          return stillOptimistic ? previousVersion : version;
        });
      }
      onError?.(error);
      throw error;
    });
  };

  return { versions, versionCounts, appendVersion, updateVersion, patchVersion };
}
