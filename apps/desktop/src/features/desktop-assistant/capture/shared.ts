import type { AssistantScreenshotRegion } from '../shared'

export interface CapturePrivacyCheck {
  allowed: boolean
  reason: string | null
  app_blocked: boolean
  app_not_allowed: boolean
  window_blocked: boolean
  content_sensitive: boolean
  content_redacted: boolean
  redaction_kinds: string[]
}

export interface CaptureConfirmationResponse {
  confirmed: boolean
  content: string | null
  reason: string | null
  privacy_check: CapturePrivacyCheck
}

export interface CaptureContextResponse {
  session_id: string
  content: string | null
  sanitized_content: string | null
  source_app: string | null
  source_app_bundle_id: string | null
  window_title: string | null
  capture_region?: AssistantScreenshotRegion | null
  original_character_count?: number | null
  content_truncated?: boolean
  status: string
  privacy_check: CapturePrivacyCheck | null
}
