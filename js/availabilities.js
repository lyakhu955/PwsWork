/* ========================================
   PWSWORK - AVAILABILITIES MODULE
   ======================================== */

const Availabilities = (() => {

    function init() {
        // Event listeners are bound inside render or here if static
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
                <div class="availabilities-actions" style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
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

        // Sort dates (newest/upcoming first)
        const sortedDates = Object.keys(grouped).sort((a, b) => {
            return new Date(a) - new Date(b); // Ascending order
        });

        if (sortedDates.length === 0) {
            html += `
                <div class="empty-state glass-card" style="padding: 40px; text-align: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 15px; color: var(--text-tertiary);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p style="color: var(--text-secondary);">Nessuna richiesta di disponibilità attiva.</p>
                </div>
            `;
        } else {
            html += `<div class="availabilities-list" style="display: flex; flex-direction: column; gap: 15px;">`;
            
            sortedDates.forEach(date => {
                const dateLabel = Storage.formatDateLong(date);
                const items = grouped[date];
                
                html += `
                    <div class="glass-card avail-date-card collapsed">
                        <div class="section-header accordion-header" onclick="this.parentElement.classList.toggle('collapsed')" style="margin-bottom: 0; padding: 15px 20px; cursor: pointer;">
                            <h3 style="margin: 0; font-size: 1.1rem;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
                            </h3>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span class="badge badge-info">${items.length} ${items.length === 1 ? 'lavoro' : 'lavori'}</span>
                                <button class="accordion-toggle icon-btn" title="Comprimi/Espandi">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                            </div>
                        </div>
                        <div class="accordion-content" style="padding: 0 20px 20px 20px;">
                            <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
                `;

                items.forEach(av => {
                    const responses = av.responses || {};
                    const currentUserResponse = responses[currentUser.id];
                    
                    // Arrays to hold names
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
                        <div class="avail-job-card glass-card collapsed" style="box-shadow: var(--neu-inset-sm); background: var(--bg-primary);">
                            <div class="accordion-header" onclick="this.parentElement.classList.toggle('collapsed')" style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <strong style="font-size: 1.05rem;">${av.title}</strong>
                                </div>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    ${isAdmin ? `<button class="icon-btn danger-text" onclick="event.stopPropagation(); Availabilities.deleteRequest('${av.id}')" title="Elimina"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
                                    <button class="accordion-toggle icon-btn" title="Comprimi/Espandi">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="accordion-content" style="padding: 0 15px 15px 15px; border-top: 1px dashed var(--border-color);">
                                
                                <!-- User Actions -->
                                <div style="display: flex; gap: 10px; margin: 15px 0; justify-content: center;">
                                    <button class="btn ${currentUserResponse === 'present' ? 'btn-success' : 'btn-outline'}" onclick="Availabilities.respond('${av.id}', 'present')" style="flex: 1; max-width: 200px;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                        Presente
                                    </button>
                                    <button class="btn ${currentUserResponse === 'absent' ? 'btn-danger' : 'btn-outline'}" onclick="Availabilities.respond('${av.id}', 'absent')" style="flex: 1; max-width: 200px;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        Assente
                                    </button>
                                </div>

                                <!-- Two Columns -->
                                <div class="avail-columns" style="display: flex; gap: 20px; margin-top: 20px;">
                                    <div style="flex: 1; background: var(--success-light); border-radius: var(--radius-md); padding: 15px;">
                                        <h4 style="color: var(--success); margin-bottom: 10px; text-align: center; font-size: 0.9rem; text-transform: uppercase;">Presenti (${presentNames.length})</h4>
                                        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                            ${presentNames.map(n => `<li style="font-size: 0.9rem; padding: 6px 10px; background: rgba(255,255,255,0.1); border-radius: 6px;">${n}</li>`).join('')}
                                            ${presentNames.length === 0 ? '<li style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center;">Nessuno</li>' : ''}
                                        </ul>
                                    </div>
                                    <div style="flex: 1; background: var(--danger-light); border-radius: var(--radius-md); padding: 15px;">
                                        <h4 style="color: var(--danger); margin-bottom: 10px; text-align: center; font-size: 0.9rem; text-transform: uppercase;">Assenti (${absentNames.length})</h4>
                                        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                            ${absentNames.map(n => `<li style="font-size: 0.9rem; padding: 6px 10px; background: rgba(255,255,255,0.1); border-radius: 6px;">${n}</li>`).join('')}
                                            ${absentNames.length === 0 ? '<li style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center;">Nessuno</li>' : ''}
                                        </ul>
                                    </div>
                                </div>

                            </div>
                        </div>
                    `;
                });

                html += `
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    function openModal() {
        const modal = document.getElementById('availability-modal');
        const form = document.getElementById('availability-form');
        if (modal && form) {
            form.reset();
            const dateInput = document.getElementById('avail-date');
            if(dateInput) {
                // Pre-fill with tomorrow or next Saturday
                const d = new Date();
                d.setDate(d.getDate() + 1);
                dateInput.value = Storage.toLocalDateStr(d);
            }
            modal.classList.add('active');
        }
    }

    function closeModal() {
        const modal = document.getElementById('availability-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        
        const date = document.getElementById('avail-date').value;
        const title = document.getElementById('avail-title').value.trim();

        if (!date || !title) {
            App.showToast('Errore', 'Compila tutti i campi', 'error');
            return;
        }

        const btn = document.getElementById('avail-save-btn');
        if(btn) btn.disabled = true;

        const availability = {
            date: date,
            title: title,
            createdBy: Auth.getCurrentUser().id
        };

        Storage.addAvailability(availability);
        App.showToast('Successo', 'Richiesta di disponibilità creata', 'success');
        
        closeModal();
        if(btn) btn.disabled = false;
        
        // Non forziamo render qui, _onDataChange in Storage si attiverà
    }

    function respond(availabilityId, status) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        const av = Storage.getAvailabilities().find(a => a.id === availabilityId);
        if (!av) return;

        const currentResponses = av.responses || {};
        
        // Se lo stato è uguale, forse l'utente vuole toglierlo? Di solito no, ma lo lasciamo così (o potremmo implementare un toggle)
        if (currentResponses[currentUser.id] === status) {
            delete currentResponses[currentUser.id];
        } else {
            currentResponses[currentUser.id] = status;
        }

        Storage.updateAvailability(availabilityId, { responses: currentResponses });
        // Storage triggererà refreshCurrentPage e la UI si aggiornerà fluidamente
    }

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
        closeModal,
        respond,
        deleteRequest
    };
})();
