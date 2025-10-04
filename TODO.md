# TODO: Update user-dashboard.js with new APIs

## Completed Tasks
- [x] Analyze current user-dashboard.js code
- [x] Read user-dashboard/index.html structure
- [x] Create comprehensive plan for updates

## Pending Tasks
- [x] Refactor loadDashboardData() to use single GET /api/users/dashboard/ API
- [x] Update display functions to work with unified API response structure
- [x] Add createTeam() function for POST /api/users/teams/
- [x] Add editTeam() function for PUT /api/users/teams/{id_team}/
- [x] Add deleteTeam() function for DELETE /api/users/teams/{id_team}/
- [x] Add addTeamMember() function for POST /api/users/teams/{id_team}/add-member/
- [x] Add removeTeamMember() function for POST /api/users/teams/{id_team}/remove-member/
- [x] Add logoutUser() function for frontend logout (clear tokens)
- [x] Add event listeners for team management actions
- [x] Update displayUserTeams() to include edit/delete buttons
- [x] Remove unused functions (fetchUserTeams, fetchTournamentHistory, fetchUserFromAuth)
- [x] Update displayUserProfile() to match API response structure (user_profile, teams.length, tournament_history.length)
- [ ] Test all functions with proper error handling
- [ ] Ensure token refresh works for all API calls
