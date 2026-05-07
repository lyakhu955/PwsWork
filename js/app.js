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

        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeMobileSidebar);
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

        // Check session IMMEDIATELY (sync)
        const hasSession = Auth.init();
        if (hasSession) {
            showApp();
        } else {
            showLogin();
        }

        // Wait for Firestore data to be ready, then refresh if needed
        Storage.onReady(() => {
            if (Auth.isLoggedIn()) {
                refreshCurrentPage();
            }
        });
    }

    // ==================== LOGIN/LOGOUT ====================
    function handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

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
        Storage.onReady(async () => {
            const result = await Auth.login(username, password);

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
        Availabilities.init();
        initSwipeGestures();

        // Navigate to dashboard
        navigateTo('dashboard');

        // Restore sidebar state
        const sidebar = document.getElementById('sidebar');
        if (Storage.getSidebarCollapsed() && window.innerWidth > 768) {
            sidebar.classList.add('collapsed');
        }

        // ======= DEEP LINK: ?date=YYYY-MM-DD =======
        const urlParams = new URLSearchParams(window.location.search);
        const deepDate = urlParams.get('date');
        if (deepDate && /^\d{4}-\d{2}-\d{2}$/.test(deepDate)) {
            // Navigate to schedule and open that day's detail modal
            navigateTo('schedule');
            setTimeout(() => {
                Schedule.openDetailModalByDate(deepDate, true);
                // Clean URL without reloading
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, '', cleanUrl);
            }, 400);
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
            availabilities: 'Disponibilità',
            hours: 'Ore Dipendenti',
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
            case 'availabilities': Availabilities.render(); break;
            case 'hours': Hours.render(); break;
            case 'profile': Profile.render(); break;
            case 'settings': renderSettings(); break;
        }

        // Close mobile sidebar
        closeMobileSidebar();
    }

    // ==================== SIDEBAR ====================
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        Storage.setSidebarCollapsed(sidebar.classList.contains('collapsed'));
    }

    function toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('mobile-open');
        if (overlay) {
            overlay.classList.toggle('active', sidebar.classList.contains('mobile-open'));
        }
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }

    // ==================== SWIPE GESTURES ====================
    let touchStartX = 0;
    let touchStartY = 0;

    function initSwipeGestures() {
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Horizontal swipe, and check if it's not a vertical scroll (Math.abs(diffX) > Math.abs(diffY))
            // Minimum distance of 80px for a more intentional gesture
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
                const sidebar = document.getElementById('sidebar');
                const isMobileOpen = sidebar.classList.contains('mobile-open');

                if (diffX > 0) {
                    // Swipe Right: Open sidebar if it's closed and we start from left area (up to 100px)
                    // Increased to 100px to not be too close to the edge (conflict with "back" gesture)
                    if (!isMobileOpen && touchStartX < 100) {
                        toggleMobileSidebar();
                    }
                } else {
                    // Swipe Left: Close sidebar if it's open
                    if (isMobileOpen) {
                        closeMobileSidebar();
                    }
                }
            }
        }, { passive: true });
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
        updateInstallButtonState();
    }

    function updateInstallButtonState() {
        const installBtn = document.getElementById('pwa-install-btn');
        const installStatus = document.getElementById('pwa-install-status');
        if (!installBtn || !installStatus) return;

        const pwa = window.PWAInstall;
        if (!pwa) {
            installBtn.disabled = true;
            installStatus.textContent = 'Installazione app non disponibile su questo browser.';
            return;
        }

        const state = pwa.getState();
        if (state === 'installed') {
            installBtn.disabled = true;
            installBtn.textContent = 'App già installata';
            installStatus.textContent = 'PwsWork è già installata su questo dispositivo.';
            return;
        }

        if (state === 'available') {
            installBtn.disabled = false;
            installBtn.textContent = 'Installa App';
            installStatus.textContent = 'Puoi installare PwsWork sul telefono per usarla come app.';
            return;
        }

        installBtn.disabled = true;
        installBtn.textContent = 'Installa App';
        installStatus.textContent = 'Per installare: apri dal browser del telefono e usa "Aggiungi a Home" o "Installa app".';
    }

    function bindSettingsForms() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn && !installBtn.dataset.bound) {
            installBtn.dataset.bound = 'true';
            installBtn.addEventListener('click', async () => {
                const pwa = window.PWAInstall;
                if (!pwa) {
                    showToast('Installazione', 'Installazione non supportata su questo browser', 'warning');
                    return;
                }

                const result = await pwa.promptInstall();
                if (result.ok) {
                    showToast('Installazione', 'Installazione avviata con successo', 'success');
                } else if (result.reason === 'dismissed') {
                    showToast('Installazione', 'Installazione annullata', 'info');
                } else {
                    showToast('Installazione', 'Installazione non disponibile al momento', 'warning');
                }

                updateInstallButtonState();
            });
        }

        if (!window.__pwaInstallStateBound) {
            window.__pwaInstallStateBound = true;
            window.addEventListener('pwa-install-state', updateInstallButtonState);
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
            case 'availabilities': Availabilities.render(); break;
            case 'hours': Hours.render(); break;
            case 'profile': Profile.render(); break;
        }
        if (typeof Schedule !== 'undefined' && Schedule.refreshActiveModals) {
            Schedule.refreshActiveModals();
        }
        Absences.updateNotificationBadge();
    }

    async function clearAppCache() {
        showConfirm('Aggiorna App', "Questa operazione svuoterà la cache, disconnetterà l'utente e ricaricherà l'ultima versione dell'applicazione. Procedere?", async () => {
            try {
                // Clear Service Worker Caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                        await caches.delete(name);
                    }
                }
                
                // Clear Local Storage Data (except theme to keep ui clean)
                const theme = localStorage.getItem('theme');
                localStorage.clear();
                if (theme) localStorage.setItem('theme', theme);
                sessionStorage.clear();
                
                // Unregister Service Workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                }

                // Hard reload
                window.location.reload(true);
            } catch (error) {
                console.error("Errore durante la pulizia della cache:", error);
                showToast('Errore', 'Si è verificato un errore durante la pulizia della cache', 'error');
            }
        });
    }

    // ==================== START APP ====================
    document.addEventListener('DOMContentLoaded', init);

    return {
        navigateTo,
        showToast,
        showConfirm,
        updateUserDisplay,
        updateAdminVisibility,
        refreshCurrentPage,
        clearAppCache
    };
})();
