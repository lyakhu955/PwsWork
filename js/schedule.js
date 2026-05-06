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

    // Drag and Drop state
    let draggedAssignmentId = null;
    let draggedAssignmentDate = null;
    let dropTarget = null;

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
        setupDragAndDrop();
    }

    // ==================== DRAG AND DROP ====================
    function setupDragAndDrop() {
        // Clear previous listeners and setup new ones after render
        const container = document.getElementById('schedule-container');
        if (!container) return;

        // For week view: bind to assignment cards
        const assignmentCards = container.querySelectorAll('.assignment-card');
        assignmentCards.forEach(card => {
            card.setAttribute('draggable', 'true');
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        // For month table view: bind to month-assignment-dot
        const monthDots = container.querySelectorAll('.month-assignment-dot');
        monthDots.forEach(dot => {
            dot.setAttribute('draggable', 'true');
            dot.addEventListener('dragstart', handleDragStart);
            dot.addEventListener('dragend', handleDragEnd);
        });

        // For month list view: bind to month-list-squad-card
        const monthListCards = container.querySelectorAll('.month-list-squad-card');
        monthListCards.forEach(card => {
            card.setAttribute('draggable', 'true');
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        // Week view: drop zones on week-day-body
        const weekDayBodies = container.querySelectorAll('.week-day-body');
        weekDayBodies.forEach(body => {
            body.addEventListener('dragover', handleDragOver);
            body.addEventListener('drop', handleDropWeek);
            body.addEventListener('dragleave', handleDragLeave);
        });

        // Month table view: drop zones on month cells
        const monthCells = container.querySelectorAll('.month-cell');
        monthCells.forEach(cell => {
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDropMonth);
            cell.addEventListener('dragleave', handleDragLeave);
        });

        // Month list view: drop zones on month-list-day
        const monthListDays = container.querySelectorAll('.month-list-day');
        monthListDays.forEach(day => {
            day.addEventListener('dragover', handleDragOver);
            day.addEventListener('drop', handleDropMonthList);
            day.addEventListener('dragleave', handleDragLeave);
        });
    }

    function handleDragStart(e) {
        const card = e.target.closest('.assignment-card, .month-assignment-dot, .month-list-squad-card');
        if (!card) return;

        // Extract assignment ID from dataset or onclick handler
        let assignmentId = card.dataset.assignmentId;
        if (!assignmentId) {
            // Try to extract from onclick attribute
            const onclick = card.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/Schedule\.openModal\('([^']+)'\)/);
                assignmentId = match ? match[1] : null;
            }
        }

        if (!assignmentId) return;

        draggedAssignmentId = assignmentId;
        // Get current date from parent day column
        const dayCol = card.closest('.week-day-col, .month-cell, .month-list-day');
        if (dayCol) {
            const dayNum = dayCol.querySelector('.day-date, .month-day-num, .month-list-day-num');
            if (dayNum) {
                draggedAssignmentDate = dayNum.textContent;
            }
        }

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('assignmentId', assignmentId);
        card.style.opacity = '0.5';
    }

    function handleDragEnd(e) {
        const card = e.target.closest('.assignment-card, .month-assignment-dot, .month-list-squad-card');
        if (card) card.style.opacity = '1';

        draggedAssignmentId = null;
        draggedAssignmentDate = null;

        // Remove highlight from all drop zones
        const container = document.getElementById('schedule-container');
        if (container) {
            container.querySelectorAll('.week-day-body, .month-cell, .month-list-day').forEach(zone => {
                zone.classList.remove('drag-over');
            });
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dropZone = e.target.closest('.week-day-body, .month-cell, .month-list-day');
        if (dropZone && !dropZone.classList.contains('drag-over')) {
            dropZone.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        const dropZone = e.target.closest('.week-day-body, .month-cell, .month-list-day');
        if (dropZone && e.target === e.currentTarget) {
            dropZone.classList.remove('drag-over');
        }
    }

    function handleDropWeek(e) {
        e.preventDefault();
        e.stopPropagation();

        const dropZone = e.target.closest('.week-day-body');
        if (!dropZone) return;

        dropZone.classList.remove('drag-over');

        // Extract target date from week column header
        const weekDayCol = dropZone.closest('.week-day-col');
        if (!weekDayCol) return;

        const dayDateSpan = weekDayCol.querySelector('.day-date');
        if (!dayDateSpan) return;

        const targetDay = dayDateSpan.textContent;
        const year = currentWeekStart.getFullYear();
        const month = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
        const targetDateStr = `${year}-${month}-${String(targetDay).padStart(2, '0')}`;

        moveAssignmentToDate(draggedAssignmentId, targetDateStr);
    }

    function handleDropMonth(e) {
        e.preventDefault();
        e.stopPropagation();

        const dropZone = e.target.closest('.month-cell');
        if (!dropZone) return;

        dropZone.classList.remove('drag-over');

        // Extract target date from month cell
        const dayNumSpan = dropZone.querySelector('.month-day-num');
        if (!dayNumSpan) return;

        const targetDay = dayNumSpan.textContent.replace(' 🔴', '');
        const year = currentWeekStart.getFullYear();
        const month = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
        const targetDateStr = `${year}-${month}-${String(targetDay).padStart(2, '0')}`;

        moveAssignmentToDate(draggedAssignmentId, targetDateStr);
    }

    function handleDropMonthList(e) {
        e.preventDefault();
        e.stopPropagation();

        const dropZone = e.target.closest('.month-list-day');
        if (!dropZone) return;

        dropZone.classList.remove('drag-over');

        // Extract target date from month list day
        const dayNumSpan = dropZone.querySelector('.month-list-day-num');
        if (!dayNumSpan) return;

        const targetDay = dayNumSpan.textContent;
        const year = currentWeekStart.getFullYear();
        const month = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
        const targetDateStr = `${year}-${month}-${String(targetDay).padStart(2, '0')}`;

        moveAssignmentToDate(draggedAssignmentId, targetDateStr);
    }

    function moveAssignmentToDate(assignmentId, newDate) {
        if (!assignmentId || !newDate) return;

        const asgn = Storage.getAssignment(assignmentId);
        if (!asgn) return;

        // Check if assignment already exists for that date
        const oldDate = asgn.date;
        if (oldDate === newDate) return;

        // Update assignment date
        asgn.date = newDate;
        Storage.updateAssignment(assignmentId, asgn);

        // Show feedback
        App.showToast(`Squadra spostata al ${new Date(newDate + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`);

        // Re-render
        render();
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
        setupDragAndDrop();
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
                    html += `<div class="assignment-card${isMySquad ? ' my-squad' : ''}" data-assignment-id="${asgn.id}" onclick="event.stopPropagation(); ${cardClick}">
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
                              data-assignment-id="${asgn.id}"
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

                    html += `<div class="month-list-squad-card${isMySquad ? ' my-squad' : ''}" data-assignment-id="${asgn.id}" onclick="${cardClick}">`;
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
        
        // Reset multiDates
        multiDates = [];
        setDateMode('single');
        document.getElementById('assignment-multi-date-list').innerHTML = '';
        document.getElementById('assignment-multi-dates-data').value = '[]';
        window._currentModalWorkplaces = {};

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
            
            // Attachments button for Worker view
            html += '<div class="workplace-attachments-bar" style="margin-top: 8px;">';
            html += '<button type="button" class="btn btn-sm btn-attachments ' + (wp.attachments && wp.attachments.length ? 'has-attachments' : 'empty-attachments') + '" onclick="Schedule.openAttachmentsModal(\'' + assignmentId + '\', null, false, \'' + wp.name.replace(/'/g, "\\'") + '\', \'' + encodeURIComponent(JSON.stringify(wp.attachments || [])).replace(/'/g, "\\'") + '\')">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
            html += '<span>Allegati <span class="attachments-count">' + (wp.attachments ? wp.attachments.length : 0) + '</span></span>';
            html += '</button>';
            html += '</div>';

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
                        Orario inizio (HH:MM)
                    </label>
                    <input type="text" class="form-input wp-time-start" value="${data?.timeStart || ''}" placeholder="14:30" pattern="[0-2][0-9]:[0-5][0-9]" maxlength="5" inputmode="numeric">
                </div>
                <div class="time-input-group">
                    <label>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Orario fine (HH:MM)
                    </label>
                    <input type="text" class="form-input wp-time-end" value="${data?.timeEnd || ''}" placeholder="17:00" pattern="[0-2][0-9]:[0-5][0-9]" maxlength="5" inputmode="numeric">
                </div>
            </div>
            <textarea class="form-input wp-info" placeholder="Informazioni aggiuntive (cosa fare, contatti, materiale...)" rows="3">${data?.info || ''}</textarea>
            
            <div class="workplace-attachments-bar">
                <button type="button" class="btn btn-sm btn-attachments ${data?.attachments?.length ? 'has-attachments' : 'empty-attachments'}" onclick="Schedule.openAttachmentsModal('${editingAssignmentId || 'new'}', ${idx}, true)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span>Allegati <span class="attachments-count">${data?.attachments?.length || 0}</span></span>
                </button>
            </div>
        `;

        list.appendChild(item);

        // Store initial attachments in memory to manage them before saving
        if (typeof window._currentModalWorkplaces !== 'undefined') {
            window._currentModalWorkplaces[idx] = { attachments: data?.attachments || [] };
        }

        // Add time input validation and formatting
        const timeStartInput = item.querySelector('.wp-time-start');
        const timeEndInput = item.querySelector('.wp-time-end');

        [timeStartInput, timeEndInput].forEach(input => {
            if (input) {
                input.addEventListener('input', formatTimeInput);
                input.addEventListener('blur', validateTimeInput);
            }
        });
    }

    function formatTimeInput(e) {
        let value = e.target.value.replace(/[^0-9:]/g, '');
        
        if (value.length >= 2 && !value.includes(':')) {
            value = value.slice(0, 2) + ':' + value.slice(2, 4);
        }
        
        e.target.value = value;
    }

    function validateTimeInput(e) {
        const value = e.target.value.trim();
        if (!value) return;
        
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
            App.showToast('Errore', 'Formato orario non valido. Usa HH:MM (es: 14:30)', 'error');
            e.target.value = '';
        }
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

        if (!addressInput) {
            console.error('confirmMapSelection: .wp-address not found in workplace item', activeWorkplaceIndex);
            closeMapModal();
            return;
        }

        // If name field is empty, fill with place name
        if (nameInput && !nameInput.value.trim() && selectedPlace.name) {
            nameInput.value = selectedPlace.name;
        }
        const savedAddress = selectedPlace.address || '';
        const savedName = selectedPlace.name || '';
        addressInput.value = savedAddress;
        if (latInput) latInput.value = selectedPlace.lat || '';
        if (lngInput) lngInput.value = selectedPlace.lng || '';

        closeMapModal();
        // silent - position saved
    }

    // ==================== MULTI-DATE MODE ====================
    let multiDates = [];
    let _calYear = 0;
    let _calMonth = 0;
    let _wizardOriginalDate = null; // Data originale della squadra nel wizard

    function setDateMode(mode) {
        console.log('[WIZARD] setDateMode chiamato con mode:', mode);
        const singleBtn = document.getElementById('assignment-single-date-btn');
        const multiBtn = document.getElementById('assignment-multi-date-btn');
        const multiPanel = document.getElementById('assignment-multi-date-panel');
        
        if (mode === 'multi') {
            // Se stiamo attivando il multi-date, apriamo prima il wizard di selezione posti
            if (!multiBtn.classList.contains('active')) {
                console.log('[WIZARD] Bottone non ancora attivo → apro wizard selezione posti');
                openMultiDayWizard();
                return; // Non attiviamo ancora il pannello calendario
            }
            
            console.log('[WIZARD] Bottone già attivo → mostro calendario direttamente');
            multiBtn.classList.add('active');
            singleBtn.classList.remove('active');
            multiPanel.style.display = 'block';
            if (multiDates.length === 0) {
                const mainDate = document.getElementById('assignment-date').value || Storage.toLocalDateStr(new Date());
                multiDates = [mainDate];
            }
            const base = new Date(multiDates[0] + 'T00:00:00');
            _calYear = base.getFullYear();
            _calMonth = base.getMonth();
            renderCalendar();
            renderMultiDates();
        } else {
            console.log('[WIZARD] Modalità single → nascondo calendario');
            singleBtn.classList.add('active');
            multiBtn.classList.remove('active');
            multiPanel.style.display = 'none';
        }
    }

    function calendarPrev() {
        _calMonth--;
        if (_calMonth < 0) { _calMonth = 11; _calYear--; }
        renderCalendar();
    }

    function calendarNext() {
        _calMonth++;
        if (_calMonth > 11) { _calMonth = 0; _calYear++; }
        renderCalendar();
    }

    function renderCalendar() {
        const titleEl = document.getElementById('sched-calendar-title');
        const gridEl = document.getElementById('sched-calendar-grid');
        if (!titleEl || !gridEl) return;

        const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        titleEl.textContent = `${MONTH_NAMES[_calMonth]} ${_calYear}`;

        const dayHeaders = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];
        let html = dayHeaders.map(d => `<div class="wa-cal-header">${d}</div>`).join('');

        const firstDay = new Date(_calYear, _calMonth, 1);
        let startDow = firstDay.getDay(); // 0=Sun
        startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0

        for (let i = 0; i < startDow; i++) {
            html += '<div class="wa-cal-empty"></div>';
        }

        const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${_calYear}-${String(_calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isSelected = multiDates.includes(dateStr);
            const isOrigin = _wizardOriginalDate && dateStr === _wizardOriginalDate;

            let classes = 'wa-cal-day';
            if (isOrigin)   classes += ' wa-cal-day--origin';
            if (isSelected) classes += ' selected';

            const label = isOrigin ? `${d}<span class="cal-origin-dot"></span>` : `${d}`;
            html += `<div class="${classes}" onclick="Schedule.toggleMultiDate('${dateStr}')" title="${isOrigin ? 'Giorno attuale del lavoro' : ''}">${label}</div>`;
        }

        gridEl.innerHTML = html;
    }

    function toggleMultiDate(dateStr) {
        console.log('[WIZARD] toggleMultiDate chiamato con dateStr:', dateStr);
        console.log('[WIZARD] multiDates attuale:', [...multiDates]);
        
        const mainDate = document.getElementById('assignment-date').value;
        console.log('[WIZARD] mainDate dal campo input:', mainDate, '(lunghezza:', mainDate.length + ')');
        
        // Solo blocca se mainDate è valorizzata E corrisponde alla data cliccata
        if (mainDate && dateStr === mainDate) {
            console.log('[WIZARD] BLOCCATO - data cliccata coincide con mainDate');
            App.showToast('Attenzione', 'La data principale non può essere rimossa', 'warning');
            return;
        }

        const idx = multiDates.indexOf(dateStr);
        if (idx >= 0) {
            multiDates.splice(idx, 1);
            console.log('[WIZARD] Data RIMOSSA. multiDates ora:', [...multiDates]);
        } else {
            multiDates.push(dateStr);
            multiDates.sort();
            console.log('[WIZARD] Data AGGIUNTA. multiDates ora:', [...multiDates]);
        }
        renderCalendar();
        renderMultiDates();
    }

    function removeMultiDate(dateStr) {
        toggleMultiDate(dateStr);
    }

    function renderMultiDates() {
        const list = document.getElementById('assignment-multi-date-list');
        const hiddenData = document.getElementById('assignment-multi-dates-data');
        const mainDate = document.getElementById('assignment-date').value;

        if (!list) return;

        const modal = document.getElementById('assignment-modal');
        if (modal) {
            modal.dataset.multiDate = (multiDates.length > 0).toString();
        }

        // Ensure main date is included in multiDates but displayed specially or not removable if it's the only one
        let allDates = [...multiDates];
        if (mainDate && !allDates.includes(mainDate)) {
            allDates.push(mainDate);
            allDates.sort();
        }

        list.innerHTML = allDates.map(d => {
            const isMain = d === mainDate;
            const dateObj = new Date(d + 'T00:00:00');
            const formatted = dateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
            return `
                <div class="multi-date-chip">
                    <span>${formatted}</span>
                    ${!isMain ? `<button type="button" onclick="Schedule.removeMultiDate('${d}')">✕</button>` : ''}
                </div>
            `;
        }).join('');

        hiddenData.value = JSON.stringify(allDates);
    }

    // ==================== COPY / PASTE ASSIGNMENT ====================
    let copiedAssignment = null;

    function copyCurrentAssignment() {
        // Collect current data from form
        const checkboxes = document.querySelectorAll('#employee-multiselect input[type="checkbox"]:checked');
        const employeeIds = Array.from(checkboxes).map(cb => cb.value);

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
            
            // Preserve attachments if editing an existing assignment
            const idx = item.dataset.index;
            let attachments = [];
            if (editingAssignmentId) {
                const asgn = Storage.getAssignment(editingAssignmentId);
                if (asgn && asgn.workplaces && asgn.workplaces[idx]) {
                    attachments = asgn.workplaces[idx].attachments || [];
                }
            }

            if (name || address) {
                workplaces.push({ name: name || address, address: address || '', lat, lng, info, timeStart, timeEnd, attachments: [...attachments] });
            }
        });

        const teamName = document.getElementById('assignment-team-name').value.trim();
        const notes = document.getElementById('assignment-notes').value.trim();

        copiedAssignment = {
            teamName,
            employeeIds,
            workplaces,
            notes
        };

        const statusLabel = document.getElementById('assignment-copy-status');
        if (statusLabel) {
            statusLabel.textContent = `Copiata: ${teamName || 'Squadra'} (${employeeIds.length} dipendenti)`;
            statusLabel.style.color = 'var(--primary)';
        }

        const pasteBtn = document.getElementById('assignment-paste-btn');
        if (pasteBtn) {
            pasteBtn.style.display = 'inline-flex';
        }
        
        // silent copy
    }

    function pasteAssignment() {
        if (!copiedAssignment) return;

        document.getElementById('assignment-team-name').value = copiedAssignment.teamName || '';
        document.getElementById('assignment-notes').value = copiedAssignment.notes || '';

        // Check employees
        document.querySelectorAll('#employee-multiselect input[type="checkbox"]').forEach(cb => {
            cb.checked = copiedAssignment.employeeIds.includes(cb.value);
        });

        // Add workplaces
        const list = document.getElementById('workplaces-list');
        list.innerHTML = '';
        workplaceCounter = 0;
        copiedAssignment.workplaces.forEach(wp => {
            addWorkplaceField(wp);
        });

        // silent paste
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

            // Preserve attachments
            const idx = item.dataset.index;
            let attachments = [];
            // We will fetch attachments from a global array or data attribute later. For now, fetch from existing assignment if editing.
            if (editingAssignmentId) {
                const asgn = Storage.getAssignment(editingAssignmentId);
                if (asgn && asgn.workplaces && asgn.workplaces[idx]) {
                    attachments = asgn.workplaces[idx].attachments || [];
                }
            } else if (copiedAssignment && copiedAssignment.workplaces && copiedAssignment.workplaces[idx]) {
                attachments = copiedAssignment.workplaces[idx].attachments || [];
            }
            
            // Allow override from memory if we implement real-time attachments in modal
            if (window._currentModalWorkplaces && window._currentModalWorkplaces[idx]) {
                attachments = window._currentModalWorkplaces[idx].attachments || attachments;
            }

            const copyMulti = _selectedWorkplacesForMulti.includes(item.dataset.index);

            if (name || address) {
                workplaces.push({ 
                    name: name || address, 
                    address: address || '', 
                    lat, 
                    lng, 
                    info,
                    timeStart,
                    timeEnd,
                    attachments: [...attachments],
                    copyMulti: copyMulti
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

        const baseData = {
            teamName,
            employeeIds,
            workplaces,
            notes: document.getElementById('assignment-notes').value.trim()
        };

        const multiBtn = document.getElementById('assignment-multi-date-btn');
        const isMulti = multiBtn && multiBtn.classList.contains('active') && multiDates.length > 0;

        console.log('[WIZARD] handleSubmit - isMulti:', isMulti);
        console.log('[WIZARD] handleSubmit - multiBtn active:', multiBtn?.classList.contains('active'));
        console.log('[WIZARD] handleSubmit - multiDates:', [...multiDates]);
        console.log('[WIZARD] handleSubmit - editingAssignmentId:', editingAssignmentId);
        console.log('[WIZARD] handleSubmit - workplaces:', workplaces.map(w => w.name));
        console.log('[WIZARD] handleSubmit - employeeIds:', employeeIds);

        if (editingAssignmentId) {
            // 1. Aggiorna la squadra esistente normalmente
            baseData.date = document.getElementById('assignment-date').value;
            Storage.updateAssignment(editingAssignmentId, baseData);
            
            // 2. Se il wizard era attivo, crea NUOVE squadre per le date selezionate
            if (isMulti && multiDates.length > 0) {
                const datesToCreate = multiDates.filter(d => d !== baseData.date); // evita doppioni con la data originale
                if (datesToCreate.length > 0) {
                    const dataForNewDates = {
                        ...baseData,
                        workplaces: baseData.workplaces.filter(wp => wp.copyMulti)
                    };
                    if (dataForNewDates.workplaces.length > 0) {
                        console.log('[WIZARD] Creo', datesToCreate.length, 'nuove squadre per le date:', datesToCreate);
                        Storage.addAssignmentsForDates(dataForNewDates, datesToCreate);
                    }
                }
            } else {
                // nothing
            }

        } else {
            // New assignment - check multi-date
            if (isMulti && multiDates.length > 0) {
                // La data principale è la prima data nel calendario selezionato
                const mainDate = multiDates[0];
                const extraDates = multiDates.slice(1);
                
                // Crea assegnazione principale con TUTTI i posti di lavoro
                Storage.addAssignment({ ...baseData, date: mainDate });

                // Crea assegnazioni per le altre date solo con i posti selezionati nel wizard
                if (extraDates.length > 0) {
                    const dataForExtraDates = {
                        ...baseData,
                        workplaces: baseData.workplaces.filter(wp => wp.copyMulti)
                    };
                    if (dataForExtraDates.workplaces.length > 0) {
                        Storage.addAssignmentsForDates(dataForExtraDates, extraDates);
                    }
                }
                // silent
            } else if (!isMulti) {
                baseData.date = document.getElementById('assignment-date').value;
                Storage.addAssignment(baseData);
            } else {
                App.showToast('Attenzione', 'Seleziona almeno un giorno sul calendario', 'warning');
                return;
            }
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

        // Filter assignments for non-admins to show only their own groups
        let displayAssignments = assignments;
        if (!Auth.isAdmin()) {
            const currentUser = Storage.getCurrentUser();
            const myEmployeeId = currentUser?.employeeId || currentUser?.id || null;
            if (myEmployeeId) {
                displayAssignments = assignments.filter(asgn => asgn.employeeIds.includes(myEmployeeId));
            }
        }

        if (displayAssignments.length === 0) {
            body.innerHTML = '<div class="empty-state" style="padding: 40px 20px; text-align: center; color: var(--text-secondary); font-style: italic;">Nessun lavoro assegnato a te per questo giorno.</div>';
            modal.classList.add('active');
            return;
        }

        let html = '';
        displayAssignments.forEach((asgn, idx) => {
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
                
                // Attachments button for Worker view
                html += '<div class="workplace-attachments-bar" style="margin-top: 8px;">';
                html += '<button type="button" class="btn btn-sm btn-attachments ' + (wp.attachments && wp.attachments.length ? 'has-attachments' : 'empty-attachments') + '" onclick="Schedule.openAttachmentsModal(\'' + asgn.id + '\', null, false, \'' + wp.name.replace(/'/g, "\\'") + '\', \'' + encodeURIComponent(JSON.stringify(wp.attachments || [])).replace(/'/g, "\\'") + '\')">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
                html += '<span>Allegati <span class="attachments-count">' + (wp.attachments ? wp.attachments.length : 0) + '</span></span>';
                html += '</button>';
                html += '</div>';

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
        
        // Track for real-time refresh
        window._detailModalActive = true;
        window._currentDetailDate = dateStr;
    }

    function closeDetailModal() {
        document.getElementById('detail-modal').classList.remove('active');
    }

    // ==================== ATTACHMENTS ====================
    let currentAttachmentsAssignmentId = null;
    let currentAttachmentsWorkplaceIndex = null;
    let isEditingAttachments = false;
    let currentAttachmentsList = [];

    function openAttachmentsModal(assignmentId, workplaceIndex, isEditing, wpName = '', currentList = null) {
        currentAttachmentsAssignmentId = assignmentId;
        currentAttachmentsWorkplaceIndex = workplaceIndex;
        isEditingAttachments = isEditing;

        const modal = document.getElementById('attachments-modal');
        const title = document.getElementById('attachments-modal-title');
        const uploadArea = document.getElementById('attachments-upload-area');
        const fileInput = document.getElementById('attachments-file-input');

        if (fileInput) fileInput.value = '';

        if (isEditing) {
            title.textContent = 'Gestione Allegati';
            uploadArea.style.display = 'flex';
            // Get from memory
            if (window._currentModalWorkplaces && window._currentModalWorkplaces[workplaceIndex]) {
                currentAttachmentsList = window._currentModalWorkplaces[workplaceIndex].attachments || [];
            } else {
                currentAttachmentsList = [];
            }
        } else {
            title.textContent = 'Allegati: ' + wpName;
            uploadArea.style.display = 'none';
            // Get from passed list
            if (typeof currentList === 'string' && currentList !== '') {
                try {
                    currentAttachmentsList = JSON.parse(decodeURIComponent(currentList));
                } catch (e) {
                    console.error("Error parsing attachments list", e);
                    currentAttachmentsList = [];
                }
            } else {
                currentAttachmentsList = Array.isArray(currentList) ? currentList : [];
            }
        }

        renderAttachmentsList();

        // Setup file input listener if editing
        if (isEditing && fileInput && !fileInput.dataset.listenerAttached) {
            fileInput.dataset.listenerAttached = 'true';
            fileInput.addEventListener('change', handleFileUpload);
        }

        modal.classList.add('active');
        
        // Track for real-time refresh
        window._attachmentsModalActive = true;
    }

    function closeAttachmentsModal() {
        const modal = document.getElementById('attachments-modal');
        modal.classList.remove('active');
        currentAttachmentsAssignmentId = null;
        currentAttachmentsWorkplaceIndex = null;
        currentAttachmentsList = [];
        window._attachmentsModalActive = false;
    }

    function renderAttachmentsList() {
        const listEl = document.getElementById('attachments-list');
        if (!listEl) return;

        if (currentAttachmentsList.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Nessun allegato presente</div>';
            return;
        }

        let html = '';
        currentAttachmentsList.forEach((att, idx) => {
            const isImage = att.type && att.type.startsWith('image/');
            const isPdf = att.type === 'application/pdf';

            html += '<div class="attachment-item">';
            
            if (isImage) {
                const url = att.url || att.downloadURL;
                html += '<img src="' + url + '" class="attachment-thumbnail" onclick="window.open(\'' + url + '\', \'_blank\')" title="Apri immagine" alt="Allegato">';
            } else if (isPdf) {
                const url = att.url || att.downloadURL;
                html += '<div class="attachment-file-icon" onclick="window.open(\'' + url + '\', \'_blank\')" title="Apri PDF">';
                html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
                html += '</div>';
            } else {
                const url = att.url || att.downloadURL;
                html += '<div class="attachment-file-icon" onclick="window.open(\'' + url + '\', \'_blank\')">';
                html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
                html += '</div>';
            }

            html += '<div class="attachment-details">';
            html += '<div class="attachment-name">' + (att.name || 'File allegato') + '</div>';
            html += '<div class="attachment-size">' + (att.size ? (att.size / 1024).toFixed(1) + ' KB' : '') + '</div>';
            html += '</div>';

            html += '<div class="attachment-actions">';
            const url = att.url || att.downloadURL;
            html += '<a href="' + url + '" target="_blank" class="btn btn-sm btn-outline btn-icon" title="Scarica / Apri"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>';
            if (isEditingAttachments) {
                html += '<button type="button" class="btn btn-sm btn-danger btn-icon" onclick="Schedule.deleteAttachment(' + idx + ')" title="Elimina"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
            }
            html += '</div>';

            html += '</div>';
        });

        listEl.innerHTML = html;
        
        // Aggiorna il pulsante nel modale di modifica
        if (isEditingAttachments) {
            updateWorkplaceAttachmentButton(currentAttachmentsWorkplaceIndex, currentAttachmentsList.length);
        }
    }

    function updateWorkplaceAttachmentButton(idx, count) {
        const item = document.querySelector('.workplace-item[data-index="' + idx + '"]');
        if (item) {
            const btn = item.querySelector('.btn-attachments');
            const countSpan = item.querySelector('.attachments-count');
            if (btn && countSpan) {
                countSpan.textContent = count;
                if (count > 0) {
                    btn.classList.add('has-attachments');
                    btn.classList.remove('empty-attachments');
                } else {
                    btn.classList.remove('has-attachments');
                    btn.classList.add('empty-attachments');
                }
            }
        }
    }

    async function handleFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        App.showToast('Caricamento', 'Caricamento di ' + files.length + ' file...', 'info');
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = 'workplaces/' + Date.now() + '_' + file.name;
            const fileRef = storage.ref().child(filePath);

            try {
                const snapshot = await fileRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                const attachmentData = {
                    name: file.name,
                    url: downloadURL,
                    path: filePath,
                    type: file.type,
                    size: file.size
                };

                currentAttachmentsList.push(attachmentData);

                // Update memory state
                if (window._currentModalWorkplaces && window._currentModalWorkplaces[currentAttachmentsWorkplaceIndex]) {
                    window._currentModalWorkplaces[currentAttachmentsWorkplaceIndex].attachments = currentAttachmentsList;
                }

                renderAttachmentsList();

                // Auto-save to Firestore se la squadra esiste già
                if (currentAttachmentsAssignmentId && currentAttachmentsAssignmentId !== 'new') {
                    const asgn = Storage.getAssignment(currentAttachmentsAssignmentId);
                    if (asgn && asgn.workplaces && asgn.workplaces[currentAttachmentsWorkplaceIndex]) {
                        asgn.workplaces[currentAttachmentsWorkplaceIndex].attachments = currentAttachmentsList;
                        Storage.updateAssignment(currentAttachmentsAssignmentId, asgn);
                    }
                }

            } catch (error) {
                console.error("Upload error:", error);
                App.showToast('Errore', 'Errore nel caricamento: ' + error.message, 'error');
            }
        }
        
        // silent upload complete
        e.target.value = ''; // Reset input
    }

    function deleteAttachment(idx) {
        App.showConfirm(
            'Elimina Allegato',
            'Sei sicuro di voler eliminare questo allegato?',
            async () => {
                const att = currentAttachmentsList[idx];
                const path = att.path || att.storagePath;
                if (path) {
                    try {
                        await storage.ref().child(path).delete();
                    } catch (e) {
                        console.error("Error deleting from storage", e);
                        // continue to delete from list even if storage fails (e.g. already deleted)
                    }
                }
                
                currentAttachmentsList.splice(idx, 1);
                
                // Update memory state
                if (window._currentModalWorkplaces && window._currentModalWorkplaces[currentAttachmentsWorkplaceIndex]) {
                    window._currentModalWorkplaces[currentAttachmentsWorkplaceIndex].attachments = currentAttachmentsList;
                }

                renderAttachmentsList();
                
                // Auto-save to Firestore se la squadra esiste già
                if (currentAttachmentsAssignmentId && currentAttachmentsAssignmentId !== 'new') {
                    const asgn = Storage.getAssignment(currentAttachmentsAssignmentId);
                    if (asgn && asgn.workplaces && asgn.workplaces[currentAttachmentsWorkplaceIndex]) {
                        asgn.workplaces[currentAttachmentsWorkplaceIndex].attachments = currentAttachmentsList;
                        Storage.updateAssignment(currentAttachmentsAssignmentId, asgn);
                    }
                }
                // silent delete
            }
        );
    }

    function refreshActiveModals() {
        // 1. Refresh Attachments Modal
        if (window._attachmentsModalActive && currentAttachmentsAssignmentId && currentAttachmentsAssignmentId !== 'new') {
            const asgn = Storage.getAssignment(currentAttachmentsAssignmentId);
            if (asgn && asgn.workplaces && asgn.workplaces[currentAttachmentsWorkplaceIndex]) {
                const freshList = asgn.workplaces[currentAttachmentsWorkplaceIndex].attachments || [];
                // Check if changed to avoid unnecessary re-renders
                if (JSON.stringify(freshList) !== JSON.stringify(currentAttachmentsList)) {
                    currentAttachmentsList = [...freshList];
                    renderAttachmentsList();
                }
            }
        }

        // 2. Refresh Detail Modal (Vista Lavoratore)
        if (window._detailModalActive && window._currentDetailDate) {
            const assignments = Storage.getAssignmentsByDate(window._currentDetailDate);
            if (assignments.length > 0) {
                renderDetailModal(window._currentDetailDate, assignments);
            } else {
                closeDetailModal();
            }
        }

        // 3. Refresh Main Modal (Vista Admin) if editing
        if (editingAssignmentId && editingAssignmentId !== 'new') {
            const asgn = Storage.getAssignment(editingAssignmentId);
            if (!asgn) {
                // If the assignment we are editing was deleted by someone else
                closeModal();
                App.showToast('Attenzione', 'La squadra che stavi modificando è stata eliminata', 'warning');
            }
        }
    }

    let _selectedWorkplacesForMulti = [];

    function openMultiDayWizard() {
        const workplaceItems = document.querySelectorAll('.workplace-item');
        const container = document.getElementById('multi-day-workplace-selection');
        if (!container) return;

        // Start with NONE selected - user picks what they want
        _selectedWorkplacesForMulti = [];

        container.innerHTML = '';

        if (workplaceItems.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:24px;color:#a0aec0;font-size:0.9rem;">Nessun posto di lavoro aggiunto</p>';
            document.getElementById('multi-day-wizard-modal').classList.add('active');
            return;
        }

        workplaceItems.forEach((item) => {
            const name = item.querySelector('.wp-name')?.value.trim() || 'Posto senza nome';
            const address = item.querySelector('.wp-address')?.value.trim() || '';
            const id = item.dataset.index;

            const card = document.createElement('div');
            card.dataset.id = id;
            card.dataset.selected = 'false';
            // Style inline for cache-proof rendering
            Object.assign(card.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.09)',
                background: 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'border-color 0.18s, background 0.18s',
                userSelect: 'none',
                marginBottom: '0'
            });

            // Check circle (left)
            const checkEl = document.createElement('div');
            checkEl.className = 'wiz-check-circle';
            Object.assign(checkEl.style, {
                flexShrink: '0',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                transition: 'all 0.18s',
                pointerEvents: 'none'
            });
            checkEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" style="opacity:0;transition:opacity 0.18s;pointer-events:none;"><polyline points="20 6 9 17 4 12"/></svg>`;

            // Text body
            const bodyEl = document.createElement('div');
            Object.assign(bodyEl.style, {
                flex: '1',
                minWidth: '0',
                pointerEvents: 'none'
            });
            bodyEl.innerHTML = `
                <div style="font-weight:600;font-size:0.95rem;color:#f0f0f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
                ${address ? `<div style="font-size:0.78rem;color:#8896a9;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${address}</div>` : ''}
            `;

            card.appendChild(checkEl);
            card.appendChild(bodyEl);

            card.addEventListener('click', () => {
                const isSelected = card.dataset.selected === 'true';
                if (isSelected) {
                    // Deselect
                    card.dataset.selected = 'false';
                    card.style.borderColor = 'rgba(255,255,255,0.09)';
                    card.style.background = 'rgba(255,255,255,0.03)';
                    checkEl.style.background = 'transparent';
                    checkEl.style.borderColor = 'rgba(255,255,255,0.2)';
                    checkEl.querySelector('svg').style.opacity = '0';
                    _selectedWorkplacesForMulti = _selectedWorkplacesForMulti.filter(s => s !== id);
                } else {
                    // Select
                    card.dataset.selected = 'true';
                    card.style.borderColor = '#8b5cf6';
                    card.style.background = 'rgba(139,92,246,0.12)';
                    checkEl.style.background = '#8b5cf6';
                    checkEl.style.borderColor = '#8b5cf6';
                    checkEl.querySelector('svg').style.opacity = '1';
                    _selectedWorkplacesForMulti.push(id);
                }
            });

            container.appendChild(card);
        });

        document.getElementById('multi-day-wizard-modal').classList.add('active');
    }

    function toggleWizardWorkplace(el, id) {
        const idx = _selectedWorkplacesForMulti.indexOf(id);
        if (idx >= 0) {
            _selectedWorkplacesForMulti.splice(idx, 1);
            el.classList.remove('wiz-card--selected');
        } else {
            _selectedWorkplacesForMulti.push(id);
            el.classList.add('wiz-card--selected');
        }
    }

    function closeMultiDayWizard() {
        document.getElementById('multi-day-wizard-modal').classList.remove('active');
    }

    function goToMultiDayCalendar() {
        console.log('[WIZARD] goToMultiDayCalendar chiamato');
        console.log('[WIZARD] _selectedWorkplacesForMulti:', [..._selectedWorkplacesForMulti]);
        
        if (_selectedWorkplacesForMulti.length === 0) {
            App.showToast('Attenzione', 'Seleziona almeno un posto di lavoro da copiare', 'warning');
            return;
        }

        closeMultiDayWizard();
        
        const singleBtn = document.getElementById('assignment-single-date-btn');
        const multiBtn = document.getElementById('assignment-multi-date-btn');
        const multiPanel = document.getElementById('assignment-multi-date-panel');
        const dateInput = document.getElementById('assignment-date');

        singleBtn.classList.remove('active');
        multiBtn.classList.add('active');
        multiPanel.style.display = 'block';
        dateInput.required = false;

        // Inizializza il calendario al mese corrente
        const today = new Date();
        _calYear = today.getFullYear();
        _calMonth = today.getMonth();

        // Salva la data originale della squadra per evidenziarla nel calendario
        _wizardOriginalDate = document.getElementById('assignment-date').value || null;
        if (_wizardOriginalDate) {
            // Naviga al mese della data originale se è diverso da oggi
            const origDate = new Date(_wizardOriginalDate + 'T00:00:00');
            _calYear = origDate.getFullYear();
            _calMonth = origDate.getMonth();
        }
        console.log('[WIZARD] Data originale:', _wizardOriginalDate, '| Calendario mese:', _calYear, _calMonth + 1);
        multiDates = [];
        
        renderCalendar();
        renderMultiDates();
        
        // silent - calendar opened
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
        updateEmployeeFilter,
        setDateMode,
        calendarPrev,
        calendarNext,
        toggleMultiDate,
        removeMultiDate,
        copyCurrentAssignment,
        pasteAssignment,
        openAttachmentsModal,
        closeAttachmentsModal,
        deleteAttachment,
        refreshActiveModals,
        closeMultiDayWizard,
        goToMultiDayCalendar,
        toggleWizardWorkplace
    };
})();
