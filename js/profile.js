/* ========================================
   PWSWORK - PROFILE MODULE
   User Profile Management
   ======================================== */

const Profile = (() => {

    function init() {
        render();
        bindEvents();
    }

    function bindEvents() {
        // Profile form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', handleProfileSubmit);
        }

        // Password form
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', handlePasswordSubmit);
        }
    }

    function render() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        // Update profile header
        const avatarText = document.getElementById('profile-avatar-text');
        const profileName = document.getElementById('profile-name');
        const roleBadge = document.getElementById('profile-role-badge');

        if (avatarText) avatarText.textContent = Auth.getInitials();
        if (profileName) profileName.textContent = Auth.getFullName();
        
        if (roleBadge) {
            if (user.role === 'admin') {
                roleBadge.textContent = 'Amministratore';
                roleBadge.className = 'profile-role-badge admin';
            } else {
                roleBadge.textContent = 'Dipendente';
                roleBadge.className = 'profile-role-badge employee';
            }
        }

        // Fill form fields
        const fullnameInput = document.getElementById('profile-fullname');
        const emailInput = document.getElementById('profile-email');
        const phoneInput = document.getElementById('profile-phone');
        const positionInput = document.getElementById('profile-position');

        if (fullnameInput) fullnameInput.value = Auth.getFullName();
        if (emailInput) emailInput.value = user.email || '';
        if (phoneInput) phoneInput.value = user.phone || '';
        if (positionInput) positionInput.value = user.position || '';
    }

    function handleProfileSubmit(e) {
        e.preventDefault();

        const user = Auth.getCurrentUser();
        if (!user) return;

        const fullname = document.getElementById('profile-fullname').value.trim();
        const email = document.getElementById('profile-email').value.trim();
        const phone = document.getElementById('profile-phone').value.trim();

        // Parse full name
        const parts = fullname.split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        const updateData = {
            firstName,
            lastName,
            email,
            phone
        };

        // Update in storage if it's a registered employee
        if (user.id && user.id.startsWith('emp_')) {
            Storage.updateEmployee(user.id, updateData);
        }

        // Update current session
        Auth.updateCurrentUser(updateData);

        // Update UI
        render();
        App.updateUserDisplay();
        App.showToast('Successo', 'Profilo aggiornato con successo', 'success');
    }

    function handlePasswordSubmit(e) {
        e.preventDefault();

        const user = Auth.getCurrentUser();
        if (!user) return;

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validate
        if (!currentPassword || !newPassword || !confirmPassword) {
            App.showToast('Errore', 'Compila tutti i campi', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            App.showToast('Errore', 'Le password non corrispondono', 'error');
            return;
        }

        if (newPassword.length < 4) {
            App.showToast('Errore', 'La password deve essere almeno 4 caratteri', 'error');
            return;
        }

        // Check current password
        if (user.id && user.id.startsWith('emp_')) {
            const employee = Storage.getEmployee(user.id);
            if (employee && employee.password !== currentPassword) {
                App.showToast('Errore', 'Password attuale non corretta', 'error');
                return;
            }

            Storage.updateEmployee(user.id, { password: newPassword });
        }

        // Reset form
        document.getElementById('password-form').reset();
        App.showToast('Successo', 'Password aggiornata con successo', 'success');
    }

    return {
        init,
        render
    };
})();
