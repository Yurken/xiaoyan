use std::{
    sync::OnceLock,
    time::{Duration, Instant},
};

use tokio::sync::Mutex;

const SEMANTIC_SCHOLAR_MIN_INTERVAL: Duration = Duration::from_secs(1);

static SEMANTIC_SCHOLAR_RATE_LIMITER: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

/// Semantic Scholar applies a cumulative 1 request/second limit across endpoints.
pub async fn throttle_semantic_scholar_request() {
    let limiter = SEMANTIC_SCHOLAR_RATE_LIMITER.get_or_init(|| Mutex::new(None));
    let mut last_request_at = limiter.lock().await;

    if let Some(previous) = *last_request_at {
        let elapsed = previous.elapsed();
        if elapsed < SEMANTIC_SCHOLAR_MIN_INTERVAL {
            tokio::time::sleep(SEMANTIC_SCHOLAR_MIN_INTERVAL - elapsed).await;
        }
    }

    *last_request_at = Some(Instant::now());
}
