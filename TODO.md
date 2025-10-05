# TODO: Fix Tournament Join Verification Issue

## Tasks
- [x] Modify `checkIndividualConditions` in js/loby.js to properly enforce verification check and show error if not verified
- [x] Add verification check to `joinTeamTournament` function in js/loby.js
- [ ] Test the join functionality after changes

## Notes
- The error "You do not have the required verification level to join this tournament." is coming from the backend API
- Currently, the frontend allows join even if verification fails, but backend rejects it
- Need to enforce verification on frontend to prevent unnecessary API calls and show proper error messages
