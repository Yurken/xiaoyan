# 备份导出的数据库快照（2026-10-19）

## 问题与设计依据
export_all_data 原先按 BACKUP_TABLES 顺序逐表 fetch_all(&state.db)，各次 SELECT 之间还读取文件。没有贯穿所有表的读事务。生产数据库使用 WAL，连接池最多 5 个连接：如果导出读完 chat_sessions 后另一个连接提交新会话及其消息，随后导出读到 chat_messages，就可能包含消息却缺少对应会话。

SQLite 的 WAL 快照隔离属于同一个读事务；多个独立查询不会自动共用同一读取时点。采用普通 deferred 事务即可，不需要占用写事务。
依据：[SQLite 隔离说明](https://www.sqlite.org/isolation.html)、[SQLite 事务与 deferred 行为](https://www.sqlite.org/lang_transaction.html)。

## 改动
- 新增 settings_backup_snapshot：BackupSnapshot 持有由 pool.begin 得到的唯一事务；所有表经 &mut *tx 读取。首个 SELECT 建立数据库快照，后续表沿用该快照。
- 查询使用流式 fetch/try_next，逐行调用原 row_to_json 转换；不再同时保留整表 Vec<SqliteRow> 和转换后的 JSON 数组。NULL、字符串和数值转换保持原逻辑，没有改变同步模块复用的转换函数。
- read_backup_tables 全部成功后结束事务并返回表数据。任何开始、读取、转换或结束错误均返回 Err；未结束事务由 SQLx 的事务析构处理。原生未编译，此处为依据 API 文档及源码接线的设计说明。
- 数据库快照结束后才调用 collect_snapshot_assets。文件收集按原 BACKUP_TABLES 顺序遍历快照 JSON，保留共享源路径的首次引用、去重及外部文件回退命名。缺失/非法表或不可读附件都拒绝返回部分结果。
- RCBAK1、version 1、exported_at、tables/assets 结构、备份表范围、附件范围和加密算法不变。数据库内的会话、论文等数据继续由原恢复逻辑读取。
- 本地 data_backup_export 与整包 webdav_upload_backup 共用该修复。独立记录同步的 sync_service::build_snapshot 未改。
依据：[SQLx 0.8 Transaction](https://docs.rs/sqlx/0.8.6/sqlx/struct.Transaction.html)、[Pool::begin](https://docs.rs/sqlx/0.8.6/sqlx/struct.Pool.html#method.begin)。

## 待执行验证
新增 settings_backup_snapshot_tests.rs 的 5 个用例，使用合成内存库及唯一临时 WAL 数据库，覆盖实际 reader 在父/子表读取之间有另一连接提交时的快照保持，以及高层 read_backup_tables 的单连接池、空表、值转换、缺表错误和连接释放。并发场景使用明确的读取/写入 await 顺序，不依赖 sleep 或大数据概率竞争。

settings_backup_export_assets_tests.rs 补充 4 个用例，覆盖快照表顺序、共享外部路径去重、缺失/非法表、快照后附件消失及修复重试、空表集合。数据和文件均为未来测试创建的合成样本，本轮没有实际创建这些数据库或附件。

所有测试文件仅编写，全部未执行。遵守用户要求：不运行 test/typecheck/lint/build/浏览器/Rust 编译/真实备份恢复，不启动服务或容器，不读取真实用户数据库或资产。只做静态源码/测试审查与 Git 空白差异检查；不能据此声称测试或编译通过。

## 范围和资源边界
本切片保证导出查询使用同一数据库事务，并不把磁盘附件也变成同一时点的快照。事务结束后文件仍可能变化或消失；消失继续报错，内容变化不在 SQL 隔离范围内。exported_at 仍表示打包时刻，不能当作精确的首个 SELECT 时间。

连接只占用到全部数据库表读取完成，文件读取、JSON 序列化和加密在其后进行。全部 JSON、附件字节及 Base64 仍需内存；没有完成大型备份的流式加密或内存实测，也没有保证长时间读事务对 WAL checkpoint 完全无影响。

仅在 lab5090 现有分支本地提交，不推送、开 PR 或部署；依赖、锁文件、主分支和子模块固定提交保持原样。
