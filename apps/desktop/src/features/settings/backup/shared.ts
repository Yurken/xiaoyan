// 与 Rust settings_service::BACKUP_TABLES 和 settings_backup_export_assets::collect_row_assets 的范围一致。
export const DATA_BACKUP_SCOPE = '配置与历史、论文及图表、知识笔记、会话与记忆、投稿、实验记录与附件'
export const DATA_BACKUP_EXCLUSIONS = '暂不包含写作草稿与版本、阅读批注与语料摘录、实验快照、桌面助手资产和文件中转站内容。文件备份仅覆盖可读取的论文 PDF、论文图表和实验附件。'
export const DATA_BACKUP_EXPORT_NOTICE = `${DATA_BACKUP_EXCLUSIONS}已关联文件无法读取时将取消导出，请恢复文件或修正文件引用后重试。`
export const DATA_BACKUP_EXPORT_WARNING = `备份包含${DATA_BACKUP_SCOPE}及 API Key，请妥善保管。${DATA_BACKUP_EXPORT_NOTICE}`
export const DATA_BACKUP_IMPORT_WARNING = '导入将覆盖备份范围内的本机数据。当前备份不包含阅读批注、语料与实验快照；如果恢复会影响未备份的关联记录，小妍会阻止导入。'
