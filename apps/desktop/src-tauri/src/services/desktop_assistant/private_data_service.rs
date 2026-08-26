//! Explicit user-triggered clearing of assistant-private temporary data and image assets.

use std::path::Path;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use super::image_asset_service::AssistantImageAssetService;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClearedAssistantPrivateData {
    pub capture_sessions: u32,
    pub image_assets: u32,
    pub file_previews: u32,
}

pub struct AssistantPrivateDataService;

impl AssistantPrivateDataService {
    pub async fn clear(
        db: &SqlitePool,
        app_data_dir: &Path,
    ) -> Result<ClearedAssistantPrivateData> {
        let image_assets = AssistantImageAssetService::delete_all(db, app_data_dir).await?;
        let mut transaction = db.begin().await?;
        let capture_sessions = sqlx::query("DELETE FROM assistant_capture_sessions")
            .execute(&mut *transaction)
            .await?
            .rows_affected()
            .min(u32::MAX as u64) as u32;
        let file_previews =
            sqlx::query("DELETE FROM assistant_file_candidates WHERE status = 'preview'")
                .execute(&mut *transaction)
                .await?
                .rows_affected()
                .min(u32::MAX as u64) as u32;
        // 匿名本地指标同属助手私有数据，随一键清理一并删除。
        sqlx::query("DELETE FROM assistant_metric_events")
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;

        Ok(ClearedAssistantPrivateData {
            capture_sessions,
            image_assets,
            file_previews,
        })
    }
}
