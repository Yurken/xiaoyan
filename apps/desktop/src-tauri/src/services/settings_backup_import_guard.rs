use sqlx::SqliteConnection;
use std::collections::BTreeMap;

#[derive(sqlx::FromRow)]
struct ForeignKeyColumn {
    id: i64,
    parent: String,
    child_column: String,
    parent_column: Option<String>,
    on_delete: String,
}

struct ForeignKeyReference {
    parent: String,
    columns: Vec<(String, Option<String>)>,
    on_delete: String,
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn asset_label(table: &str) -> &str {
    match table {
        "paper_notes" => "阅读批注",
        "paper_corpus" => "语料摘录",
        "experiment_snapshots" => "实验快照",
        _ => table,
    }
}

/// Inspect the same transaction connection before any backed-up table is cleared.
/// Unlisted rows with no matching parent (including global corpus) are unaffected.
pub(crate) async fn ensure_backup_import_preserves_unlisted_assets(
    connection: &mut SqliteConnection,
    backup_tables: &[&str],
) -> Result<(), String> {
    let is_backed_up = |table: &str| {
        backup_tables
            .iter()
            .any(|backed_up| backed_up.eq_ignore_ascii_case(table))
    };
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("备份导入保护检查失败: {error}"))?;
    let mut affected_assets = Vec::new();
    for table in tables.into_iter().filter(|table| !is_backed_up(table)) {
        let rows = sqlx::query_as::<_, ForeignKeyColumn>(
            "SELECT id, \"table\" AS parent, \"from\" AS child_column, \"to\" AS parent_column, on_delete FROM pragma_foreign_key_list(?) ORDER BY id, seq",
        )
        .bind(&table)
        .fetch_all(&mut *connection)
        .await
        .map_err(|error| format!("备份导入关联检查失败（{table}）: {error}"))?;
        let mut references = BTreeMap::<i64, ForeignKeyReference>::new();
        for row in rows {
            let reference = references
                .entry(row.id)
                .or_insert_with(|| ForeignKeyReference {
                    parent: row.parent,
                    columns: Vec::new(),
                    on_delete: row.on_delete,
                });
            reference
                .columns
                .push((row.child_column, row.parent_column));
        }
        let mut predicates = Vec::new();
        for reference in references.values().filter(|reference| {
            is_backed_up(&reference.parent)
                && matches!(
                    reference.on_delete.as_str(),
                    "CASCADE" | "SET NULL" | "SET DEFAULT"
                )
        }) {
            let implicit_parent_columns: Vec<String> =
                if reference.columns.iter().any(|(_, to)| to.is_none()) {
                    sqlx::query_scalar(
                        "SELECT name FROM pragma_table_info(?) WHERE pk > 0 ORDER BY pk",
                    )
                    .bind(&reference.parent)
                    .fetch_all(&mut *connection)
                    .await
                    .map_err(|error| {
                        format!("备份导入主键检查失败（{}）: {error}", reference.parent)
                    })?
                } else {
                    Vec::new()
                };
            let comparisons = reference
                .columns
                .iter()
                .enumerate()
                .map(|(index, (from, to))| {
                    let to = to
                        .as_ref()
                        .or_else(|| implicit_parent_columns.get(index))
                        .ok_or_else(|| {
                            format!("备份导入保护无法确定 {table} 的关联主键，已取消导入")
                        })?;
                    Ok(format!(
                        "parent.{} = child.{}",
                        quote_identifier(to),
                        quote_identifier(from)
                    ))
                })
                .collect::<Result<Vec<_>, String>>()?;
            predicates.push(format!(
                "EXISTS (SELECT 1 FROM {} AS parent WHERE {})",
                quote_identifier(&reference.parent),
                comparisons.join(" AND ")
            ));
        }
        if predicates.is_empty() {
            continue;
        }
        // OR counts a row once even when multiple foreign keys will be affected.
        let count: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} AS child WHERE {}",
            quote_identifier(&table),
            predicates.join(" OR ")
        ))
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| format!("备份导入资产检查失败（{table}）: {error}"))?;
        if count > 0 {
            affected_assets.push(format!("{} {count} 条", asset_label(&table)));
        }
    }
    if affected_assets.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "已取消备份导入：替换备份范围会删除或修改未备份的本机资产（{}）。当前备份未覆盖这些资产，无法安全覆盖；现有数据未更改。",
            affected_assets.join("、")
        ))
    }
}

#[cfg(test)]
#[path = "settings_backup_import_guard_tests.rs"]
mod tests;
