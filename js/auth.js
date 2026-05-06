/* ========================================
   PWSWORK - AUTH MODULE
   Login, Roles & Session Management
   ======================================== */

const Auth = (() => {
    let currentUser = null;

    // Boss admin credentials (hashed, cannot be deleted or changed)
    const BOSS = {
        usernameHash: 'sha256$e23bc031bf806224544dc1832e3abde3dfb46e571d4181f4fceeb941e6975e9e',
        passwordHash: 'sha256$1cd8a3e172fc28d707e9cb01ffcaf122ffce6d8ac539be0cd8085c5de430ebb1'
    };

    async function migrateLegacyEmployeePasswords() {
        const employees = Storage.getEmployees();
        for (const employee of employees) {
            if (employee.password && !employee.passwordHash) {
                try {
                    const passwordHash = await CryptoUtil.hashSecret(employee.password);
                    Storage.updateEmployee(employee.id, {
                        passwordHash,
                        password: ''
                    });
                } catch (error) {
                    console.error('Password migration error for employee:', employee.id, error);
                }
            }
        }
    }

    function init() {
        const savedUser = Storage.getCurrentUser();
        migrateLegacyEmployeePasswords();
        if (savedUser) {
            currentUser = savedUser;
            return true;
        }
        return false;
    }

    async function login(username, password) {
        const normalizedUsername = String(username || '').trim();

        // 1. Check if boss admin
        let isBossUsername = await CryptoUtil.verifySecret(normalizedUsername, BOSS.usernameHash);
        if (!isBossUsername) isBossUsername = await CryptoUtil.verifySecret(normalizedUsername.toLowerCase(), BOSS.usernameHash);
        if (!isBossUsername) isBossUsername = await CryptoUtil.verifySecret(normalizedUsername.charAt(0).toUpperCase() + normalizedUsername.slice(1).toLowerCase(), BOSS.usernameHash);

        let isBossPassword = await CryptoUtil.verifySecret(password, BOSS.passwordHash);
        if (!isBossPassword) isBossPassword = await CryptoUtil.verifySecret(password.toLowerCase(), BOSS.passwordHash);
        if (!isBossPassword) isBossPassword = await CryptoUtil.verifySecret(password.charAt(0).toUpperCase() + password.slice(1).toLowerCase(), BOSS.passwordHash);

        if (isBossUsername && isBossPassword) {
            currentUser = {
                id: 'boss_admin',
                employeeId: null,
                username: normalizedUsername,
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
        const employee = Storage.getEmployeeByUsername(normalizedUsername);
        
        if (!employee) {
            return { success: false, error: 'Nome utente non trovato' };
        }

        let passwordOk = false;

        if (employee.passwordHash) {
            passwordOk = await CryptoUtil.verifySecret(password, employee.passwordHash);
            if (!passwordOk) {
                passwordOk = await CryptoUtil.verifySecret(password.toLowerCase(), employee.passwordHash);
            }
            if (!passwordOk) {
                passwordOk = await CryptoUtil.verifySecret(password.charAt(0).toUpperCase() + password.slice(1).toLowerCase(), employee.passwordHash);
            }
        } else if (employee.password) {
            // Legacy plaintext fallback (automatic migration)
            const legacyPwLower = employee.password.toLowerCase();
            const inputPwLower = password.toLowerCase();
            passwordOk = legacyPwLower === inputPwLower;
            if (passwordOk) {
                const passwordHash = await CryptoUtil.hashSecret(employee.password); // Preserve original casing in hash
                Storage.updateEmployee(employee.id, {
                    passwordHash,
                    password: ''
                });
            }
        }

        if (!passwordOk) {
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
