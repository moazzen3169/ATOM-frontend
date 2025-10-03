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

## API URL Refactoring
- [x] Modify js/config.js to export API_BASE_URL
- [x] Refactor js/auth.js: add import, remove const, update URLs
- [x] Refactor js/slider-items.js: add import, update fetch URLs
- [x] Refactor js/wallet.js: add import, update fetch URLs
- [x] Refactor js/tournaments.js: add import, update new URL
- [x] Refactor js/loby.js: add import, update apiFetch URLs
- [x] Refactor js/index.js: add import, update fetch URLs
- [x] Refactor js/header.js: add import, update fetch URLs
- [x] Refactor js/games.js: add import, update fetch URLs
- [x] Refactor js/game-touranments.js: add import, update fetch URLs
- [x] Refactor register/signup.html: add type="module", import, remove const, update URLs
- [x] Refactor register/reset_password_confirm.html: add type="module", import, remove const, update URLs
- [x] Refactor register/otp.html: add type="module", import, remove const, update URLs
- [x] Refactor register/login.html: add type="module", import, remove const, update URLs
- [x] Refactor register/forget-password.html: add type="module", import, remove const, update URLs
