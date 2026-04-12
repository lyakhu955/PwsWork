/* ========================================
   PWSWORK - AUTH MODULE
   Login, Roles & Session Management
   ======================================== */

const Auth = (() => {
    let currentUser = null;

    function init() {
        const savedUser = Storage.getCurrentUser();
        if (savedUser) {
            currentUser = savedUser;
            return true;
        }
        return false;
    }

    function login(username, password, adminCode) {
        // Check if admin login
        if (adminCode && adminCode === Storage.getAdminCode()) {
            // Admin login - just needs valid admin code + any username/password
            const employee = Storage.getEmployeeByUsername(username);
            
            currentUser = {
                id: employee ? employee.id : 'admin_master',
                employeeId: employee ? employee.id : null,
                username: username,
                firstName: employee ? employee.firstName : username,
                lastName: employee ? employee.lastName : '',
                position: employee ? employee.position : 'Amministratore',
                email: employee ? employee.email : '',
                phone: employee ? employee.phone : '',
                role: 'admin'
            };
            
            Storage.setCurrentUser(currentUser);
            return { success: true, user: currentUser };
        }

        // Employee login
        const employee = Storage.getEmployeeByUsername(username);
        
        if (!employee) {
            return { success: false, error: 'Nome utente non trovato' };
        }
        
        if (employee.password !== password) {
            return { success: false, error: 'Password non corretta' };
        }

        // Wrong admin code
        if (adminCode && adminCode !== Storage.getAdminCode()) {
            return { success: false, error: 'Codice admin non valido' };
        }

        currentUser = {
            id: employee.id,
            employeeId: employee.id,
            username: employee.username,
            firstName: employee.firstName,
            lastName: employee.lastName,
            position: employee.position,
            email: employee.email,
            phone: employee.phone,
            role: 'employee'
        };

        Storage.setCurrentUser(currentUser);
        return { success: true, user: currentUser };
    }

    function logout() {
        currentUser = null;
        Storage.clearCurrentUser();
    }

    function getCurrentUser() {
        return currentUser;
    }

    function isAdmin() {
        return currentUser && currentUser.role === 'admin';
    }

    function isLoggedIn() {
        return currentUser !== null;
    }

    function updateCurrentUser(data) {
        if (currentUser) {
            currentUser = { ...currentUser, ...data };
            Storage.setCurrentUser(currentUser);
        }
    }

    function getFullName() {
        if (!currentUser) return 'Utente';
        return `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.username;
    }

    function getInitials() {
        if (!currentUser) return 'U';
        const first = currentUser.firstName ? currentUser.firstName[0] : '';
        const last = currentUser.lastName ? currentUser.lastName[0] : '';
        return (first + last).toUpperCase() || currentUser.username[0].toUpperCase();
    }

    return {
        init,
        login,
        logout,
        getCurrentUser,
        isAdmin,
        isLoggedIn,
        updateCurrentUser,
        getFullName,
        getInitials
    };
})();
