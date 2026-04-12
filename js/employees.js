/* ========================================
   PWSWORK - EMPLOYEES MODULE
   Employee CRUD Operations
   ======================================== */

const Employees = (() => {
    let editingId = null;

    function init() {
        render();
        bindEvents();
    }

    function bindEvents() {
        // Add employee button
        const addBtn = document.getElementById('add-employee-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => openModal());
        }

        // Employee form submit
        const form = document.getElementById('employee-form');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }

        // Search
        const search = document.getElementById('employee-search');
        if (search) {
            search.addEventListener('input', (e) => {
                render(e.target.value);
            });
        }
    }

    function render(searchTerm = '') {
        const container = document.getElementById('employees-list');
        if (!container) return;

        let employees = Storage.getEmployees();
        const isAdmin = Auth.isAdmin();

        // Filter by search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            employees = employees.filter(emp =>
                emp.firstName.toLowerCase().includes(term) ||
                emp.lastName.toLowerCase().includes(term) ||
                emp.position.toLowerCase().includes(term) ||
                emp.email.toLowerCase().includes(term)
            );
        }

        if (employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <p>${searchTerm ? 'Nessun dipendente trovato' : 'Nessun dipendente registrato'}</p>
                    ${isAdmin && !searchTerm ? '<p style="font-size: 0.8rem;">Clicca "Nuovo Dipendente" per aggiungerne uno</p>' : ''}
                </div>
            `;
            return;
        }

        let html = '';
        employees.forEach((emp, index) => {
            const initials = (emp.firstName[0] + emp.lastName[0]).toUpperCase();
            const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#ec4899'];
            const bgColor = colors[index % colors.length];

            const roleBadge = emp.role === 'admin'
                ? '<span class="emp-role-badge emp-role-admin">🛡️ Admin</span>'
                : '<span class="emp-role-badge emp-role-employee">👷 Dipendente</span>';

            html += `
                <div class="employee-card glass-card stagger-item" style="animation-delay: ${index * 0.05}s">
                    <div class="employee-card-header">
                        <div class="employee-avatar" style="background: ${bgColor};">
                            ${initials}
                        </div>
                        <div>
                            <div class="employee-name">${emp.firstName} ${emp.lastName} ${roleBadge}</div>
                            <div class="employee-position">${emp.position}</div>
                        </div>
                    </div>
                    <div class="employee-details">
                        <div class="employee-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            ${emp.email || 'N/A'}
                        </div>
                        <div class="employee-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            ${emp.phone || 'N/A'}
                        </div>
                        <div class="employee-detail">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            @${emp.username}
                        </div>
                    </div>
                    ${isAdmin ? `
                    <div class="employee-actions">
                        <button class="btn btn-outline btn-sm" onclick="Employees.edit('${emp.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Modifica
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="Employees.confirmDelete('${emp.id}')" style="color: var(--danger);">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Elimina
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function openModal(employeeId = null) {
        editingId = employeeId;
        const modal = document.getElementById('employee-modal');
        const title = document.getElementById('employee-modal-title');
        const form = document.getElementById('employee-form');
        const passwordField = document.getElementById('emp-password');

        form.reset();

        const roleSelect = document.getElementById('emp-role');

        if (employeeId) {
            // Edit mode
            const emp = Storage.getEmployee(employeeId);
            if (!emp) return;

            title.textContent = 'Modifica Dipendente';
            document.getElementById('employee-id').value = emp.id;
            document.getElementById('emp-firstname').value = emp.firstName;
            document.getElementById('emp-lastname').value = emp.lastName;
            document.getElementById('emp-email').value = emp.email || '';
            document.getElementById('emp-phone').value = emp.phone || '';
            document.getElementById('emp-position').value = emp.position || '';
            document.getElementById('emp-username').value = emp.username;
            if (roleSelect) roleSelect.value = emp.role || 'employee';
            passwordField.placeholder = 'Lascia vuoto per non cambiare';
            passwordField.required = false;
        } else {
            // Create mode
            title.textContent = 'Nuovo Dipendente';
            document.getElementById('employee-id').value = '';
            if (roleSelect) roleSelect.value = 'employee';
            passwordField.placeholder = 'Password per il dipendente';
            passwordField.required = true;
        }

        modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('employee-modal');
        modal.classList.remove('active');
        editingId = null;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const data = {
            firstName: document.getElementById('emp-firstname').value.trim(),
            lastName: document.getElementById('emp-lastname').value.trim(),
            email: document.getElementById('emp-email').value.trim(),
            phone: document.getElementById('emp-phone').value.trim(),
            position: document.getElementById('emp-position').value.trim(),
            username: document.getElementById('emp-username').value.trim(),
            role: document.getElementById('emp-role').value || 'employee'
        };

        const password = document.getElementById('emp-password').value;

        // Validate username uniqueness
        const existing = Storage.getEmployeeByUsername(data.username);
        if (existing && existing.id !== editingId) {
            App.showToast('Errore', 'Nome utente già in uso', 'error');
            return;
        }

        if (editingId) {
            // Update
            if (password) {
                data.passwordHash = await CryptoUtil.hashSecret(password);
                data.password = '';
            }
            Storage.updateEmployee(editingId, data);
            App.showToast('Successo', 'Dipendente aggiornato con successo', 'success');
        } else {
            // Create
            data.passwordHash = await CryptoUtil.hashSecret(password);
            data.password = '';
            Storage.addEmployee(data);
            App.showToast('Successo', 'Dipendente aggiunto con successo', 'success');
        }

        closeModal();
        render();
        Dashboard.updateStats();
        Schedule.updateEmployeeFilter();
    }

    function edit(id) {
        openModal(id);
    }

    function confirmDelete(id) {
        const emp = Storage.getEmployee(id);
        if (!emp) return;

        App.showConfirm(
            'Elimina Dipendente',
            `Sei sicuro di voler eliminare ${emp.firstName} ${emp.lastName}? Tutti i turni associati verranno eliminati.`,
            () => {
                Storage.deleteEmployee(id);
                render();
                Dashboard.updateStats();
                Schedule.updateEmployeeFilter();
                App.showToast('Eliminato', 'Dipendente eliminato con successo', 'success');
            }
        );
    }

    return {
        init,
        render,
        openModal,
        closeModal,
        edit,
        confirmDelete
    };
})();
