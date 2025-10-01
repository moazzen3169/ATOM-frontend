# Auth Pages Fixes TODO

## High Priority
- [x] Fix reset_password_confirm.html: Fix undefined variables (resetForm, uid, token), add password match validation, remove sensitive tokens from URL after use

## Medium Priority
- [ ] Fix signup.html: Remove unused OTP handlers, fix phone validation regex and normalization, unify link paths
- [ ] Fix login.html: Remove user identifier from URL query string, store in sessionStorage, add referrer-policy meta, remove unused constants
- [ ] Fix otp.html: Enable paste event handler for 6-digit code, add autocomplete="one-time-code", improve resend limit UI
- [ ] Fix forget-password.html: Use generic success/failure messages to avoid enumeration, remove unused step indicator UI

## Cross-Cutting Issues
- [ ] Security: Add Content-Security-Policy and referrer policy meta tags, remove localStorage token storage (recommend HttpOnly Secure cookies)
- [ ] Accessibility: Add labels and aria attributes, support prefers-reduced-motion to disable Vanta background
- [ ] UX: Standardize error messages and loading states, prevent double submissions, unify navigation paths
- [ ] Performance: Lazy-load background animations, consolidate repeated CSS/JS into shared files
