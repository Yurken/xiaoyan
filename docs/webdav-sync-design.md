# WebDAV 无冲突同步设计与数据格式

本文档描述桌面端「自动同步（无冲突）」的实现与 WebDAV 上的数据格式，便于移动端等其它平台后续接入同一套同步协议。

## 目标

- 多设备共用同一个 WebDAV 账号即可自动同步，无需自建服务器。
- 不会互相覆盖、不丢数据；删除会传播；离线编辑后能正确收敛。
- 全程后台自动（启动 / 切回前台 / 每 5 分钟），凭据存于系统钥匙串。

## 核心思想：每设备独立状态文件 + 确定性合并

每台设备只写自己的状态文件，因此 WebDAV 上**永远不存在对同一文件的并发写**，从根本上消除「丢更新」。设备之间通过确定性合并收敛：

- **记录级 Last-Write-Wins**：按主键比较时间戳，新者整条胜出。
- **墓碑传播删除**：删除记录为墓碑随快照分发，避免被旧数据「复活」。
- 这是一种状态型 CRDT（grow-only 行集合 + 每行 LWW 寄存器 + 墓碑集合），可交换、幂等、收敛，无需锁。

> 语义边界：同一条记录在两端并发改不同字段时，时间戳新的整条胜出（字段级合并不在范围内）。

## WebDAV 目录布局

```
<webdav-root>/xiaoyan-sync/
  devices/{device_id}.rcstate   # 本设备完整快照（仅本设备写）
  assets/{sha256}.rcblob        # 不可变资产（PDF 等），内容寻址、一次写入、去重
```

- `device_id`：每台设备首次同步时生成的 UUID，持久化在本地 `sync_meta`。
- 所有 `.rcstate` 与 `.rcblob` 均以 WebDAV 密码经 **AES-256-GCM（PBKDF2-HMAC-SHA256, 600k 轮）** 加密，魔数 `RCSYN1`，与设置导出 / 备份共用同一加解密实现。

## 状态文件（.rcstate）结构

解密后为 JSON：

```jsonc
{
  "version": 1,
  "device_id": "<uuid>",
  "generated_at": "YYYY-MM-DD HH:MM:SS",
  "tables": {                      // 表名 -> 行数组（行为对象）
    "papers": [ { "id": "...", "title": "...", "updated_at": "...", "file_path": "asset://<sha256>" } ],
    "settings": [ { "key": "...", "value": "...", "updated_at": "..." } ]
  },
  "tombstones": [ { "table": "papers", "id": "p1", "deleted_at": "YYYY-MM-DD HH:MM:SS" } ],
  "assets": { "<sha256>": ".pdf" } // 资产哈希 -> 扩展名
}
```

约定：

- 同步的表集合 = 桌面端 `BACKUP_TABLES`（与整库备份一致）。
- 主键：`settings` 用 `key`，其余用 `id`（均为跨设备唯一的 UUID/字符串）。
- 合并时钟列：可变表用 `updated_at`，纯追加表用 `created_at`。
- 资产列（`papers/paper_figures/experiment_attachments` 的 `file_path`）在快照里替换为 `asset://<sha256>` 引用；合并时按需从 `assets/` 下载并落地到本地 `app_data_dir/sync_assets/`。
- 大且可本地再生的列（如 `paper_chunks.embedding`、`knowledge_notes.embedding`）不进入快照，以控制体积；新设备合并后按需重算。
- 设备本地专属设置键（如应用锁相关）不参与同步。

## 本地元数据（SQLite）

- `sync_tombstones(entity_table, entity_id, deleted_at)`：删除墓碑。
- `sync_meta(key, value)`：保存 `device_id`、各表「行 id 基线」（用于删除检测）、`last_push_hash` 等。
- 可变同步表统一保证有 `updated_at` 列，并安装 `AFTER INSERT/UPDATE` 触发器自动刷新，使同步时钟独立于具体业务写入路径。

## 一次同步流程

1. **删除检测**：对比上次基线与当前行集合，消失的 id 生成墓碑。
2. **上传资产**：列出 `assets/` 已有 blob，上传缺失项。
3. **推送快照**：内容相对上次有变化时，写 `devices/{device_id}.rcstate`。
4. **拉取**：下载其它设备的 `.rcstate`。
5. **合并**（单事务，按外键依赖顺序）：先应用墓碑删除，再 LWW upsert；资产按引用下载落地。
6. **收尾**：刷新基线与设置缓存，向前端广播 `sync://status`。

## 移动端接入要点

移动端只需实现同一套：相同目录布局、相同加密（密码=WebDAV 密码）、相同状态文件结构与合并规则即可与桌面端互通。其本地存储字段需对齐 `BACKUP_TABLES` 的主键与时间戳列约定。
