/* ========================================
   PWSWORK - ABSENCES MODULE
   Ferie, Malattie, Permessi Management
   with Calendar Picker & Notifications
   Firestore + In-Memory Cache
   ======================================== */

const Absences = (() => {
    // ==================== FIRESTORE COLLECTIONS ====================
    const COLLECTIONS = {
        ABSENCES: 'absences',
        LEAVE_REQUESTS: 'leaveRequests',
        NOTIFICATIONS: 'notifications'
    };

    const ABSENCE_TYPES = {
        ferie: { label: 'Ferie', icon: '🏖️', color: '#3b82f6', colorLight: 'rgba(59,130,246,0.15)' },
        malattia: { label: 'Malattia', icon: '🤒', color: '#ef4444', colorLight: 'rgba(239,68,68,0.15)' },
        permesso: { label: 'Permesso', icon: '📋', color: '#8b5cf6', colorLight: 'rgba(139,92,246,0.15)' }
    };

    const REQUEST_STATUS = {
        pending: { label: 'In Attesa', color: '#f59e0b', icon: '🟡' },
        approved: { label: 'Approvata', color: '#10b981', icon: '🟢' },
        rejected: { label: 'Rifiutata', color: '#ef4444', icon: '🔴' }
    };

    let calendarSelectedDates = [];
    let calendarMonth = new Date().getMonth();
    let calendarYear = new Date().getFullYear();

    // ==================== IN-MEMORY CACHE ====================
    let _absences = [];
    let _leaveRequests = [];
    let _notifications = [];
    let _listenersStarted = false;

    // ==================== INIT ====================
    function init() {
        _startListeners();
        updateNotificationBadge();
    }

    function _startListeners() {
        if (_listenersStarted) return;
        _listenersStarted = true;

        // --- Absences listener ---
        db.collection(COLLECTIONS.ABSENCES).onSnapshot((snapshot) => {
            _absences = [];
            snapshot.forEach((doc) => {
                _absences.push({ ...doc.data(), id: doc.id });
            });
        }, (error) => {
            console.error('Firestore absences listener error:', error);
        });

        // --- Leave Requests listener ---
        db.collection(COLLECTIONS.LEAVE_REQUESTS).onSnapshot((snapshot) => {
            _leaveRequests = [];
            snapshot.forEach((doc) => {
                _leaveRequests.push({ ...doc.data(), id: doc.id });
            });
        }, (error) => {
            console.error('Firestore leaveRequests listener error:', error);
        });

        // --- Notifications listener ---
        db.collection(COLLECTIONS.NOTIFICATIONS).orderBy('createdAt', 'desc').limit(100).onSnapshot((snapshot) => {
            _notifications = [];
            snapshot.forEach((doc) => {
                _notifications.push({ ...doc.data(), id: doc.id });
            });
            updateNotificationBadge();
        }, (error) => {
            console.error('Firestore notifications listener error:', error);
        });
    }

    // ==================== DATA ACCESS (from cache) ====================
    function getAbsences() {
        return [..._absences];
    }

    function getLeaveRequests() {
        return [..._leaveRequests];
    }

    function getNotifications() {
        return [..._notifications];
    }

    function saveAbsences(absences) {
        // Not used anymore — individual add/delete operations instead
    }

    function saveLeaveRequests(requests) {
        // Not used anymore — individual operations instead
    }

    function saveNotifications(notifications) {
        // Not used anymore — individual operations instead
    }

    // ==================== NOTIFICATIONS ====================
    function addNotification(userId, message, type, relatedId) {
        const notif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            userId: userId,
            message: message,
            type: type,
            read: false,
            createdAt: new Date().toISOString(),
            relatedId: relatedId || null
        };

        // Optimistic cache update
        _notifications.unshift(notif);

        // Write to Firestore
        db.collection(COLLECTIONS.NOTIFICATIONS).doc(notif.id).set(notif).catch(err => {
            console.error('Error adding notification:', err);
        });

        updateNotificationBadge();
    }

    function getMyNotifications() {
        const user = Auth.getCurrentUser();
        if (!user) return [];
        if (Auth.isAdmin()) {
            return _notifications.filter(n => n.userId === 'admin' || n.userId === user.id);
        }
        return _notifications.filter(n => n.userId === user.id);
    }

    function markNotificationRead(notifId) {
        const n = _notifications.find(x => x.id === notifId);
        if (n) {
            n.read = true;
            db.collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).update({ read: true }).catch(err => {
                console.error('Error marking notification read:', err);
            });
        }
        updateNotificationBadge();
    }

    function markAllNotificationsRead() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const batch = db.batch();
        _notifications.forEach(n => {
            let shouldMark = false;
            if (Auth.isAdmin()) {
                if (n.userId === 'admin' || n.userId === user.id) shouldMark = true;
            } else {
                if (n.userId === user.id) shouldMark = true;
            }
            if (shouldMark && !n.read) {
                n.read = true;
                batch.update(db.collection(COLLECTIONS.NOTIFICATIONS).doc(n.id), { read: true });
            }
        });
        batch.commit().catch(err => {
            console.error('Error marking all notifications read:', err);
        });
        updateNotificationBadge();
    }

    function updateNotificationBadge() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        const unread = getMyNotifications().filter(n => !n.read).length;
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }

    function toggleNotificationsPanel() {
        const panel = document.getElementById('notifications-panel');
        if (!panel) return;
        const isActive = panel.classList.contains('active');
        if (isActive) {
            panel.classList.remove('active');
        } else {
            renderNotificationsPanel();
            panel.classList.add('active');
        }
    }

    function renderNotificationsPanel() {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        const myNotifs = getMyNotifications().slice(0, 20);
        
        if (myNotifs.length === 0) {
            list.innerHTML = '<div class="notif-empty">Nessuna notifica</div>';
            return;
        }

        list.innerHTML = myNotifs.map(n => {
            const time = formatTimeAgo(n.createdAt);
            const typeIcons = {
                'request_new': '📩',
                'request_approved': '✅',
                'request_rejected': '❌',
                'absence_added': '📅'
            };
            // Determine destination tab based on notification type
            let clickAction = `Absences.markNotificationRead('${n.id}'); Absences.updateNotificationBadge(); this.classList.remove('unread'); this.classList.add('read');`;
            if (n.type === 'request_new') {
                // Admin: go to "Richieste Ferie" tab
                clickAction += ` Absences.goToTab('requests');`;
            } else if (n.type === 'request_approved' || n.type === 'request_rejected') {
                // Employee: go to "Le Mie Richieste" tab
                clickAction += ` Absences.goToTab('myrequests');`;
            } else if (n.type === 'absence_added') {
                // Navigate to calendar view
                if (Auth.isAdmin()) {
                    clickAction += ` Absences.goToTab('manage');`;
                } else {
                    clickAction += ` Absences.goToTab('mycalendar');`;
                }
            }
            return `
                <div class="notif-item ${n.read ? 'read' : 'unread'}" onclick="${clickAction}" style="cursor:pointer;">
                    <span class="notif-icon">${typeIcons[n.type] || '🔔'}</span>
                    <div class="notif-content">
                        <p class="notif-message">${n.message}</p>
                        <span class="notif-time">${time}</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.3;"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
            `;
        }).join('');
    }

    function formatTimeAgo(isoStr) {
        const now = new Date();
        const then = new Date(isoStr);
        const diffMs = now - then;
        const minutes = Math.floor(diffMs / 60000);
        if (minutes < 1) return 'Adesso';
        if (minutes < 60) return `${minutes} min fa`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h fa`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}g fa`;
        return Storage.formatDateIT(isoStr.split('T')[0]);
    }

    // ==================== MAIN RENDER ====================
    function render() {
        const container = document.getElementById('absences-content');
        if (!container) return;

        const isAdmin = Auth.isAdmin();
        const user = Auth.getCurrentUser();

        let html = '';

        // --- Tab bar ---
        html += `<div class="absences-tabs">`;
        if (isAdmin) {
            html += `
                <button class="abs-tab active" onclick="Absences.switchTab('manage')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Gestisci Assenze
                </button>
                <button class="abs-tab" onclick="Absences.switchTab('requests')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Richieste Ferie
                    <span class="abs-tab-badge" id="pending-requests-badge"></span>
                </button>
                <button class="abs-tab" onclick="Absences.switchTab('overview')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    Riepilogo
                </button>
            `;
        } else {
            html += `
                <button class="abs-tab active" onclick="Absences.switchTab('mycalendar')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Le Mie Assenze
                </button>
                <button class="abs-tab" onclick="Absences.switchTab('request')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Richiedi Ferie
                </button>
                <button class="abs-tab" onclick="Absences.switchTab('myrequests')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Le Mie Richieste
                </button>
            `;
        }
        html += `</div>`;

        html += `<div id="absences-tab-content" class="absences-tab-content"></div>`;
        container.innerHTML = html;

        // Render default tab
        if (isAdmin) {
            renderManageTab();
        } else {
            renderMyCalendarTab();
        }

        // Update pending badge
        updatePendingBadge();
    }

    function switchTab(tabName, skipActiveClass) {
        const tabs = document.querySelectorAll('.abs-tab');
        tabs.forEach(btn => btn.classList.remove('active'));
        
        if (!skipActiveClass) {
            // Find and activate the correct tab button
            const tabMap = Auth.isAdmin()
                ? ['manage', 'requests', 'overview']
                : ['mycalendar', 'request', 'myrequests'];
            const idx = tabMap.indexOf(tabName);
            if (idx >= 0 && tabs[idx]) {
                tabs[idx].classList.add('active');
            }
        }

        switch (tabName) {
            case 'manage': renderManageTab(); break;
            case 'requests': renderRequestsTab(); break;
            case 'overview': renderOverviewTab(); break;
            case 'mycalendar': renderMyCalendarTab(); break;
            case 'request': renderRequestFormTab(); break;
            case 'myrequests': renderMyRequestsTab(); break;
        }
    }

    // Navigate from notification click → absences page + specific tab
    function goToTab(tabName) {
        // Close notification panel
        const panel = document.getElementById('notifications-panel');
        if (panel) panel.classList.remove('active');

        // Navigate to absences page
        App.navigateTo('absences');

        // Small delay to let the page render, then switch tab
        setTimeout(() => {
            switchTab(tabName);
        }, 100);
    }

    function updatePendingBadge() {
        const badge = document.getElementById('pending-requests-badge');
        if (!badge) return;
        const pending = _leaveRequests.filter(r => r.status === 'pending').length;
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }

    // ==================== ADMIN: MANAGE TAB ====================
    function renderManageTab() {
        const content = document.getElementById('absences-tab-content');
        const employees = Storage.getEmployees();

        let html = `
            <div class="abs-manage-section">
                <div class="abs-manage-header">
                    <h4>Registra Assenza</h4>
                    <p>Seleziona un dipendente, scegli il tipo e i giorni dal calendario</p>
                </div>
                <div class="abs-manage-form glass-card">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Dipendente</label>
                            <select id="abs-employee-select" class="form-select">
                                <option value="">-- Seleziona dipendente --</option>
                                ${employees.map(e => `<option value="${e.id}">${e.firstName} ${e.lastName}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Tipo Assenza</label>
                            <select id="abs-type-select" class="form-select">
                                <option value="ferie">🏖️ Ferie</option>
                                <option value="malattia">🤒 Malattia</option>
                                <option value="permesso">📋 Permesso</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Giorni Selezionati</label>
                        <div class="abs-selected-dates" id="abs-selected-dates">
                            <span class="abs-no-dates">Nessun giorno selezionato — clicca sul calendario</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Note (opzionale)</label>
                        <input type="text" id="abs-note" class="form-input" placeholder="Es: Visita medica, motivi personali...">
                    </div>
                    <button class="btn btn-primary" onclick="Absences.saveAdminAbsence()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Salva Assenza
                    </button>
                </div>
                <div class="abs-calendar-wrapper glass-card">
                    <div id="abs-admin-calendar"></div>
                </div>
            </div>
        `;

        html += renderAbsencesList(null);

        content.innerHTML = html;
        calendarSelectedDates = [];
        renderCalendar('abs-admin-calendar', true);

        // Add event listener to employee select to update calendar with their absences
        const empSelect = document.getElementById('abs-employee-select');
        if (empSelect) {
            empSelect.addEventListener('change', (e) => {
                calendarSelectedDates = [];
                renderCalendar('abs-admin-calendar', true, e.target.value || null);
            });
        }
    }

    // ==================== ADMIN: REQUESTS TAB ====================
    function renderRequestsTab() {
        const content = document.getElementById('absences-tab-content');
        const requests = getLeaveRequests();
        const pendingRequests = requests.filter(r => r.status === 'pending');
        const handledRequests = requests.filter(r => r.status !== 'pending');

        let html = '<div class="abs-requests-section">';

        html += `<h4 class="abs-section-title">⏳ Richieste in Attesa (${pendingRequests.length})</h4>`;
        if (pendingRequests.length === 0) {
            html += '<div class="abs-empty glass-card">Nessuna richiesta in attesa</div>';
        } else {
            pendingRequests.forEach(req => {
                const emp = Storage.getEmployee(req.employeeId);
                const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Sconosciuto';
                const dates = req.dates.map(d => Storage.formatDateIT(d)).join(', ');
                html += `
                    <div class="abs-request-card glass-card pending">
                        <div class="abs-request-header">
                            <div class="abs-request-emp">
                                <strong>${empName}</strong>
                                <span class="abs-type-badge" style="background:${ABSENCE_TYPES.ferie.colorLight};color:${ABSENCE_TYPES.ferie.color}">🏖️ Ferie</span>
                            </div>
                            <span class="abs-request-date-info">${req.dates.length} giorno/i</span>
                        </div>
                        <div class="abs-request-dates">📅 ${dates}</div>
                        ${req.note ? `<div class="abs-request-note">💬 ${req.note}</div>` : ''}
                        <div class="abs-request-actions">
                            <button class="btn btn-sm btn-success" onclick="Absences.handleRequest('${req.id}', 'approved')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                Approva
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="Absences.promptRejectRequest('${req.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                Rifiuta
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += `<h4 class="abs-section-title" style="margin-top:24px;">📋 Storico Richieste</h4>`;
        if (handledRequests.length === 0) {
            html += '<div class="abs-empty glass-card">Nessuna richiesta gestita</div>';
        } else {
            handledRequests.slice(0, 20).forEach(req => {
                const emp = Storage.getEmployee(req.employeeId);
                const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Sconosciuto';
                const dates = req.dates.map(d => Storage.formatDateIT(d)).join(', ');
                const st = REQUEST_STATUS[req.status];
                html += `
                    <div class="abs-request-card glass-card ${req.status}">
                        <div class="abs-request-header">
                            <div class="abs-request-emp">
                                <strong>${empName}</strong>
                                <span class="abs-status-badge" style="color:${st.color}">${st.icon} ${st.label}</span>
                            </div>
                        </div>
                        <div class="abs-request-dates">📅 ${dates}</div>
                        ${req.rejectionReason ? `<div class="abs-request-note">❌ Motivo: ${req.rejectionReason}</div>` : ''}
                    </div>
                `;
            });
        }

        html += '</div>';
        content.innerHTML = html;
    }

    // ==================== ADMIN: OVERVIEW TAB ====================
    function renderOverviewTab() {
        const content = document.getElementById('absences-tab-content');
        const employees = Storage.getEmployees();
        const absences = getAbsences();

        let html = '<div class="abs-overview-section">';
        html += '<h4 class="abs-section-title">📊 Riepilogo Assenze per Dipendente</h4>';

        employees.forEach(emp => {
            const empAbsences = absences.filter(a => a.employeeId === emp.id);
            const ferieCount = empAbsences.filter(a => a.type === 'ferie').reduce((sum, a) => sum + a.dates.length, 0);
            const malattiaCount = empAbsences.filter(a => a.type === 'malattia').reduce((sum, a) => sum + a.dates.length, 0);
            const permessoCount = empAbsences.filter(a => a.type === 'permesso').reduce((sum, a) => sum + a.dates.length, 0);
            const total = ferieCount + malattiaCount + permessoCount;
            const hasAbsences = total > 0 ? 'has-absences' : '';

            html += `
                <div class="abs-overview-card glass-card ${hasAbsences}" onclick="Absences.openAbsencesDetailModal('${emp.id}', '${emp.firstName}', '${emp.lastName}')">
                    <div class="abs-overview-name">
                        <div class="abs-overview-avatar">${emp.firstName[0]}${emp.lastName[0]}</div>
                        <div>
                            <strong>${emp.firstName} ${emp.lastName}</strong>
                            <span class="abs-overview-total">${total} giorni totali</span>
                        </div>
                    </div>
                    <div class="abs-overview-counts">
                        <div class="abs-count-item" style="border-left: 3px solid ${ABSENCE_TYPES.ferie.color}">
                            <span class="abs-count-val">${ferieCount}</span>
                            <span class="abs-count-label">🏖️ Ferie</span>
                        </div>
                        <div class="abs-count-item" style="border-left: 3px solid ${ABSENCE_TYPES.malattia.color}">
                            <span class="abs-count-val">${malattiaCount}</span>
                            <span class="abs-count-label">🤒 Malattia</span>
                        </div>
                        <div class="abs-count-item" style="border-left: 3px solid ${ABSENCE_TYPES.permesso.color}">
                            <span class="abs-count-val">${permessoCount}</span>
                            <span class="abs-count-label">📋 Permesso</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        content.innerHTML = html;
    }

    // ==================== EMPLOYEE: MY CALENDAR TAB ====================
    function renderMyCalendarTab() {
        const content = document.getElementById('absences-tab-content');
        const user = Auth.getCurrentUser();
        const empId = user?.employeeId || user?.id;

        let html = `
            <div class="abs-my-calendar-section">
                <div class="abs-calendar-wrapper glass-card">
                    <div id="abs-my-calendar"></div>
                </div>
                <div class="abs-legend">
                    <span class="abs-legend-item"><span class="abs-legend-dot" style="background:${ABSENCE_TYPES.ferie.color}"></span> Ferie</span>
                    <span class="abs-legend-item"><span class="abs-legend-dot" style="background:${ABSENCE_TYPES.malattia.color}"></span> Malattia</span>
                    <span class="abs-legend-item"><span class="abs-legend-dot" style="background:${ABSENCE_TYPES.permesso.color}"></span> Permesso</span>
                    <span class="abs-legend-item"><span class="abs-legend-dot" style="background:#f59e0b"></span> In Attesa</span>
                    <span class="abs-legend-item"><span class="abs-legend-dot" style="background:#ef4444"></span> Festivo</span>
                </div>
            </div>
        `;

        html += renderAbsencesList(empId);

        content.innerHTML = html;
        calendarSelectedDates = [];
        renderCalendar('abs-my-calendar', false, empId);
    }

    // ==================== EMPLOYEE: REQUEST FORM TAB ====================
    function renderRequestFormTab() {
        const content = document.getElementById('absences-tab-content');

        let html = `
            <div class="abs-request-form-section">
                <div class="abs-manage-header">
                    <h4>Richiedi Ferie</h4>
                    <p>Seleziona i giorni dal calendario e invia la richiesta all'amministratore</p>
                </div>
                <div class="abs-manage-form glass-card">
                    <div class="form-group">
                        <label>Giorni Selezionati</label>
                        <div class="abs-selected-dates" id="abs-selected-dates">
                            <span class="abs-no-dates">Nessun giorno selezionato — clicca sul calendario</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Motivazione (opzionale)</label>
                        <textarea id="abs-request-note" class="form-input" rows="2" placeholder="Es: Vacanza, impegno familiare..."></textarea>
                    </div>
                    <button class="btn btn-primary" onclick="Absences.submitLeaveRequest()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Invia Richiesta
                    </button>
                </div>
                <div class="abs-calendar-wrapper glass-card">
                    <div id="abs-request-calendar"></div>
                </div>
            </div>
        `;

        content.innerHTML = html;
        calendarSelectedDates = [];
        renderCalendar('abs-request-calendar', true);
    }

    // ==================== EMPLOYEE: MY REQUESTS TAB ====================
    function renderMyRequestsTab() {
        const content = document.getElementById('absences-tab-content');
        const user = Auth.getCurrentUser();
        const empId = user?.employeeId || user?.id;
        const requests = _leaveRequests.filter(r => r.employeeId === empId);

        let html = '<div class="abs-my-requests-section">';
        html += `<h4 class="abs-section-title">📋 Le Mie Richieste (${requests.length})</h4>`;

        if (requests.length === 0) {
            html += '<div class="abs-empty glass-card">Non hai ancora fatto richieste di ferie</div>';
        } else {
            requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            requests.forEach(req => {
                const dates = req.dates.map(d => Storage.formatDateIT(d)).join(', ');
                const st = REQUEST_STATUS[req.status];
                html += `
                    <div class="abs-request-card glass-card ${req.status}">
                        <div class="abs-request-header">
                            <span class="abs-status-badge" style="color:${st.color}">${st.icon} ${st.label}</span>
                            <span class="abs-request-date-info">${req.dates.length} giorno/i</span>
                        </div>
                        <div class="abs-request-dates">📅 ${dates}</div>
                        ${req.note ? `<div class="abs-request-note">💬 ${req.note}</div>` : ''}
                        ${req.rejectionReason ? `<div class="abs-request-note abs-rejection">❌ Motivo rifiuto: ${req.rejectionReason}</div>` : ''}
                    </div>
                `;
            });
        }

        html += '</div>';
        content.innerHTML = html;
    }

    // ==================== CALENDAR RENDERER ====================
    function renderCalendar(containerId, selectable, viewEmployeeId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
            'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

        const absences = getAbsences();
        const requests = getLeaveRequests();

        let html = `
            <div class="abs-cal-header">
                <button class="btn btn-outline btn-sm abs-cal-nav" onclick="Absences.calNavMonth(-1, '${containerId}', ${selectable}, '${viewEmployeeId || ''}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <h4 class="abs-cal-title">${monthNames[calendarMonth]} ${calendarYear}</h4>
                <button class="btn btn-outline btn-sm abs-cal-nav" onclick="Absences.calNavMonth(1, '${containerId}', ${selectable}, '${viewEmployeeId || ''}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
            <div class="abs-cal-grid">
        `;

        dayNames.forEach(d => {
            html += `<div class="abs-cal-day-header">${d}</div>`;
        });

        const firstDay = new Date(calendarYear, calendarMonth, 1);
        let startDow = firstDay.getDay();
        startDow = startDow === 0 ? 6 : startDow - 1;

        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

        for (let i = 0; i < startDow; i++) {
            html += '<div class="abs-cal-cell empty"></div>';
        }

        const today = Storage.toLocalDateStr();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = calendarSelectedDates.includes(dateStr);
            const isSunday = new Date(calendarYear, calendarMonth, day).getDay() === 0;
            const holidayInfo = Storage.isHoliday(dateStr);
            const isNonWorking = isSunday || !!holidayInfo;

            let absenceInfo = null;
            let pendingInfo = null;
            if (viewEmployeeId) {
                const abs = absences.find(a => a.employeeId === viewEmployeeId && a.dates.includes(dateStr));
                if (abs) absenceInfo = abs;
                const req = requests.find(r => r.employeeId === viewEmployeeId && r.dates.includes(dateStr) && r.status === 'pending');
                if (req) pendingInfo = req;
            }

            let classes = 'abs-cal-cell';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (isSunday) classes += ' sunday';
            if (holidayInfo) classes += ' holiday';
            if (absenceInfo) classes += ` absence-${absenceInfo.type}`;
            if (pendingInfo) classes += ' absence-pending';

            let dotHtml = '';
            if (holidayInfo) {
                dotHtml = `<span class="abs-cal-holiday-label" title="${holidayInfo.name}">🔴</span>`;
            }
            
            // Show emoji badges for existing absences (admin manage tab)
            if (viewEmployeeId && viewEmployeeId.trim() && containerId === 'abs-admin-calendar') {
                const empAbsences = absences.filter(a => a.employeeId === viewEmployeeId && a.dates.includes(dateStr));
                if (empAbsences.length > 0) {
                    const emojis = empAbsences.map(a => ABSENCE_TYPES[a.type].icon).join('');
                    dotHtml = `<span class="abs-cal-emoji-badge" title="Assenze registrate">${emojis}</span>`;
                }
            }
            
            // Show dot for absences in other views
            if (!dotHtml && absenceInfo) {
                dotHtml = `<span class="abs-cal-dot" style="background:${ABSENCE_TYPES[absenceInfo.type].color}" title="${ABSENCE_TYPES[absenceInfo.type].label}"></span>`;
            }
            if (!dotHtml && pendingInfo) {
                dotHtml = `<span class="abs-cal-dot" style="background:#f59e0b" title="Richiesta in attesa"></span>`;
            }

            const clickHandler = selectable && !isNonWorking
                ? `onclick="Absences.toggleCalendarDate('${dateStr}', '${containerId}', ${selectable}, '${viewEmployeeId || ''}')"`
                : '';

            html += `<div class="${classes}" ${clickHandler}><span class="abs-cal-day-num">${day}</span>${dotHtml}</div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function calNavMonth(dir, containerId, selectable, viewEmployeeId) {
        calendarMonth += dir;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        renderCalendar(containerId, selectable, viewEmployeeId || null);
    }

    function toggleCalendarDate(dateStr, containerId, selectable, viewEmployeeId) {
        const idx = calendarSelectedDates.indexOf(dateStr);
        
        // If trying to add a date
        if (idx === -1) {
            // Check for conflicts ONLY in admin manage tab
            if (containerId === 'abs-admin-calendar' && viewEmployeeId && viewEmployeeId.trim()) {
                const absences = getAbsences();
                const selectedType = document.getElementById('abs-type-select')?.value;
                
                // Check if this date has an absence of DIFFERENT type
                const conflictAbsence = absences.find(a =>
                    a.employeeId === viewEmployeeId &&
                    a.dates.includes(dateStr) &&
                    a.type !== selectedType
                );
                
                if (conflictAbsence) {
                    const typeInfo = ABSENCE_TYPES[conflictAbsence.type];
                    App.showToast('Errore', `Questo giorno ha già un'assenza di tipo ${typeInfo.label}`, 'error');
                    return;
                }
            }
            
            calendarSelectedDates.push(dateStr);
        } else {
            // Removing a date
            calendarSelectedDates.splice(idx, 1);
        }
        
        // Merge overlapping dates (smart deduplication)
        calendarSelectedDates = mergeDateRanges(calendarSelectedDates);
        calendarSelectedDates.sort();
        
        renderCalendar(containerId, selectable, viewEmployeeId || null);
        updateSelectedDatesUI();
    }

    function mergeDateRanges(dates) {
        if (dates.length === 0) return [];
        
        // Sort dates
        const sorted = [...dates].sort();
        const merged = [sorted[0]];
        
        for (let i = 1; i < sorted.length; i++) {
            const current = new Date(sorted[i] + 'T00:00:00');
            const last = new Date(merged[merged.length - 1] + 'T00:00:00');
            const diffDays = Math.floor((current - last) / (1000 * 60 * 60 * 24));
            
            // If dates are adjacent or same, fill the gap
            if (diffDays <= 1) {
                // Fill in any missing dates between last and current
                const filledDates = getDateRangeBetween(merged[merged.length - 1], sorted[i]);
                merged.push(...filledDates.slice(1)); // Skip first (already in merged)
            } else {
                merged.push(sorted[i]);
            }
        }
        
        return [...new Set(merged)]; // Remove any remaining duplicates
    }

    function getDateRangeBetween(startStr, endStr) {
        const dates = [];
        const current = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        
        while (current <= end) {
            const dateStr = Storage.toLocalDateStr(current);
            dates.push(dateStr);
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    }

    function updateSelectedDatesUI() {
        const container = document.getElementById('abs-selected-dates');
        if (!container) return;

        if (calendarSelectedDates.length === 0) {
            container.innerHTML = '<span class="abs-no-dates">Nessun giorno selezionato — clicca sul calendario</span>';
        } else {
            container.innerHTML = calendarSelectedDates.map(d =>
                `<span class="abs-date-chip">${Storage.formatDateIT(d)} <button onclick="Absences.removeSelectedDate('${d}')">&times;</button></span>`
            ).join('');
        }
    }

    function removeSelectedDate(dateStr) {
        calendarSelectedDates = calendarSelectedDates.filter(d => d !== dateStr);
        updateSelectedDatesUI();
        const calEls = document.querySelectorAll('[id^="abs-"][id$="-calendar"]');
        calEls.forEach(el => {
            if (el.innerHTML) {
                const selectable = el.id !== 'abs-my-calendar';
                const empId = el.id === 'abs-my-calendar' ? (Auth.getCurrentUser()?.employeeId || Auth.getCurrentUser()?.id) : null;
                renderCalendar(el.id, selectable, empId);
            }
        });
    }

    // ==================== ABSENCES LIST ====================
    function renderAbsencesList(employeeId) {
        const absences = getAbsences();
        const filtered = employeeId ? absences.filter(a => a.employeeId === employeeId) : absences;

        if (filtered.length === 0) {
            return `<div class="abs-section-title" style="margin-top:24px;">📋 Assenze Registrate</div>
                    <div class="abs-empty glass-card">Nessuna assenza registrata</div>`;
        }

        filtered.sort((a, b) => {
            const aDate = a.dates[a.dates.length - 1] || '';
            const bDate = b.dates[b.dates.length - 1] || '';
            return bDate.localeCompare(aDate);
        });

        let html = `<div class="abs-section-title" style="margin-top:24px;">📋 Assenze Registrate (${filtered.length})</div>`;

        filtered.forEach(abs => {
            const emp = Storage.getEmployee(abs.employeeId);
            const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Sconosciuto';
            const typeInfo = ABSENCE_TYPES[abs.type] || ABSENCE_TYPES.ferie;
            const dates = abs.dates.map(d => Storage.formatDateIT(d)).join(', ');

            html += `
                <div class="abs-record-card glass-card">
                    <div class="abs-record-header">
                        <div>
                            ${!employeeId ? `<strong>${empName}</strong> — ` : ''}
                            <span class="abs-type-badge" style="background:${typeInfo.colorLight};color:${typeInfo.color}">${typeInfo.icon} ${typeInfo.label}</span>
                        </div>
                        ${Auth.isAdmin() ? `<button class="btn btn-outline btn-sm btn-danger" onclick="Absences.deleteAbsence('${abs.id}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>` : ''}
                    </div>
                    <div class="abs-record-dates">📅 ${dates} (${abs.dates.length} gg)</div>
                    ${abs.note ? `<div class="abs-record-note">💬 ${abs.note}</div>` : ''}
                </div>
            `;
        });

        return html;
    }

    // ==================== SPLIT DATE RANGES ====================
    function splitDateRanges(dates) {
        if (dates.length === 0) return [];

        const sorted = [...dates].sort();
        const ranges = [];
        let currentRange = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const current = new Date(sorted[i] + 'T00:00:00');
            const last = new Date(sorted[i - 1] + 'T00:00:00');
            const diffDays = Math.floor((current - last) / (1000 * 60 * 60 * 24));

            // If dates are adjacent (1 day apart), add to current range
            if (diffDays === 1) {
                currentRange.push(sorted[i]);
            } else {
                // Gap found, start new range
                ranges.push(currentRange);
                currentRange = [sorted[i]];
            }
        }

        // Add the last range
        ranges.push(currentRange);

        return ranges;
    }

    // ==================== ACTIONS ====================
    function saveAdminAbsence() {
        const empId = document.getElementById('abs-employee-select').value;
        const type = document.getElementById('abs-type-select').value;
        const note = document.getElementById('abs-note')?.value || '';

        if (!empId) {
            App.showToast('Errore', 'Seleziona un dipendente', 'error');
            return;
        }
        if (calendarSelectedDates.length === 0) {
            App.showToast('Errore', 'Seleziona almeno un giorno dal calendario', 'error');
            return;
        }

        // Check for conflicts with OTHER types of absences
        const absences = getAbsences();
        const conflictingDates = [];
        const existingSameDates = [];

        calendarSelectedDates.forEach(dateStr => {
            const conflictAbsence = absences.find(a => 
                a.employeeId === empId && 
                a.dates.includes(dateStr) && 
                a.type !== type
            );
            if (conflictAbsence) {
                conflictingDates.push(dateStr);
            }

            // Track same-type dates for merging
            const sameType = absences.find(a =>
                a.employeeId === empId &&
                a.dates.includes(dateStr) &&
                a.type === type
            );
            if (sameType) {
                existingSameDates.push(dateStr);
            }
        });

        // Block if there are conflicting dates with different type
        if (conflictingDates.length > 0) {
            const conflictDatesStr = conflictingDates.map(d => Storage.formatDateIT(d)).join(', ');
            App.showToast('Errore', `I giorni ${conflictDatesStr} hanno già un'assenza di tipo diverso`, 'error');
            return;
        }

        // Merge with existing absences of SAME type
        let datesToSave = [...calendarSelectedDates];
        const existingSameTypeRecords = absences.filter(a => 
            a.employeeId === empId && 
            a.type === type
        );

        if (existingSameTypeRecords.length > 0) {
            // Collect all dates from existing records
            existingSameTypeRecords.forEach(rec => {
                datesToSave.push(...rec.dates);
            });
            // Remove duplicates and sort
            datesToSave = [...new Set(datesToSave)].sort();

            // Delete old records
            existingSameTypeRecords.forEach(rec => {
                _absences = _absences.filter(a => a.id !== rec.id);
                db.collection(COLLECTIONS.ABSENCES).doc(rec.id).delete().catch(err => {
                    console.error('Error deleting old absence:', err);
                });
            });
        }

        // Split into ranges by gaps (non-contiguous dates)
        const dateRanges = splitDateRanges(datesToSave);
        const savedRecords = [];

        // Create and save a record for each range
        dateRanges.forEach(rangeData => {
            const newAbsence = {
                id: 'abs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                type: type,
                dates: rangeData,
                note: note,
                createdBy: 'admin',
                createdAt: new Date().toISOString()
            };

            // Optimistic cache update
            _absences.push({ ...newAbsence });
            savedRecords.push(newAbsence);

            // Write to Firestore
            db.collection(COLLECTIONS.ABSENCES).doc(newAbsence.id).set(newAbsence).catch(err => {
                console.error('Error saving absence:', err);
            });
        });

        // Notify the employee with total days across all ranges
        const emp = Storage.getEmployee(empId);
        const typeLabel = ABSENCE_TYPES[type].label;
        const totalDays = datesToSave.length;
        addNotification(
            empId,
            `L'admin ti ha registrato ${totalDays} giorno/i di ${typeLabel}`,
            'absence_added',
            savedRecords[0]?.id
        );

        calendarSelectedDates = [];
        App.showToast('Salvato', `Assenza registrata con successo (${totalDays} giorni in ${dateRanges.length} periodo/i)`, 'success');
        
        // Reset only specific fields, keep employee and type selected
        const absNote = document.getElementById('abs-note');
        if (absNote) absNote.value = '';
        
        // Re-render calendar and selected dates UI, but keep form state
        renderCalendar('abs-admin-calendar', true, empId);
        updateSelectedDatesUI();
        renderAbsencesList(null);
    }

    function deleteAbsence(absId) {
        App.showConfirm('Elimina Assenza', 'Sei sicuro di voler eliminare questa assenza?', () => {
            _absences = _absences.filter(a => a.id !== absId);

            db.collection(COLLECTIONS.ABSENCES).doc(absId).delete().catch(err => {
                console.error('Error deleting absence:', err);
            });

            App.showToast('Eliminato', 'Assenza eliminata', 'info');
            render();
        });
    }

    function submitLeaveRequest() {
        const user = Auth.getCurrentUser();
        const empId = user?.employeeId || user?.id;
        const note = document.getElementById('abs-request-note')?.value || '';

        if (calendarSelectedDates.length === 0) {
            App.showToast('Errore', 'Seleziona almeno un giorno dal calendario', 'error');
            return;
        }

        const newRequest = {
            id: 'req_' + Date.now(),
            employeeId: empId,
            dates: [...calendarSelectedDates],
            note: note,
            status: 'pending',
            rejectionReason: '',
            createdAt: new Date().toISOString()
        };

        _leaveRequests.push({ ...newRequest });

        db.collection(COLLECTIONS.LEAVE_REQUESTS).doc(newRequest.id).set(newRequest).catch(err => {
            console.error('Error submitting leave request:', err);
        });

        // Notify admin
        const emp = Storage.getEmployee(empId);
        const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Dipendente';
        addNotification(
            'admin',
            `${empName} ha richiesto ${calendarSelectedDates.length} giorno/i di ferie`,
            'request_new',
            newRequest.id
        );

        calendarSelectedDates = [];
        App.showToast('Inviata', 'Richiesta ferie inviata all\'amministratore', 'success');
        renderRequestFormTab();
    }

    function handleRequest(reqId, status) {
        const req = _leaveRequests.find(r => r.id === reqId);
        if (!req) return;

        req.status = status;

        if (status === 'approved') {
            // Auto-create absence entry
            const newAbs = {
                id: 'abs_' + Date.now(),
                employeeId: req.employeeId,
                type: 'ferie',
                dates: [...req.dates],
                note: req.note || 'Approvata da admin',
                createdBy: 'request_approved',
                createdAt: new Date().toISOString()
            };
            _absences.push({ ...newAbs });

            db.collection(COLLECTIONS.ABSENCES).doc(newAbs.id).set(newAbs).catch(err => {
                console.error('Error creating absence from request:', err);
            });

            addNotification(
                req.employeeId,
                `La tua richiesta di ferie (${req.dates.length} gg) è stata APPROVATA ✅`,
                'request_approved',
                req.id
            );
            App.showToast('Approvata', 'Richiesta ferie approvata', 'success');
        }

        // Update request in Firestore
        db.collection(COLLECTIONS.LEAVE_REQUESTS).doc(reqId).update({
            status: status
        }).catch(err => {
            console.error('Error updating leave request:', err);
        });

        renderRequestsTab();
        updatePendingBadge();
    }

    function promptRejectRequest(reqId) {
        const reason = prompt('Motivo del rifiuto (opzionale):');
        if (reason === null) return;

        const req = _leaveRequests.find(r => r.id === reqId);
        if (!req) return;

        req.status = 'rejected';
        req.rejectionReason = reason || '';

        db.collection(COLLECTIONS.LEAVE_REQUESTS).doc(reqId).update({
            status: 'rejected',
            rejectionReason: reason || ''
        }).catch(err => {
            console.error('Error rejecting leave request:', err);
        });

        addNotification(
            req.employeeId,
            `La tua richiesta di ferie (${req.dates.length} gg) è stata RIFIUTATA ❌${reason ? ': ' + reason : ''}`,
            'request_rejected',
            req.id
        );

        App.showToast('Rifiutata', 'Richiesta ferie rifiutata', 'info');
        renderRequestsTab();
        updatePendingBadge();
    }

    // ==================== CHECK IF EMPLOYEE IS ABSENT ====================
    function isEmployeeAbsent(employeeId, dateStr) {
        return _absences.find(a => a.employeeId === employeeId && a.dates && a.dates.includes(dateStr));
    }

    // ==================== RESET ALL (called by Storage.resetAll) ====================
    function resetAll() {
        const batch = db.batch();

        _absences.forEach(a => {
            batch.delete(db.collection(COLLECTIONS.ABSENCES).doc(a.id));
        });
        _leaveRequests.forEach(r => {
            batch.delete(db.collection(COLLECTIONS.LEAVE_REQUESTS).doc(r.id));
        });
        _notifications.forEach(n => {
            batch.delete(db.collection(COLLECTIONS.NOTIFICATIONS).doc(n.id));
        });

        batch.commit().catch(err => {
            console.error('Error resetting absences data:', err);
        });

        _absences = [];
        _leaveRequests = [];
        _notifications = [];
    }

    // ==================== CLOSE NOTIFICATIONS ON OUTSIDE CLICK ====================
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notifications-panel');
        const bell = document.getElementById('notification-bell');
        if (panel && panel.classList.contains('active') && !panel.contains(e.target) && !bell?.contains(e.target)) {
            panel.classList.remove('active');
        }
    });

    // ==================== ABSENCES DETAIL MODAL ====================
    function openAbsencesDetailModal(employeeId, firstName, lastName) {
        const modal = document.getElementById('absences-detail-modal');
        if (!modal) return;

        const absences = getAbsences();
        const empAbsences = absences.filter(a => a.employeeId === employeeId);

        // Organizza per tipo
        const byType = {
            ferie: empAbsences.filter(a => a.type === 'ferie'),
            malattia: empAbsences.filter(a => a.type === 'malattia'),
            permesso: empAbsences.filter(a => a.type === 'permesso')
        };

        let html = `
            <div class="modal-header">
                <h3>Assenze — ${firstName} ${lastName}</h3>
                <button class="modal-close" onclick="Absences.closeAbsencesDetailModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body">
        `;

        // Ferie
        if (byType.ferie.length > 0) {
            html += `<div class="abs-detail-section">
                <h4 style="color: ${ABSENCE_TYPES.ferie.color}; margin-bottom: 12px;">🏖️ Ferie</h4>
                <div class="abs-detail-list">`;
            byType.ferie.forEach(absence => {
                const totalDays = absence.dates.length;
                const dateRange = absence.dates.length > 0 
                    ? `${new Date(absence.dates[0] + 'T00:00:00').toLocaleDateString('it-IT')} — ${new Date(absence.dates[absence.dates.length - 1] + 'T00:00:00').toLocaleDateString('it-IT')}`
                    : '';
                html += `
                    <div class="abs-detail-item">
                        <div class="abs-detail-info">
                            <span class="abs-detail-dates">${dateRange}</span>
                            <span class="abs-detail-count">${totalDays} giorno${totalDays > 1 ? 'i' : ''}</span>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Malattia
        if (byType.malattia.length > 0) {
            html += `<div class="abs-detail-section">
                <h4 style="color: ${ABSENCE_TYPES.malattia.color}; margin-bottom: 12px;">🤒 Malattia</h4>
                <div class="abs-detail-list">`;
            byType.malattia.forEach(absence => {
                const totalDays = absence.dates.length;
                const dateRange = absence.dates.length > 0 
                    ? `${new Date(absence.dates[0] + 'T00:00:00').toLocaleDateString('it-IT')} — ${new Date(absence.dates[absence.dates.length - 1] + 'T00:00:00').toLocaleDateString('it-IT')}`
                    : '';
                html += `
                    <div class="abs-detail-item">
                        <div class="abs-detail-info">
                            <span class="abs-detail-dates">${dateRange}</span>
                            <span class="abs-detail-count">${totalDays} giorno${totalDays > 1 ? 'i' : ''}</span>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        // Permesso
        if (byType.permesso.length > 0) {
            html += `<div class="abs-detail-section">
                <h4 style="color: ${ABSENCE_TYPES.permesso.color}; margin-bottom: 12px;">📋 Permessi</h4>
                <div class="abs-detail-list">`;
            byType.permesso.forEach(absence => {
                const totalDays = absence.dates.length;
                const dateRange = absence.dates.length > 0 
                    ? `${new Date(absence.dates[0] + 'T00:00:00').toLocaleDateString('it-IT')} — ${new Date(absence.dates[absence.dates.length - 1] + 'T00:00:00').toLocaleDateString('it-IT')}`
                    : '';
                html += `
                    <div class="abs-detail-item">
                        <div class="abs-detail-info">
                            <span class="abs-detail-dates">${dateRange}</span>
                            <span class="abs-detail-count">${totalDays} giorno${totalDays > 1 ? 'i' : ''}</span>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        if (empAbsences.length === 0) {
            html += `<div class="abs-empty">Nessuna assenza registrata</div>`;
        }

        html += `</div>`;
        
        modal.innerHTML = html;
        modal.classList.add('active');
    }

    function closeAbsencesDetailModal() {
        const modal = document.getElementById('absences-detail-modal');
        if (modal) modal.classList.remove('active');
    }

    return {
        init,
        render,
        switchTab,
        goToTab,
        calNavMonth,
        toggleCalendarDate,
        removeSelectedDate,
        saveAdminAbsence,
        deleteAbsence,
        submitLeaveRequest,
        handleRequest,
        promptRejectRequest,
        toggleNotificationsPanel,
        markNotificationRead,
        markAllNotificationsRead,
        updateNotificationBadge,
        isEmployeeAbsent,
        resetAll,
        openAbsencesDetailModal,
        closeAbsencesDetailModal,
        ABSENCE_TYPES
    };
})();
