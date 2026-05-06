/* ========================================
   PWSWORK - DASHBOARD MODULE
   Dashboard Statistics & Overview
   ======================================== */

const Dashboard = (() => {

    function init() {
        render();
    }

    function render() {
        renderTodaySchedule();
        renderTomorrowSchedule();
        renderMyAbsences();
        updateAdminVisibility();
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

    function renderMyAbsences() {
        const container = document.getElementById('dashboard-absences');
        if (!container) return;

        const user = Auth.getCurrentUser();
        const empId = user?.employeeId || user?.id;
        if (!empId) {
            container.innerHTML = '<div class="empty-state"><p>Effettua il login per vedere le tue assenze</p></div>';
            return;
        }

        // Get absences from Absences module cache
        const allAbsences = typeof Absences !== 'undefined' ? Absences.getAbsences() : [];
        const myAbsences = allAbsences.filter(a => a.employeeId === empId);
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filter absences that have at least one day in the current month
        const monthAbsences = myAbsences.filter(a => {
            return a.dates.some(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
            });
        });

        if (monthAbsences.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"/><path d="M9 9h6v6H9z"/></svg>
                    <p>Nessuna assenza programmata questo mese</p>
                </div>
            `;
            return;
        }

        // Count totals for the current month
        let totals = { ferie: 0, malattia: 0, permesso: 0 };
        monthAbsences.forEach(a => {
            const monthDates = a.dates.filter(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
            });
            if (totals[a.type] !== undefined) {
                totals[a.type] += monthDates.length;
            }
        });

        const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(now);

        let html = `
            <div class="dash-abs-summary">
                <div class="dash-abs-month-label">Riepilogo ${monthName.toUpperCase()}</div>
                <div class="dash-abs-grid">
                    <div class="dash-abs-item">
                        <span class="dash-abs-val">${totals.ferie}</span>
                        <span class="dash-abs-label">Ferie</span>
                    </div>
                    <div class="dash-abs-item">
                        <span class="dash-abs-val">${totals.malattia}</span>
                        <span class="dash-abs-label">Malattia</span>
                    </div>
                    <div class="dash-abs-item">
                        <span class="dash-abs-val">${totals.permesso}</span>
                        <span class="dash-abs-label">Permessi</span>
                    </div>
                </div>
            </div>
            <div class="dash-abs-list">
        `;

        // List specific segments
        monthAbsences.sort((a, b) => new Date(a.dates[0]) - new Date(b.dates[0])).forEach(a => {
            const monthDates = a.dates.filter(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
            });
            
            const datesFormatted = monthDates.map(d => Storage.formatDateIT(d)).join(', ');
            
            const typeInfo = {
                ferie: { label: 'Ferie', icon: '🏖️', color: 'var(--info)' },
                malattia: { label: 'Malattia', icon: '🤒', color: 'var(--danger)' },
                permesso: { label: 'Permesso', icon: '📋', color: 'var(--accent-primary)' }
            };
            const t = typeInfo[a.type] || { label: a.type, icon: '📅', color: 'var(--text-secondary)' };

            html += `
                <div class="dash-abs-row">
                    <div class="dash-abs-icon" style="background: ${t.color}">${t.icon}</div>
                    <div class="dash-abs-info">
                        <div class="dash-abs-type">${t.label}</div>
                        <div class="dash-abs-dates">${datesFormatted}</div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
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
        goToGroupDetail
    };
})();
