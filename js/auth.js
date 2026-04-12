/* ========================================
   PWSWORK - AUTH MODULE
   Login, Roles & Session Management
   ======================================== */

const Auth = (() => {
    let currentUser = null;

    // Boss admin credentials (cannot be deleted or changed)
    const BOSS = {
        username: 'Mauro.boss',
        password: 'presidente2103'
    };

    function init() {
        const savedUser = Storage.getCurrentUser();
        if (savedUser) {
            currentUser = savedUser;
            return true;
        }
        return false;
    }

    function login(username, password) {
        // 1. Check if boss admin
        if (username === BOSS.username && password === BOSS.password) {
            currentUser = {
                id: 'boss_admin',
                employeeId: null,
                username: BOSS.username,
                firstName: 'Mauro',
                lastName: 'Boss',
                position: 'Amministratore Capo',
                email: '',
                phone: '',
                role: 'admin',
                isBoss: true
            };
            Storage.setCurrentUser(currentUser);
            return { success: true, user: currentUser };
        }

        // 2. Check employees (admin or regular)
        const employee = Storage.getEmployeeByUsername(username);
        
        if (!employee) {
            return { success: false, error: 'Nome utente non trovato' };
        }
        
        if (employee.password !== password) {
            return { success: false, error: 'Password non corretta' };
        }

        const role = employee.role || 'employee';

        currentUser = {
            id: employee.id,
            employeeId: employee.id,
            username: employee.username,
            firstName: employee.firstName,
            lastName: employee.lastName,
            position: employee.position,
            email: employee.email,
            phone: employee.phone,
            role: role,
            isBoss: false
        };

        Storage.setCurrentUser(currentUser);
        return { success: true, user: currentUser };
    }

    function isBoss() {
        return currentUser && currentUser.isBoss === true;
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
        isBoss,
        isLoggedIn,
        updateCurrentUser,
        getFullName,
        getInitials
    };
})();
