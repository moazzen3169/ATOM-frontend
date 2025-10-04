# TODO: Implement User Dashboard Teams and Tournament History

## Tasks
- [x] Add fetchUserTeams function to fetch user's teams from /api/users/teams/
- [x] Add displayUserTeams function to populate #teams_container with team cards
- [x] Add fetchTournamentHistory function to fetch user's match history from /api/users/users/{user.id}/match-history/
- [x] Add displayTournamentHistory function to populate #tournaments_history_body with match rows
- [x] Ensure all functions have proper error handling and use the token for auth
- [ ] Test the implementation by running the dashboard page

## Notes
- Assume API returns sufficient data for display (e.g., match includes tournament name, game name, score, rank, etc.)
- Use existing token and user object from the code
- Follow the existing code style and error handling pattern
