import { setupTeamsPageInteractions } from './user-dashboard.js';

function initializeTeamsPage() {
    if (!window.location.pathname.includes('teams')) {
        return;
    }

    setupTeamsPageInteractions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTeamsPage);
} else {
    initializeTeamsPage();
}
