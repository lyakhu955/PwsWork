/* ========================================
   PWSWORK - THEME MODULE
   Dark/Light Theme Toggle
   ======================================== */

const Theme = (() => {
    function init() {
        const savedTheme = Storage.getTheme();
        applyTheme(savedTheme);
        
        // Bind toggle buttons
        const loginToggle = document.getElementById('theme-toggle-login');
        const appToggle = document.getElementById('theme-toggle-app');
        
        if (loginToggle) {
            loginToggle.addEventListener('click', toggle);
        }
        if (appToggle) {
            appToggle.addEventListener('click', toggle);
        }
    }

    function toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        
        // Add transition class for smooth theme change
        document.body.classList.add('theme-transitioning');
        
        applyTheme(newTheme);
        Storage.setTheme(newTheme);
        
        // Remove transition class after animation
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 500);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme');
    }

    return {
        init,
        toggle,
        applyTheme,
        getCurrentTheme
    };
})();
