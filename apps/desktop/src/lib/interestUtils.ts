/**
 * 统一的研究主题文件夹显示名称：优先使用 folder_name，回退到 topic。
 */
export function interestFolderName(interest: {
  folder_name?: string;
  topic: string;
}): string {
  return interest.folder_name?.trim() || interest.topic;
}
