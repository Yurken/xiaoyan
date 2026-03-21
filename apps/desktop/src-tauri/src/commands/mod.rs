pub mod chat;
pub mod knowledge;
pub mod misc;
pub mod papers;
pub mod settings;

// Re-export extract_json_pub so knowledge.rs can call it
pub use papers::extract_json_pub;
