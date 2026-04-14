/* ========================================
   PWSWORK - DASHBOARD MODULE
   Dashboard Statistics & Overview
   ======================================== */

const Dashboard = (() => {

    function init() {
        render();
    }

    function render() {
        updateStats();
        renderTodaySchedule();
        renderTomorrowSchedule();
        updateAdminVisibility();
    }

    function updateStats() {
        const employees = Storage.getEmployees();
        const today = Storage.toLocalDateStr();
        const todayAssignments = Storage.getAssignmentsByDate(today);

        // Unique employees assigned today
        const assignedToday = new Set();
        let workplacesToday = 0;
        todayAssignments.forEach(a => {
            a.employeeIds.forEach(eid => assignedToday.add(eid));
            workplacesToday += a.workplaces.length;
        });

        // Count absent today
        let absentToday = 0;
        if (typeof Absences !== 'undefined') {
            employees.forEach(emp => {
                if (Absences.isEmployeeAbsent(emp.id, today)) absentToday++;
            });
        }

        // Week assignments count
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const weekAssignments = Storage.getAssignmentsByDateRange(
            Storage.toLocalDateStr(startOfWeek),
            Storage.toLocalDateStr(endOfWeek)
        );

        animateValue('stat-total-employees', employees.length);
        animateValue('stat-today-assigned', assignedToday.size);
        animateValue('stat-today-workplaces', workplacesToday);
        animateValue('stat-week-assignments', weekAssignments.length);
        animateValue('stat-today-absent', absentToday);
    }

    function animateValue(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        let current = 0;
        const duration = 800;
        const stepTime = 30;
        const steps = duration / stepTime;
        const increment = targetValue / steps;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= targetValue) {
                current = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, stepTime);
    }

    function renderTodaySchedule() {
        const container = document.getElementById('today-schedule');
        if (!container) return;

        const today = Storage.toLocalDateStr();
        const todayAssignments = Storage.getAssignmentsByDate(today);
        const currentUser = Storage.getCurrentUser();

        if (todayAssignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <p>Nessuna assegnazione per oggi</p>
                </div>
            `;
            return;
        }

        let html = '';
        todayAssignments.forEach((asgn, index) => {
            const team = asgn.employeeIds.map(eid => {
                const emp = Storage.getEmployee(eid);
                return emp ? `${emp.firstName} ${emp.lastName}` : '?';
            });

            const isCurrentUser = (currentUser?.employeeId || currentUser?.id) && asgn.employeeIds.includes(currentUser?.employeeId || currentUser?.id);

            const teamLabel = asgn.teamName || ('Gregge ' + (index + 1));

            html += `
                <div class="today-assignment-card stagger-item ${isCurrentUser ? 'highlight-own' : ''}" 
                     data-assignment-id="${asgn.id}" 
                     onclick="Dashboard.goToGroupDetail('${asgn.id}'); event.stopPropagation();"
                     style="animation-delay: ${index * 0.05}s; cursor: pointer;">
                    <div class="today-assignment-team-label">${teamLabel}</div>
                    <div class="today-assignment-team">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        <strong>${team.join(', ')}</strong>
                        ${isCurrentUser ? '<span class="own-badge">Tu</span>' : ''}
                    </div>
                    <div class="today-assignment-places">`;

            asgn.workplaces.forEach(wp => {
                const navUrl = wp.lat && wp.lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wp.address || wp.name)}`;
                const placeName = wp.name || 'Luogo di lavoro';
                const addressText = wp.address || wp.name || 'Apri indirizzo';

                html += `
                    <div class="today-workplace-row">
                        <span class="today-workplace-name">${placeName}</span>
                        <a href="${navUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="today-workplace-link" title="Apri navigatore verso ${addressText}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${addressText}
                        </a>
                    </div>`;
            });

            html += `</div>`;
            if (asgn.notes) {
                html += `<div class="today-assignment-notes">${asgn.notes}</div>`;
            }
            html += `</div>`;
        });

        container.innerHTML = html;
    }

    function renderTomorrowSchedule() {
        const container = document.getElementById('tomorrow-schedule');
        if (!container) return;

        const today = Storage.toLocalDateStr();
        const tomorrow = Storage.toLocalDateStr(new Date(new Date().getTime() + 86400000));
        const tomorrowAssignments = Storage.getAssignmentsByDate(tomorrow);
        const currentUser = Storage.getCurrentUser();

        if (tomorrowAssignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <p>Nessuna assegnazione per domani</p>
                </div>
            `;
            return;
        }

        let html = '';
        tomorrowAssignments.forEach((asgn, index) => {
            const team = asgn.employeeIds.map(eid => {
                const emp = Storage.getEmployee(eid);
                return emp ? `${emp.firstName} ${emp.lastName}` : '?';
            });

            const isCurrentUser = (currentUser?.employeeId || currentUser?.id) && asgn.employeeIds.includes(currentUser?.employeeId || currentUser?.id);

            const teamLabel = asgn.teamName || ('Gregge ' + (index + 1));

            html += `
                <div class="today-assignment-card stagger-item ${isCurrentUser ? 'highlight-own' : ''}" 
                     data-assignment-id="${asgn.id}" 
                     onclick="Dashboard.goToGroupDetail('${asgn.id}'); event.stopPropagation();"
                     style="animation-delay: ${index * 0.05}s; cursor: pointer;">
                    <div class="today-assignment-team-label">${teamLabel}</div>
                    <div class="today-assignment-team">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        <strong>${team.join(', ')}</strong>
                        ${isCurrentUser ? '<span class="own-badge">Tu</span>' : ''}
                    </div>
                    <div class="today-assignment-places">`;

            asgn.workplaces.forEach(wp => {
                const navUrl = wp.lat && wp.lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wp.address || wp.name)}`;
                const placeName = wp.name || 'Luogo di lavoro';
                const addressText = wp.address || wp.name || 'Apri indirizzo';

                html += `
                    <div class="today-workplace-row">
                        <span class="today-workplace-name">${placeName}</span>
                        <a href="${navUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="today-workplace-link" title="Apri navigatore verso ${addressText}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${addressText}
                        </a>
                    </div>`;
            });

            html += `</div>`;
            if (asgn.notes) {
                html += `<div class="today-assignment-notes">${asgn.notes}</div>`;
            }
            html += `</div>`;
        });

        container.innerHTML = html;
    }

    function updateAdminVisibility() {
        const isAdmin = Auth.isAdmin();
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
    }

    function goToGroupDetail(assignmentId) {
        // Salva l'ID del gruppo da aprire in Schedule
        sessionStorage.setItem('openGroupId', assignmentId);
        // Naviga a Schedule
        App.navigateTo('schedule');
    }

    return {
        init,
        render,
        updateStats,
        goToGroupDetail
    };
})();
