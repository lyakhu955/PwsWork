/* ========================================
   PWSWORK - AVAILABILITIES MODULE
   ======================================== */

const Availabilities = (() => {

    let _selectedDate = null; // for custom calendar in modal

    function init() {
        const modalOverlay = document.getElementById('availability-modal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });
        }
        
        const form = document.getElementById('availability-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }
    }

    // ==================== RENDER ====================
    function render() {
        const container = document.getElementById('availabilities-content');
        if (!container) return;

        const isAdmin = Auth.isAdmin();
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        let html = '';

        // Header actions for admin
        if (isAdmin) {
            html += `
                <div style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
                    <button class="btn btn-primary" onclick="Availabilities.openModal()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Aggiungi Richiesta</span>
                    </button>
                </div>
            `;
        }

        const availabilities = Storage.getAvailabilities();
        
        // Group by Date
        const grouped = {};
        availabilities.forEach(av => {
            if (!grouped[av.date]) grouped[av.date] = [];
            grouped[av.date].push(av);
        });

        // Sort dates ascending
        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

        if (sortedDates.length === 0) {
            html += `
                <div class="glass-card" style="padding: 48px 24px; text-align: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; display: block; color: var(--text-tertiary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p style="color: var(--text-secondary); margin: 0;">Nessuna richiesta di disponibilità attiva.</p>
                </div>
            `;
        } else {
            html += '<div class="avail-list">';
            
            sortedDates.forEach(date => {
                const dateLabel = Storage.formatDateLong(date);
                const items = grouped[date];
                
                html += `
                    <div class="glass-card avail-date-accordion" style="margin-bottom: 14px; overflow: hidden;">
                        <div class="avail-date-header" onclick="Availabilities.toggleDate(this)">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <span style="font-weight: 700; font-size: 1.05rem;">${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>
                                <span class="badge badge-info">${items.length} ${items.length === 1 ? 'lavoro' : 'lavori'}</span>
                            </div>
                            <svg class="avail-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        <div class="avail-date-body">
                            <div class="avail-date-body-inner">
                `;

                items.forEach(av => {
                    const responses = av.responses || {};
                    const currentUserResponse = responses[currentUser.id];
                    
                    const presentNames = [];
                    const absentNames = [];

                    Object.keys(responses).forEach(empId => {
                        const emp = Storage.getEmployee(empId);
                        if (emp) {
                            const name = `${emp.firstName} ${emp.lastName}`.trim() || emp.username;
                            if (responses[empId] === 'present') {
                                presentNames.push(name);
                            } else if (responses[empId] === 'absent') {
                                absentNames.push(name);
                            }
                        }
                    });

                    html += `
                        <div class="avail-job-accordion" style="margin-bottom: 10px; background: var(--bg-primary); border-radius: var(--radius-md); box-shadow: var(--neu-inset-sm);">
                            <div class="avail-job-header" onclick="Availabilities.toggleJob(this)">
                                <strong style="font-size: 0.95rem;">${av.title}</strong>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    ${isAdmin ? `<button class="icon-btn" onclick="event.stopPropagation(); Availabilities.deleteRequest('${av.id}')" title="Elimina" style="color: var(--danger);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
                                    <svg class="avail-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </div>
                            <div class="avail-job-body">
                                <div class="avail-job-body-inner">
                                    <!-- Buttons -->
                                    <div style="display: flex; gap: 10px; margin-bottom: 18px; justify-content: center;">
                                        <button class="btn ${currentUserResponse === 'present' ? 'btn-success' : 'btn-outline'}" onclick="Availabilities.respond('${av.id}', 'present')" style="flex: 1; max-width: 180px;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                            Presente
                                        </button>
                                        <button class="btn ${currentUserResponse === 'absent' ? 'btn-danger' : 'btn-outline'}" onclick="Availabilities.respond('${av.id}', 'absent')" style="flex: 1; max-width: 180px;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            Assente
                                        </button>
                                    </div>
                                    <!-- Columns -->
                                    <div style="display: flex; gap: 14px;">
                                        <div style="flex: 1; background: var(--success-light); border-radius: var(--radius-md); padding: 14px;">
                                            <h4 style="color: var(--success); margin: 0 0 10px; text-align: center; font-size: 0.8rem; text-transform: uppercase; font-weight: 700;">Presenti (${presentNames.length})</h4>
                                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
                                                ${presentNames.length > 0 ? presentNames.map(n => `<li style="font-size: 0.85rem; padding: 5px 10px; background: rgba(16,185,129,0.15); border-radius: 6px; text-align: center;">${n}</li>`).join('') : '<li style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center;">Nessuno</li>'}
                                            </ul>
                                        </div>
                                        <div style="flex: 1; background: var(--danger-light); border-radius: var(--radius-md); padding: 14px;">
                                            <h4 style="color: var(--danger); margin: 0 0 10px; text-align: center; font-size: 0.8rem; text-transform: uppercase; font-weight: 700;">Assenti (${absentNames.length})</h4>
                                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
                                                ${absentNames.length > 0 ? absentNames.map(n => `<li style="font-size: 0.85rem; padding: 5px 10px; background: rgba(239,68,68,0.15); border-radius: 6px; text-align: center;">${n}</li>`).join('') : '<li style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center;">Nessuno</li>'}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });

                // Admin: "Add another job for this same date" button
                if (isAdmin) {
                    html += `
                        <button class="btn btn-outline btn-sm" onclick="Availabilities.openModalForDate('${date}')" style="width: 100%; margin-top: 4px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Aggiungi lavoro per questo giorno
                        </button>
                    `;
                }

                html += `
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    // ==================== ACCORDION TOGGLES ====================
    function toggleDate(headerEl) {
        const card = headerEl.closest('.avail-date-accordion');
        if (!card) return;
        card.classList.toggle('open');
    }

    function toggleJob(headerEl) {
        const card = headerEl.closest('.avail-job-accordion');
        if (!card) return;
        card.classList.toggle('open');
    }

    // ==================== MODAL (CUSTOM CALENDAR) ====================
    function openModal(presetDate) {
        _selectedDate = presetDate || null;
        const modal = document.getElementById('availability-modal');
        const form = document.getElementById('availability-form');
        if (!modal || !form) return;
        form.reset();
        _renderCalendar();
        _updateDateDisplay();
        modal.classList.add('active');
    }

    function openModalForDate(dateStr) {
        _selectedDate = dateStr;
        const modal = document.getElementById('availability-modal');
        const form = document.getElementById('availability-form');
        if (!modal || !form) return;
        form.reset();
        _renderCalendar();
        _updateDateDisplay();
        modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('availability-modal');
        if (modal) modal.classList.remove('active');
    }

    // ---- Custom Calendar Rendering ----
    let _calViewYear, _calViewMonth;

    function _renderCalendar() {
        const now = _selectedDate ? new Date(_selectedDate + 'T00:00:00') : new Date();
        if (!_calViewYear) _calViewYear = now.getFullYear();
        if (!_calViewMonth && _calViewMonth !== 0) _calViewMonth = now.getMonth();

        const grid = document.getElementById('avail-cal-grid');
        const titleEl = document.getElementById('avail-cal-title');
        if (!grid || !titleEl) return;

        const months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
        titleEl.textContent = `${months[_calViewMonth]} ${_calViewYear}`;

        const firstDay = new Date(_calViewYear, _calViewMonth, 1);
        let startDow = firstDay.getDay(); // 0=Sun
        startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0
        const daysInMonth = new Date(_calViewYear, _calViewMonth + 1, 0).getDate();

        const today = Storage.toLocalDateStr();

        let html = '<div class="avail-cal-dow">Lu</div><div class="avail-cal-dow">Ma</div><div class="avail-cal-dow">Me</div><div class="avail-cal-dow">Gi</div><div class="avail-cal-dow">Ve</div><div class="avail-cal-dow">Sa</div><div class="avail-cal-dow">Do</div>';

        for (let i = 0; i < startDow; i++) {
            html += '<div class="avail-cal-day empty"></div>';
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${_calViewYear}-${String(_calViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === _selectedDate;
            const dow = (startDow + d - 1) % 7; // 5=Sat, 6=Sun
            const isWeekend = dow === 5 || dow === 6;

            let cls = 'avail-cal-day';
            if (isToday) cls += ' today';
            if (isSelected) cls += ' selected';
            if (isWeekend) cls += ' weekend';

            html += `<div class="${cls}" onclick="Availabilities.selectDate('${dateStr}')">${d}</div>`;
        }

        grid.innerHTML = html;
    }

    function calPrev() {
        _calViewMonth--;
        if (_calViewMonth < 0) { _calViewMonth = 11; _calViewYear--; }
        _renderCalendar();
    }

    function calNext() {
        _calViewMonth++;
        if (_calViewMonth > 11) { _calViewMonth = 0; _calViewYear++; }
        _renderCalendar();
    }

    function selectDate(dateStr) {
        _selectedDate = dateStr;
        _renderCalendar();
        _updateDateDisplay();
    }

    function _updateDateDisplay() {
        const el = document.getElementById('avail-date-display');
        if (!el) return;
        if (_selectedDate) {
            el.textContent = Storage.formatDateLong(_selectedDate);
            el.style.color = 'var(--text-primary)';
        } else {
            el.textContent = 'Seleziona una data dal calendario';
            el.style.color = 'var(--text-tertiary)';
        }
    }

    // ==================== FORM SUBMIT ====================
    function handleFormSubmit(e) {
        e.preventDefault();

        const title = document.getElementById('avail-title').value.trim();

        if (!_selectedDate) {
            App.showToast('Errore', 'Seleziona una data dal calendario', 'error');
            return;
        }
        if (!title) {
            App.showToast('Errore', 'Inserisci il titolo del lavoro', 'error');
            return;
        }

        const btn = document.getElementById('avail-save-btn');
        if (btn) btn.disabled = true;

        Storage.addAvailability({
            date: _selectedDate,
            title: title,
            createdBy: Auth.getCurrentUser().id
        });

        App.showToast('Successo', 'Richiesta di disponibilità creata', 'success');
        closeModal();
        if (btn) btn.disabled = false;
    }

    // ==================== RESPOND ====================
    function respond(availabilityId, status) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        const av = Storage.getAvailabilities().find(a => a.id === availabilityId);
        if (!av) return;

        const currentResponses = av.responses || {};

        // Toggle: if same status, remove response
        if (currentResponses[currentUser.id] === status) {
            delete currentResponses[currentUser.id];
        } else {
            currentResponses[currentUser.id] = status;
        }

        Storage.updateAvailability(availabilityId, { responses: currentResponses });
    }

    // ==================== DELETE ====================
    function deleteRequest(id) {
        App.showConfirm(
            'Elimina Richiesta',
            'Sei sicuro di voler eliminare questa richiesta di disponibilità?',
            () => {
                Storage.deleteAvailability(id);
                App.showToast('Eliminato', 'Richiesta eliminata', 'info');
            }
        );
    }

    return {
        init,
        render,
        openModal,
        openModalForDate,
        closeModal,
        toggleDate,
        toggleJob,
        selectDate,
        calPrev,
        calNext,
        respond,
        deleteRequest
    };
})();
