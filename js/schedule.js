/* ========================================
   PWSWORK - SCHEDULE MODULE
   Workplace Assignment Management
   with Google Maps Integration
   ======================================== */

const Schedule = (() => {
    let currentWeekStart = null;
    let editingAssignmentId = null;
    let assignmentViewMode = 'admin';
    let viewMode = 'week';
    let workplaceCounter = 0;

    // Google Maps state
    let mapInstance = null;
    let mapMarker = null;
    let autocomplete = null;
    let selectedPlace = null;
    let activeWorkplaceIndex = null;

    function init() {
        currentWeekStart = getMonday(new Date());
        bindEvents();
        render();
    }

    function bindEvents() {
        const prevBtn = document.getElementById('prev-week');
        const nextBtn = document.getElementById('next-week');
        if (prevBtn) prevBtn.addEventListener('click', prevPeriod);
        if (nextBtn) nextBtn.addEventListener('click', nextPeriod);

        const form = document.getElementById('assignment-form');
        if (form) form.addEventListener('submit', handleSubmit);

        const empFilter = document.getElementById('schedule-employee-filter');
        if (empFilter) empFilter.addEventListener('change', render);

        const viewModeSelect = document.getElementById('schedule-view-mode');
        if (viewModeSelect) viewModeSelect.addEventListener('change', (e) => {
            viewMode = e.target.value;
            render();
        });

        // Re-render on resize/orientation change for responsive layout
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(render, 250);
        });

        updateEmployeeFilter();
    }

    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function prevPeriod() {
        if (viewMode === 'month') {
            currentWeekStart.setMonth(currentWeekStart.getMonth() - 1);
        } else {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        }
        render();
    }

    function nextPeriod() {
        if (viewMode === 'month') {
            currentWeekStart.setMonth(currentWeekStart.getMonth() + 1);
        } else {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
        render();
    }

    function render() {
        updateWeekLabel();
        if (viewMode === 'week') {
            renderWeekView();
        } else {
            renderMonthView();
        }

        consumePendingGroupOpen();
    }

    function consumePendingGroupOpen() {
        const openGroupId = sessionStorage.getItem('openGroupId');
        if (!openGroupId) return;

        sessionStorage.removeItem('openGroupId');

        setTimeout(() => {
            openGroupDetail(openGroupId);
        }, 50);
    }

    function updateWeekLabel() {
        const label = document.getElementById('current-week-label');
        if (!label) return;

        if (viewMode === 'month') {
            label.textContent = currentWeekStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        } else {
            const endOfWeek = new Date(currentWeekStart);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            const startStr = currentWeekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
            const endStr = endOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
            label.textContent = `${startStr} - ${endStr}`;
        }
    }

    // ==================== WEEK VIEW ====================
    function renderWeekView() {
        const container = document.getElementById('schedule-container');
        if (!container) return;

        const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        const today = Storage.toLocalDateStr();
        const isAdmin = Auth.isAdmin();
        const currentUser = Storage.getCurrentUser();
        const filterValue = document.getElementById('schedule-employee-filter')?.value || 'all';

        // Build week dates
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            weekDates.push(Storage.toLocalDateStr(d));
        }

        // Get all assignments for this week
        let assignments = Storage.getAssignmentsByDateRange(weekDates[0], weekDates[6]);

        // Filter by employee if needed
        if (filterValue !== 'all') {
            assignments = assignments.filter(a => a.employeeIds.includes(filterValue));
        }

        // Detect current employee ID for highlighting
        const myEmployeeId = currentUser?.employeeId || currentUser?.id || null;

        let html = '<div class="week-grid">';

        weekDates.forEach((dateStr, i) => {
            const isToday = dateStr === today;
            const d = new Date(dateStr + 'T00:00:00');
            const dayAssignments = assignments.filter(a => a.date === dateStr);

            const holidayInfo = Storage.isHoliday(dateStr);

            html += `<div class="week-day-col ${isToday ? 'today-col' : ''} ${holidayInfo ? 'holiday-col' : ''}">
                <div class="week-day-header ${isToday ? 'today' : ''} ${holidayInfo ? 'holiday' : ''}">
                    <span class="day-name">${dayNames[i]}${holidayInfo ? ' 🔴' : ''}</span>
                    <span class="day-date">${d.getDate()}</span>
                    ${holidayInfo ? `<span class="holiday-name">${holidayInfo.name}</span>` : ''}
                </div>
                <div class="week-day-body" ${isAdmin && dayAssignments.length === 0 ? `onclick="Schedule.openModal(null, '${dateStr}')"` : ''} style="${isAdmin || dayAssignments.length > 0 ? 'cursor:pointer;' : ''}">`;

            // Show absent employees for this day
            if (typeof Absences !== 'undefined') {
                const employees = Storage.getEmployees();
                const absentToday = employees.filter(emp => Absences.isEmployeeAbsent(emp.id, dateStr));
                if (absentToday.length > 0) {
                    html += `<div class="day-absences-bar">`;
                    absentToday.forEach(emp => {
                        const absInfo = Absences.isEmployeeAbsent(emp.id, dateStr);
                        const typeInfo = Absences.ABSENCE_TYPES[absInfo.type] || Absences.ABSENCE_TYPES.ferie;
                        html += `<span class="day-absence-chip" style="background:${typeInfo.colorLight};color:${typeInfo.color}" title="${emp.firstName} ${emp.lastName} — ${typeInfo.label}">${typeInfo.icon} ${emp.firstName[0]}${emp.lastName[0]}</span>`;
                    });
                    html += `</div>`;
                }
            }

            if (dayAssignments.length === 0) {
                if (isAdmin) {
                    html += `<div class="add-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span class="add-hint-text">Aggiungi squadra</span>
                    </div>`;
                } else {
                    html += `<div class="no-assignment">—</div>`;
                }
            } else {
                dayAssignments.forEach((asgn, asgnIdx) => {
                    const empNames = asgn.employeeIds.map(eid => {
                        const emp = Storage.getEmployee(eid);
                        return emp ? `${emp.firstName} ${emp.lastName[0]}.` : '?';
                    });
                    const teamLabel = asgn.teamName || ('Gregge ' + (asgnIdx + 1));
                    const isMySquad = myEmployeeId && asgn.employeeIds.includes(myEmployeeId);

                    const cardClick = isAdmin ? `Schedule.openModal('${asgn.id}')` : `Schedule.openDetailModal('${asgn.id}')`;
                    html += `<div class="assignment-card${isMySquad ? ' my-squad' : ''}" onclick="event.stopPropagation(); ${cardClick}">
                        <div class="assignment-team-label">${teamLabel}</div>
                        <div class="assignment-team">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            <span>${empNames.join(', ')}</span>
                        </div>`;

                    asgn.workplaces.forEach(wp => {
                        const navUrl = wp.lat && wp.lng
                            ? `https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wp.address || wp.name)}`;

                        html += `<div class="assignment-workplace">
                            <a href="${navUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="workplace-link" title="Naviga verso ${wp.name}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                ${wp.name}
                            </a>
                        </div>`;
                    });

                    if (asgn.notes) {
                        html += `<div class="assignment-note">${asgn.notes}</div>`;
                    }

                    html += `</div>`;
                });

                // Add button for admin to create another squad on the same day
                if (isAdmin) {
                    html += `<div class="add-squad-btn" onclick="event.stopPropagation(); Schedule.openModal(null, '${dateStr}')" title="Aggiungi un'altra squadra">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>`;
                }
            }

            html += `</div></div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // ==================== MONTH VIEW ====================
    function renderMonthView() {
        const container = document.getElementById('schedule-container');
        if (!container) return;

        const year = currentWeekStart.getFullYear();
        const month = currentWeekStart.getMonth();
        const today = Storage.toLocalDateStr();
        const isAdmin = Auth.isAdmin();
        const currentUser = Storage.getCurrentUser();
        const filterValue = document.getElementById('schedule-employee-filter')?.value || 'all';

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startStr = Storage.toLocalDateStr(firstDay);
        const endStr = Storage.toLocalDateStr(lastDay);

        let assignments = Storage.getAssignmentsByDateRange(startStr, endStr);
        if (filterValue !== 'all') {
            assignments = assignments.filter(a => a.employeeIds.includes(filterValue));
        }

        const isMobile = window.innerWidth <= 768;

        const myEmpId = currentUser?.employeeId || currentUser?.id || null;

        if (isMobile) {
            container.innerHTML = renderMonthListView(year, month, lastDay, today, isAdmin, assignments, myEmpId);
        } else {
            container.innerHTML = renderMonthTableView(year, month, firstDay, lastDay, today, isAdmin, assignments, myEmpId);
        }
    }

    // Desktop: classic table grid
    function renderMonthTableView(year, month, firstDay, lastDay, today, isAdmin, assignments, myEmpId) {
        const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        let html = '<table class="schedule-table month-table"><thead><tr>';
        dayNames.forEach(d => html += `<th>${d}</th>`);
        html += '</tr></thead><tbody>';

        let startDow = firstDay.getDay();
        if (startDow === 0) startDow = 7;
        startDow -= 1;

        html += '<tr>';
        for (let i = 0; i < startDow; i++) {
            html += '<td class="empty-day"></td>';
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const holidayInfo = Storage.isHoliday(dateStr);
            const isSun = new Date(dateStr + 'T00:00:00').getDay() === 0;
            const dayAssignments = assignments.filter(a => a.date === dateStr);

            const monthCellClick = isAdmin ? `Schedule.openModal(null, '${dateStr}')` : (dayAssignments.length > 0 ? `Schedule.openDetailModalByDate('${dateStr}')` : '');
            html += `<td class="month-cell ${isToday ? 'today-col' : ''} ${holidayInfo ? 'holiday-cell' : ''} ${isSun ? 'sunday-cell' : ''}" 
                         ${monthCellClick ? `onclick="${monthCellClick}"` : ''}
                         style="vertical-align:top; ${monthCellClick ? 'cursor:pointer;' : ''}">
                <div class="month-day-num ${isToday ? 'today-num' : ''} ${holidayInfo ? 'holiday-num' : ''}">${day}${holidayInfo ? ' 🔴' : ''}</div>
                ${holidayInfo ? `<div class="month-holiday-label">${holidayInfo.name}</div>` : ''}`;

            dayAssignments.forEach((asgn, asgnIdx) => {
                const teamLabel = asgn.teamName || ('Gregge ' + (asgnIdx + 1));
                const teamCount = asgn.employeeIds.length;
                const wpCount = asgn.workplaces.length;
                const isMySquad = myEmpId && asgn.employeeIds.includes(myEmpId);
                const dotClick = isAdmin ? `Schedule.openModal('${asgn.id}')` : `Schedule.openDetailModal('${asgn.id}')`;
                html += `<div class="month-assignment-dot${isMySquad ? ' my-squad' : ''}" 
                              onclick="event.stopPropagation(); ${dotClick}"
                              title="${teamLabel}: ${teamCount} dipendente/i → ${wpCount} posto/i di lavoro">
                    <span class="month-team-name">${teamLabel}</span>
                    <span>👷 ${teamCount} 📍 ${wpCount}</span>
                </div>`;
            });

            html += `</td>`;

            const dow = new Date(dateStr + 'T00:00:00').getDay();
            if (dow === 0 && day < lastDay.getDate()) html += '</tr><tr>';
        }

        const endDow = lastDay.getDay();
        if (endDow !== 0) {
            for (let i = endDow; i < 7; i++) {
                html += '<td class="empty-day"></td>';
            }
        }

        html += '</tr></tbody></table>';
        return html;
    }

    // Mobile: vertical list view
    function renderMonthListView(year, month, lastDay, today, isAdmin, assignments, myEmpId) {
        const dayNamesFull = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        let html = '<div class="month-list">';

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const d = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = d.getDay();
            const holidayInfo = Storage.isHoliday(dateStr);
            const dayAssignments = assignments.filter(a => a.date === dateStr);

            // Skip days without assignments (unless today, admin, or holiday)
            if (dayAssignments.length === 0 && !isToday && !isAdmin && !holidayInfo) continue;

            const dayName = dayNamesFull[dayOfWeek];

            html += `<div class="month-list-day ${isToday ? 'month-list-today' : ''} ${dayAssignments.length === 0 ? 'month-list-empty' : ''} ${holidayInfo ? 'month-list-holiday' : ''}">`;
            html += `<div class="month-list-day-header" ${isAdmin && dayAssignments.length === 0 ? `onclick="Schedule.openModal(null, '${dateStr}')"` : ''}>`;
            html += `<div class="month-list-date">`;
            html += `<span class="month-list-day-num">${day}</span>`;
            html += `<span class="month-list-day-name">${dayName}${holidayInfo ? ` — 🔴 ${holidayInfo.name}` : ''}</span>`;
            html += `</div>`;

            if (dayAssignments.length > 0) {
                html += `<span class="month-list-badge">${dayAssignments.length} squadr${dayAssignments.length === 1 ? 'a' : 'e'}</span>`;
            } else if (isAdmin) {
                html += `<span class="month-list-add">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </span>`;
            }
            html += `</div>`;

            if (dayAssignments.length > 0) {
                html += `<div class="month-list-squads">`;
                dayAssignments.forEach((asgn, asgnIdx) => {
                    const teamLabel = asgn.teamName || ('Gregge ' + (asgnIdx + 1));
                    const empNames = asgn.employeeIds.map(eid => {
                        const emp = Storage.getEmployee(eid);
                        return emp ? `${emp.firstName} ${emp.lastName[0]}.` : '?';
                    });
                    const wpNames = asgn.workplaces.map(wp => wp.name).join(', ');
                    const cardClick = isAdmin ? `Schedule.openModal('${asgn.id}')` : `Schedule.openDetailModal('${asgn.id}')`;
                    const isMySquad = myEmpId && asgn.employeeIds.includes(myEmpId);

                    html += `<div class="month-list-squad-card${isMySquad ? ' my-squad' : ''}" onclick="${cardClick}">`;
                    html += `<div class="month-list-squad-name">${teamLabel}</div>`;
                    html += `<div class="month-list-squad-info">`;
                    html += `<div class="month-list-squad-row">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        <span>${empNames.join(', ')}</span>
                    </div>`;
                    html += `<div class="month-list-squad-row">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>${wpNames}</span>
                    </div>`;
                    html += `</div></div>`;
                });

                // Add squad button for admin
                if (isAdmin) {
                    html += `<div class="month-list-add-squad" onclick="Schedule.openModal(null, '${dateStr}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Aggiungi squadra</span>
                    </div>`;
                }
                html += `</div>`;
            }

            html += `</div>`;
        }

        html += '</div>';
        return html;
    }

    // ==================== MODAL (Assignment) ====================
    function openModal(assignmentId = null, date = null) {
        if (!Auth.isAdmin()) return;

        editingAssignmentId = assignmentId;
        assignmentViewMode = 'admin';
        workplaceCounter = 0;
        const modal = document.getElementById('assignment-modal');
        const title = document.getElementById('assignment-modal-title');
        const form = document.getElementById('assignment-form');
        const deleteBtn = document.getElementById('delete-assignment-btn');
        const workplacesList = document.getElementById('workplaces-list');

        form.reset();
        workplacesList.innerHTML = '';
        populateEmployeeCheckboxes();

        if (assignmentId) {
            const asgn = Storage.getAssignment(assignmentId);
            if (!asgn) return;

            title.textContent = 'Modifica Squadra';
            document.getElementById('assignment-id').value = asgn.id;
            document.getElementById('assignment-date').value = asgn.date;
            document.getElementById('assignment-team-name').value = asgn.teamName || '';
            document.getElementById('assignment-notes').value = asgn.notes || '';

            // Check employees
            asgn.employeeIds.forEach(eid => {
                const cb = document.querySelector(`#employee-multiselect input[value="${eid}"]`);
                if (cb) cb.checked = true;
            });

            // Add workplace fields
            asgn.workplaces.forEach(wp => {
                addWorkplaceField(wp);
            });

            deleteBtn.style.display = '';
        } else {
            title.textContent = 'Nuova Squadra';
            document.getElementById('assignment-id').value = '';
            document.getElementById('assignment-date').value = date || Storage.toLocalDateStr();
            // Auto-generate team name based on existing assignments for this date
            const existingDate = date || Storage.toLocalDateStr();
            const existing = Storage.getAssignmentsByDate(existingDate);
            document.getElementById('assignment-team-name').value = 'Gregge ' + (existing.length + 1);
            addWorkplaceField(); // At least one empty workplace
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
        updateAssignmentViewModeUI();
    }

    function closeModal() {
        document.getElementById('assignment-modal').classList.remove('active');
        editingAssignmentId = null;
        assignmentViewMode = 'admin';
    }

    function toggleAssignmentViewMode() {
        assignmentViewMode = assignmentViewMode === 'admin' ? 'worker' : 'admin';
        updateAssignmentViewModeUI();
    }

    function updateAssignmentViewModeUI() {
        const modal = document.getElementById('assignment-modal');
        const title = document.getElementById('assignment-modal-title');
        const form = document.getElementById('assignment-form');
        const detailView = document.getElementById('assignment-detail-view');
        const topToggle = document.getElementById('assignment-mode-toggle');
        const footerToggle = document.getElementById('assignment-footer-mode-btn');

        if (!modal || !form || !detailView) return;

        const workerMode = assignmentViewMode === 'worker';
        modal.dataset.viewMode = assignmentViewMode;

        if (title) {
            title.textContent = workerMode ? 'Vista Lavoratore' : (editingAssignmentId ? 'Modifica Squadra' : 'Nuova Squadra');
        }
        if (topToggle) {
            topToggle.textContent = workerMode ? 'Modifica' : 'Vista Lavoratore';
        }
        if (footerToggle) {
            footerToggle.textContent = workerMode ? 'Modifica' : 'Vista Lavoratore';
        }

        // Toggle form and detail view visibility
        form.style.display = workerMode ? 'none' : 'block';
        detailView.style.display = workerMode ? 'block' : 'none';

        // If switching to worker mode, populate the detail view
        if (workerMode && editingAssignmentId) {
            renderAssignmentDetailView(editingAssignmentId);
        }
    }

    function renderAssignmentDetailView(assignmentId) {
        const asgn = Storage.getAssignment(assignmentId);
        if (!asgn) return;

        const detailView = document.getElementById('assignment-detail-view');
        
        const teamMembers = asgn.employeeIds.map(eid => {
            const emp = Storage.getEmployee(eid);
            return emp ? { name: emp.firstName + ' ' + emp.lastName, position: emp.position || '', phone: emp.phone || '' } : null;
        }).filter(Boolean);

        let html = '<div class="assignment-detail-content">';
        
        // Team section
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
        html += ' Membri</div>';
        html += '<div class="detail-team-list">';

        teamMembers.forEach(function(member) {
            var initials = member.name.split(' ').map(function(n) { return n[0]; }).join('');
            html += '<div class="detail-team-member">';
            html += '<div class="detail-member-avatar">' + initials + '</div>';
            html += '<div class="detail-member-info">';
            html += '<div class="detail-member-name">' + member.name + '</div>';
            if (member.position) {
                html += '<div class="detail-member-role">' + member.position + '</div>';
            }
            html += '</div>';
            if (member.phone) {
                html += '<a href="tel:' + member.phone + '" class="detail-member-phone" title="Chiama ' + member.name + '">';
                html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
                html += '</a>';
            }
            html += '</div>';
        });

        html += '</div></div>';

        // Workplaces section
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
        html += ' Posti di Lavoro</div>';
        html += '<div class="detail-workplaces-list">';

        asgn.workplaces.forEach(function(wp) {
            var navUrl = (wp.lat && wp.lng)
                ? 'https://www.google.com/maps/dir/?api=1&destination=' + wp.lat + ',' + wp.lng
                : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(wp.address || wp.name);

            html += '<div class="detail-workplace-item">';
            html += '<div class="detail-workplace-top">';
            html += '<div class="detail-workplace-info">';
            html += '<div class="detail-workplace-name">' + wp.name + '</div>';
            if (wp.address) {
                html += '<div class="detail-workplace-address">' + wp.address + '</div>';
            }
            if (wp.timeStart || wp.timeEnd) {
                html += '<div class="detail-workplace-times">';
                if (wp.timeStart) {
                    html += '<span class="detail-time-badge">🕒 ' + wp.timeStart + '</span>';
                }
                if (wp.timeEnd) {
                    html += '<span class="detail-time-badge">🕕 ' + wp.timeEnd + '</span>';
                }
                html += '</div>';
            }
            html += '</div>';
            html += '<a href="' + navUrl + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm detail-nav-btn">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
            html += ' Naviga</a>';
            html += '</div>';
            if (wp.info) {
                html += '<div class="detail-workplace-extra">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
                html += '<span>' + wp.info.replace(/\n/g, '<br>') + '</span>';
                html += '</div>';
            }
            html += '</div>';
        });

        html += '</div></div>';

        // Notes section
        if (asgn.notes) {
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">';
            html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
            html += ' Note</div>';
            html += '<div class="detail-notes">' + asgn.notes + '</div>';
            html += '</div>';
        }

        html += '</div>';
        detailView.innerHTML = html;
    }

    // ==================== EMPLOYEE CHECKBOXES ====================
    function populateEmployeeCheckboxes() {
        const container = document.getElementById('employee-multiselect');
        if (!container) return;
        const employees = Storage.getEmployees();

        container.innerHTML = employees.map(emp => `
            <label class="checkbox-item">
                <input type="checkbox" value="${emp.id}">
                <span class="checkmark"></span>
                <span class="checkbox-label">${emp.firstName} ${emp.lastName}</span>
                <span class="checkbox-role">${emp.position || ''}</span>
            </label>
        `).join('');
    }

    // ==================== WORKPLACE FIELDS ====================
    function addWorkplaceField(data = null) {
        const list = document.getElementById('workplaces-list');
        const idx = workplaceCounter++;

        const item = document.createElement('div');
        item.className = 'workplace-item';
        item.dataset.index = idx;

        item.innerHTML = `
            <div class="workplace-row">
                <div class="workplace-inputs">
                    <input type="text" class="form-input wp-name" placeholder="Nome posto (es: Iveco Orecchia)" value="${data?.name || ''}">
                    <input type="text" class="form-input wp-address" placeholder="Indirizzo" value="${data?.address || ''}" readonly>
                    <input type="hidden" class="wp-lat" value="${data?.lat || ''}">
                    <input type="hidden" class="wp-lng" value="${data?.lng || ''}">
                </div>
                <div class="workplace-actions">
                    <button type="button" class="btn btn-outline btn-icon btn-sm" onclick="Schedule.openMapPicker(${idx})" title="Cerca su Google Maps">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </button>
                    <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="Schedule.removeWorkplace(${idx})" title="Rimuovi">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="workplace-times">
                <div class="time-input-group">
                    <label>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Orario inizio
                    </label>
                    <input type="time" class="form-input wp-time-start" value="${data?.timeStart || ''}" step="900" placeholder="HH:MM">
                </div>
                <div class="time-input-group">
                    <label>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Orario fine
                    </label>
                    <input type="time" class="form-input wp-time-end" value="${data?.timeEnd || ''}" step="900" placeholder="HH:MM">
                </div>
            </div>
            <textarea class="form-input wp-info" placeholder="Informazioni aggiuntive (cosa fare, contatti, materiale...)" rows="3">${data?.info || ''}</textarea>
        `;

        list.appendChild(item);
    }

    function removeWorkplace(idx) {
        const item = document.querySelector(`.workplace-item[data-index="${idx}"]`);
        if (item) item.remove();
    }

    // ==================== GOOGLE MAPS PICKER ====================
    function openMapPicker(wpIndex) {
        activeWorkplaceIndex = wpIndex;
        selectedPlace = null;

        const mapModal = document.getElementById('map-modal');
        mapModal.classList.add('active');

        document.getElementById('map-selected-info').style.display = 'none';
        document.getElementById('map-search-input').value = '';

        // Initialize map after modal is visible
        setTimeout(() => {
            initMap();
        }, 300);
    }

    function initMap() {
        const mapContainer = document.getElementById('map-container');

        // Default center: Italy
        const defaultCenter = { lat: 41.9028, lng: 12.4964 };

        mapInstance = new google.maps.Map(mapContainer, {
            center: defaultCenter,
            zoom: 6,
            styles: getMapStyles(),
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });

        mapMarker = new google.maps.Marker({
            map: mapInstance,
            draggable: true
        });

        // Autocomplete
        const input = document.getElementById('map-search-input');
        autocomplete = new google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: 'it' },
            fields: ['formatted_address', 'geometry', 'name']
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) return;

            const loc = place.geometry.location;
            mapInstance.setCenter(loc);
            mapInstance.setZoom(16);
            mapMarker.setPosition(loc);

            selectedPlace = {
                name: place.name || '',
                address: place.formatted_address || '',
                lat: loc.lat(),
                lng: loc.lng()
            };

            document.getElementById('map-selected-info').style.display = 'flex';
            document.getElementById('map-selected-address').textContent = selectedPlace.address;
        });

        // Click on map to set position
        mapInstance.addListener('click', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            mapMarker.setPosition(e.latLng);

            // Reverse geocode
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                const addr = status === 'OK' && results[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                selectedPlace = { name: '', address: addr, lat, lng };
                document.getElementById('map-selected-info').style.display = 'flex';
                document.getElementById('map-selected-address').textContent = addr;
            });
        });

        // Marker drag end
        mapMarker.addListener('dragend', () => {
            const pos = mapMarker.getPosition();
            const lat = pos.lat();
            const lng = pos.lng();
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                const addr = status === 'OK' && results[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                selectedPlace = { name: '', address: addr, lat, lng };
                document.getElementById('map-selected-info').style.display = 'flex';
                document.getElementById('map-selected-address').textContent = addr;
            });
        });
    }

    function getMapStyles() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (!isDark) return [];
        return [
            { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
            { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
            { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
            { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] }
        ];
    }

    function closeMapModal() {
        document.getElementById('map-modal').classList.remove('active');
        selectedPlace = null;
        activeWorkplaceIndex = null;
    }

    function confirmMapSelection() {
        if (!selectedPlace || activeWorkplaceIndex === null) {
            App.showToast('Attenzione', 'Seleziona una posizione sulla mappa', 'warning');
            return;
        }

        const item = document.querySelector(`.workplace-item[data-index="${activeWorkplaceIndex}"]`);
        if (!item) return;

        const nameInput = item.querySelector('.wp-name');
        const addressInput = item.querySelector('.wp-address');
        const latInput = item.querySelector('.wp-lat');
        const lngInput = item.querySelector('.wp-lng');

        // If name field is empty, fill with place name
        if (!nameInput.value.trim() && selectedPlace.name) {
            nameInput.value = selectedPlace.name;
        }
        addressInput.value = selectedPlace.address;
        latInput.value = selectedPlace.lat;
        lngInput.value = selectedPlace.lng;

        closeMapModal();
        App.showToast('Posizione salvata', selectedPlace.address, 'success');
    }

    // ==================== FORM SUBMIT ====================
    function handleSubmit(e) {
        e.preventDefault();

        // Get selected employees
        const checkboxes = document.querySelectorAll('#employee-multiselect input[type="checkbox"]:checked');
        const employeeIds = Array.from(checkboxes).map(cb => cb.value);

        if (employeeIds.length === 0) {
            App.showToast('Errore', 'Seleziona almeno un dipendente', 'error');
            return;
        }

        // Get workplaces
        const workplaceItems = document.querySelectorAll('.workplace-item');
        const workplaces = [];
        workplaceItems.forEach(item => {
            const name = item.querySelector('.wp-name')?.value.trim();
            const address = item.querySelector('.wp-address')?.value.trim();
            const lat = parseFloat(item.querySelector('.wp-lat')?.value) || null;
            const lng = parseFloat(item.querySelector('.wp-lng')?.value) || null;
            const info = item.querySelector('.wp-info')?.value.trim() || '';
            const timeStart = item.querySelector('.wp-time-start')?.value.trim() || null;
            const timeEnd = item.querySelector('.wp-time-end')?.value.trim() || null;

            if (name || address) {
                workplaces.push({ 
                    name: name || address, 
                    address: address || '', 
                    lat, 
                    lng, 
                    info,
                    timeStart,
                    timeEnd
                });
            }
        });

        if (workplaces.length === 0) {
            App.showToast('Errore', 'Aggiungi almeno un posto di lavoro', 'error');
            return;
        }

        const teamName = document.getElementById('assignment-team-name').value.trim();
        if (!teamName) {
            App.showToast('Errore', 'Inserisci un nome per la squadra', 'error');
            return;
        }

        const data = {
            date: document.getElementById('assignment-date').value,
            teamName,
            employeeIds,
            workplaces,
            notes: document.getElementById('assignment-notes').value.trim()
        };

        if (!data.date) {
            App.showToast('Errore', 'Seleziona una data', 'error');
            return;
        }

        if (editingAssignmentId) {
            Storage.updateAssignment(editingAssignmentId, data);
            App.showToast('Successo', 'Squadra aggiornata', 'success');
        } else {
            Storage.addAssignment(data);
            App.showToast('Successo', 'Squadra creata', 'success');
        }

        closeModal();
        render();
        Dashboard.render();
    }

    function deleteAssignment() {
        if (!editingAssignmentId) return;

        App.showConfirm(
            'Elimina Squadra',
            'Sei sicuro di voler eliminare questa squadra?',
            () => {
                Storage.deleteAssignment(editingAssignmentId);
                closeModal();
                render();
                Dashboard.render();
                App.showToast('Eliminato', 'Squadra eliminata', 'success');
            }
        );
    }

    function updateEmployeeFilter() {
        const filter = document.getElementById('schedule-employee-filter');
        if (!filter) return;

        const employees = Storage.getEmployees();
        const currentValue = filter.value;

        filter.innerHTML = '<option value="all">Tutti i dipendenti</option>';
        employees.forEach(emp => {
            filter.innerHTML += `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`;
        });

        filter.value = currentValue || 'all';
    }

    // ==================== DETAIL MODAL (Employee Read-Only) ====================
    function openDetailModal(assignmentId) {
        const asgn = Storage.getAssignment(assignmentId);
        if (!asgn) return;
        renderDetailModal(asgn.date, [asgn]);
    }

    function openDetailModalByDate(dateStr) {
        let assignments = Storage.getAssignmentsByDate(dateStr);
        if (assignments.length === 0) return;
        renderDetailModal(dateStr, assignments);
    }

    // Apri un gruppo dal link della dashboard
    function openGroupDetail(assignmentId) {
        if (Auth.isAdmin()) {
            openModal(assignmentId);
            return;
        }
        openDetailModal(assignmentId);
    }

    function renderDetailModal(dateStr, assignments) {
        const modal = document.getElementById('detail-modal');
        const title = document.getElementById('detail-modal-title');
        const body = document.getElementById('detail-modal-body');

        title.textContent = Storage.formatDateLong(dateStr);

        let html = '';

        assignments.forEach((asgn, idx) => {
            const teamMembers = asgn.employeeIds.map(eid => {
                const emp = Storage.getEmployee(eid);
                return emp ? { name: emp.firstName + ' ' + emp.lastName, position: emp.position || '', phone: emp.phone || '' } : null;
            }).filter(Boolean);

            var teamLabel = asgn.teamName || ('Gregge ' + (idx + 1));
            html += '<div class="detail-assignment' + (assignments.length > 1 ? ' detail-multi' : '') + '">';

            html += '<div class="detail-assignment-num">' + teamLabel + '</div>';

            // Squadra
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">';
            html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
            html += ' Membri</div>';
            html += '<div class="detail-team-list">';

            teamMembers.forEach(function(member) {
                var initials = member.name.split(' ').map(function(n) { return n[0]; }).join('');
                html += '<div class="detail-team-member">';
                html += '<div class="detail-member-avatar">' + initials + '</div>';
                html += '<div class="detail-member-info">';
                html += '<div class="detail-member-name">' + member.name + '</div>';
                if (member.position) {
                    html += '<div class="detail-member-role">' + member.position + '</div>';
                }
                html += '</div>';
                if (member.phone) {
                    html += '<a href="tel:' + member.phone + '" class="detail-member-phone" title="Chiama ' + member.name + '">';
                    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
                    html += '</a>';
                }
                html += '</div>';
            });

            html += '</div></div>';

            // Posti di lavoro
            html += '<div class="detail-section">';
            html += '<div class="detail-section-title">';
            html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
            html += ' Posti di Lavoro</div>';
            html += '<div class="detail-workplaces-list">';

            asgn.workplaces.forEach(function(wp) {
                var navUrl = (wp.lat && wp.lng)
                    ? 'https://www.google.com/maps/dir/?api=1&destination=' + wp.lat + ',' + wp.lng
                    : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(wp.address || wp.name);

                html += '<div class="detail-workplace-item">';
                html += '<div class="detail-workplace-top">';
                html += '<div class="detail-workplace-info">';
                html += '<div class="detail-workplace-name">' + wp.name + '</div>';
                if (wp.address) {
                    html += '<div class="detail-workplace-address">' + wp.address + '</div>';
                }
                if (wp.timeStart || wp.timeEnd) {
                    html += '<div class="detail-workplace-times">';
                    if (wp.timeStart) {
                        html += '<span class="detail-time-badge">🕒 ' + wp.timeStart + '</span>';
                    }
                    if (wp.timeEnd) {
                        html += '<span class="detail-time-badge">🕕 ' + wp.timeEnd + '</span>';
                    }
                    html += '</div>';
                }
                html += '</div>';
                html += '<a href="' + navUrl + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm detail-nav-btn">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
                html += ' Naviga</a>';
                html += '</div>';
                if (wp.info) {
                    html += '<div class="detail-workplace-extra">';
                    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
                    html += '<span>' + wp.info.replace(/\n/g, '<br>') + '</span>';
                    html += '</div>';
                }
                html += '</div>';
            });

            html += '</div></div>';

            // Note
            if (asgn.notes) {
                html += '<div class="detail-section">';
                html += '<div class="detail-section-title">';
                html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
                html += ' Note</div>';
                html += '<div class="detail-notes">' + asgn.notes + '</div>';
                html += '</div>';
            }

            html += '</div>';
        });

        body.innerHTML = html;
        modal.classList.add('active');
    }

    function closeDetailModal() {
        document.getElementById('detail-modal').classList.remove('active');
    }

    return {
        init,
        render,
        openModal,
        closeModal,
        openDetailModal,
        openDetailModalByDate,
        openGroupDetail,
        closeDetailModal,
        addWorkplaceField,
        removeWorkplace,
        openMapPicker,
        closeMapModal,
        confirmMapSelection,
        toggleAssignmentViewMode,
        deleteAssignment,
        updateEmployeeFilter
    };
})();
