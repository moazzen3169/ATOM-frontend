# TODO: Fix Verification Issues

## VER-001: Align Level 2 File Selectors
- [x] Change selfie input ID in verification.html from "selfy_picturse" to "selfy_picture_level2"
- [x] Ensure JS selectors match

## VER-002: Fix Level 3 Form IDs
- [x] Change video input ID in verification.html from "selfy_picturse" to "selfy_video_level3"
- [x] Change video info div ID from "selfy_info" to "video_info"

## VER-003: Add Authentication Error Handling
- [x] Check for access_token before API calls, redirect if missing
- [x] Handle 401/403 responses by clearing token and redirecting to login
