/* ========================================
   PWSWORK - APP MODULE
   Main Application Router & Init
   ======================================== */

const App = (() => {
    let currentPage = 'dashboard';

    // ==================== INITIALIZATION ====================
    function init() {
        // Initialize storage (starts Firestore listeners)
        Storage.init();

        // Initialize theme (local, instant)
        Theme.init();

        // Bind UI elements immediately (they don't need data)
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }

        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
        }

        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(item.getAttribute('data-page'));
            });
        });

        bindSettingsForms();
        updateCurrentDate();
        bindConfirmDialog();

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => {
                    m.classList.remove('active');
                });
            }
        });

        // Wait for Firestore data to be ready, then check session
        Storage.onReady(() => {
            const hasSession = Auth.init();
            if (hasSession) {
                showApp();
            } else {
                showLogin();
            }
        });
    }

    // ==================== LOGIN/LOGOUT ====================
    function handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const adminCode = document.getElementById('login-admin-code').value.trim();

        if (!username || !password) {
            showToast('Errore', 'Inserisci nome utente e password', 'error');
            shakeElement(document.querySelector('.login-card'));
            return;
        }

        // Disable login button and show loading
        const loginBtn = document.querySelector('#login-form button[type="submit"]');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.dataset.originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<span class="spinner-sm"></span> Connessione...';
        }

        // Wait for Firestore data to be ready before authenticating
        Storage.onReady(() => {
            const result = Auth.login(username, password, adminCode);

            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = loginBtn.dataset.originalText;
            }

            if (result.success) {
                showToast('Benvenuto!', `Ciao ${Auth.getFullName()}!`, 'success');
                showApp();
            } else {
                showToast('Errore di accesso', result.error, 'error');
                shakeElement(document.querySelector('.login-card'));
            }
        });
    }

    function handleLogout() {
        showConfirm('Esci', 'Sei sicuro di voler uscire?', () => {
            Auth.logout();
            showLogin();
            showToast('Arrivederci', 'Sei uscito con successo', 'info');
        });
    }

    // ==================== PAGE MANAGEMENT ====================
    function showLogin() {
        document.getElementById('login-page').classList.add('active');
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('login-form').reset();
    }

    function showApp() {
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

        // Update user display
        updateUserDisplay();

        // Update admin visibility
        updateAdminVisibility();

        // Initialize all modules
        Dashboard.init();
        Employees.init();
        Schedule.init();
        Profile.init();
        Absences.init();

        // Navigate to dashboard
        navigateTo('dashboard');

        // Restore sidebar state
        const sidebar = document.getElementById('sidebar');
        if (Storage.getSidebarCollapsed() && window.innerWidth > 768) {
            sidebar.classList.add('collapsed');
        }
    }

    function navigateTo(page) {
        currentPage = page;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-page') === page);
        });

        // Show/hide pages
        document.querySelectorAll('.page-content').forEach(p => {
            p.classList.remove('active');
        });

        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.classList.add('active');
        }

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            employees: 'Dipendenti',
            schedule: 'Programma',
            absences: 'Assenze',
            profile: 'Profilo',
            settings: 'Impostazioni'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = titles[page] || page;

        // Refresh page content
        switch (page) {
            case 'dashboard': Dashboard.render(); break;
            case 'employees': Employees.render(); break;
            case 'schedule': Schedule.render(); break;
            case 'absences': Absences.render(); break;
            case 'profile': Profile.render(); break;
            case 'settings': renderSettings(); break;
        }

        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('mobile-open');
    }

    // ==================== SIDEBAR ====================
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        Storage.setSidebarCollapsed(sidebar.classList.contains('collapsed'));
    }

    function toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('mobile-open');
    }

    // ==================== UI UPDATES ====================
    function updateUserDisplay() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const fullName = Auth.getFullName();
        const initials = Auth.getInitials();
        const role = user.role === 'admin' ? 'Amministratore' : 'Dipendente';

        // Sidebar
        const sidebarAvatarText = document.getElementById('sidebar-avatar-text');
        const sidebarUsername = document.getElementById('sidebar-username');
        const sidebarRole = document.getElementById('sidebar-role');
        if (sidebarAvatarText) sidebarAvatarText.textContent = initials;
        if (sidebarUsername) sidebarUsername.textContent = fullName;
        if (sidebarRole) sidebarRole.textContent = role;

        // Topbar
        const topbarName = document.getElementById('topbar-name');
        if (topbarName) topbarName.textContent = fullName;
    }

    function updateAdminVisibility() {
        const isAdmin = Auth.isAdmin();

        // Sidebar admin items
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });

        // Admin badges
        document.querySelectorAll('.admin-only-badge').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
    }

    function updateCurrentDate() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('it-IT', options);
        }
    }

    // ==================== SETTINGS ====================
    function renderSettings() {
        // Settings page - no presets needed anymore
    }

    function bindSettingsForms() {
        // Admin code form
        const adminCodeForm = document.getElementById('admin-code-form');
        if (adminCodeForm) {
            adminCodeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const currentCode = document.getElementById('current-admin-code').value;
                const newCode = document.getElementById('new-admin-code').value;

                if (currentCode !== Storage.getAdminCode()) {
                    showToast('Errore', 'Codice admin attuale non corretto', 'error');
                    return;
                }

                if (!newCode || newCode.length < 4) {
                    showToast('Errore', 'Il nuovo codice deve essere almeno 4 caratteri', 'error');
                    return;
                }

                Storage.setAdminCode(newCode);
                adminCodeForm.reset();
                showToast('Successo', 'Codice admin aggiornato', 'success');
            });
        }

        // Reset all
        const resetBtn = document.getElementById('reset-all-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                showConfirm(
                    'Resetta Dati',
                    'Sei sicuro di voler cancellare TUTTI i dati? Questa azione è irreversibile.',
                    () => {
                        Storage.resetAll();
                        Auth.logout();
                        showLogin();
                        showToast('Completato', 'Tutti i dati sono stati resettati', 'info');
                    }
                );
            });
        }
    }

    // ==================== TOAST NOTIFICATIONS ====================
    function showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // ==================== CONFIRM DIALOG ====================
    let confirmCallback = null;

    function bindConfirmDialog() {
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('confirm-dialog').classList.remove('active');
                confirmCallback = null;
            });
        }

        if (okBtn) {
            okBtn.addEventListener('click', () => {
                document.getElementById('confirm-dialog').classList.remove('active');
                if (confirmCallback) {
                    confirmCallback();
                    confirmCallback = null;
                }
            });
        }
    }

    function showConfirm(title, message, callback) {
        const dialog = document.getElementById('confirm-dialog');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        confirmCallback = callback;

        dialog.classList.add('active');
    }

    // ==================== HELPERS ====================
    function shakeElement(element) {
        if (!element) return;
        element.classList.add('animate-shake');
        setTimeout(() => element.classList.remove('animate-shake'), 500);
    }

    // ==================== REFRESH (called by Firestore real-time sync) ====================
    function refreshCurrentPage() {
        if (!Auth.isLoggedIn()) return;
        switch (currentPage) {
            case 'dashboard': Dashboard.render(); break;
            case 'employees': Employees.render(); break;
            case 'schedule': Schedule.render(); break;
            case 'absences': Absences.render(); break;
            case 'profile': Profile.render(); break;
        }
        Absences.updateNotificationBadge();
    }

    // ==================== START APP ====================
    document.addEventListener('DOMContentLoaded', init);

    return {
        navigateTo,
        showToast,
        showConfirm,
        updateUserDisplay,
        refreshCurrentPage
    };
})();
