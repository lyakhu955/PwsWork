/* ========================================
   PWSWORK - STORAGE MODULE
   LocalStorage Data Management
   ======================================== */

const Storage = (() => {
    const KEYS = {
        ADMIN_CODE: 'pws_admin_code',
        USERS: 'pws_users',
        EMPLOYEES: 'pws_employees',
        ASSIGNMENTS: 'pws_assignments',
        CURRENT_USER: 'pws_current_user',
        THEME: 'pws_theme',
        SIDEBAR_COLLAPSED: 'pws_sidebar_collapsed'
    };

    // ==================== DATE HELPERS (Formato Italiano) ====================
    function toLocalDateStr(date) {
        const d = date || new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatDateIT(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function formatDateLong(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    // ==================== ITALIAN HOLIDAYS ====================
    // Calcolo Pasqua con algoritmo di Gauss/Meeus
    function getEasterDate(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function getItalianHolidays(year) {
        const easter = getEasterDate(year);
        const easterMonday = new Date(easter);
        easterMonday.setDate(easter.getDate() + 1);

        const holidays = [
            { date: `${year}-01-01`, name: 'Capodanno' },
            { date: `${year}-01-06`, name: 'Epifania' },
            { date: toLocalDateStr(easter), name: 'Pasqua' },
            { date: toLocalDateStr(easterMonday), name: 'Lunedì dell\'Angelo' },
            { date: `${year}-04-25`, name: 'Festa della Liberazione' },
            { date: `${year}-05-01`, name: 'Festa dei Lavoratori' },
            { date: `${year}-06-02`, name: 'Festa della Repubblica' },
            { date: `${year}-08-15`, name: 'Ferragosto' },
            { date: `${year}-11-01`, name: 'Tutti i Santi' },
            { date: `${year}-12-08`, name: 'Immacolata Concezione' },
            { date: `${year}-12-25`, name: 'Natale' },
            { date: `${year}-12-26`, name: 'Santo Stefano' }
        ];
        return holidays;
    }

    function isHoliday(dateStr) {
        if (!dateStr) return null;
        const year = parseInt(dateStr.split('-')[0]);
        const holidays = getItalianHolidays(year);
        return holidays.find(h => h.date === dateStr) || null;
    }

    // ==================== DEFAULT DATA ==
    const DEFAULT_ADMIN_CODE = 'admin123';

    const DEFAULT_EMPLOYEES = [];

    /*
     * ASSIGNMENT structure:
     * {
     *   id: 'asgn_...',
     *   date: 'YYYY-MM-DD',
     *   teamName: 'Squadra 1',
     *   employeeIds: ['emp_1', 'emp_3'],
     *   workplaces: [
     *     {
     *       name: 'Iveco Orecchia',
     *       address: 'Via Roma 10, Bergamo',
     *       lat: 45.6983,
     *       lng: 9.6773,
     *       info: ''
     *     }
     *   ],
     *   notes: '',
     *   createdAt: '...'
     * }
     */

    // ==================== INIT ====================
    function init() {
        if (!localStorage.getItem(KEYS.ADMIN_CODE)) {
            localStorage.setItem(KEYS.ADMIN_CODE, DEFAULT_ADMIN_CODE);
        }
        if (!localStorage.getItem(KEYS.EMPLOYEES)) {
            localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(DEFAULT_EMPLOYEES));
        }
        if (!localStorage.getItem(KEYS.ASSIGNMENTS)) {
            localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify([]));
        }
    }

    // ==================== GENERIC GETTERS/SETTERS ====================
    function get(key) {
        const data = localStorage.getItem(key);
        try { return JSON.parse(data); } catch { return data; }
    }

    function set(key, value) {
        if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            localStorage.setItem(key, value);
        }
    }

    // ==================== ADMIN CODE ====================
    function getAdminCode() { return localStorage.getItem(KEYS.ADMIN_CODE) || DEFAULT_ADMIN_CODE; }
    function setAdminCode(code) { localStorage.setItem(KEYS.ADMIN_CODE, code); }

    // ==================== EMPLOYEES ====================
    function getEmployees() { return get(KEYS.EMPLOYEES) || []; }

    function getEmployee(id) {
        return getEmployees().find(e => e.id === id);
    }

    function getEmployeeByUsername(username) {
        return getEmployees().find(e => e.username === username);
    }

    function addEmployee(employee) {
        const employees = getEmployees();
        employee.id = 'emp_' + Date.now();
        employee.createdAt = toLocalDateStr();
        employees.push(employee);
        set(KEYS.EMPLOYEES, employees);
        return employee;
    }

    function updateEmployee(id, data) {
        const employees = getEmployees();
        const index = employees.findIndex(e => e.id === id);
        if (index !== -1) {
            employees[index] = { ...employees[index], ...data };
            set(KEYS.EMPLOYEES, employees);
            return employees[index];
        }
        return null;
    }

    function deleteEmployee(id) {
        let employees = getEmployees();
        employees = employees.filter(e => e.id !== id);
        set(KEYS.EMPLOYEES, employees);

        // Remove from assignments
        let assignments = getAssignments();
        assignments.forEach(a => {
            a.employeeIds = a.employeeIds.filter(eid => eid !== id);
        });
        // Remove assignments with no employees left
        assignments = assignments.filter(a => a.employeeIds.length > 0);
        set(KEYS.ASSIGNMENTS, assignments);
    }

    // ==================== ASSIGNMENTS ====================
    function getAssignments() { return get(KEYS.ASSIGNMENTS) || []; }

    function getAssignment(id) {
        return getAssignments().find(a => a.id === id);
    }

    function getAssignmentsByDate(date) {
        return getAssignments().filter(a => a.date === date);
    }

    function getAssignmentsByEmployee(employeeId) {
        return getAssignments().filter(a => a.employeeIds.includes(employeeId));
    }

    function getAssignmentsByDateRange(startDate, endDate) {
        return getAssignments().filter(a => a.date >= startDate && a.date <= endDate);
    }

    function addAssignment(assignment) {
        const assignments = getAssignments();
        assignment.id = 'asgn_' + Date.now();
        assignment.createdAt = new Date().toISOString();
        assignments.push(assignment);
        set(KEYS.ASSIGNMENTS, assignments);
        return assignment;
    }

    function updateAssignment(id, data) {
        const assignments = getAssignments();
        const index = assignments.findIndex(a => a.id === id);
        if (index !== -1) {
            assignments[index] = { ...assignments[index], ...data };
            set(KEYS.ASSIGNMENTS, assignments);
            return assignments[index];
        }
        return null;
    }

    function deleteAssignment(id) {
        let assignments = getAssignments();
        assignments = assignments.filter(a => a.id !== id);
        set(KEYS.ASSIGNMENTS, assignments);
    }

    // ==================== CURRENT USER ====================
    function getCurrentUser() { return get(KEYS.CURRENT_USER); }
    function setCurrentUser(user) { set(KEYS.CURRENT_USER, user); }
    function clearCurrentUser() { localStorage.removeItem(KEYS.CURRENT_USER); }

    // ==================== THEME ====================
    function getTheme() { return localStorage.getItem(KEYS.THEME) || 'dark'; }
    function setTheme(theme) { localStorage.setItem(KEYS.THEME, theme); }

    // ==================== SIDEBAR ====================
    function getSidebarCollapsed() { return localStorage.getItem(KEYS.SIDEBAR_COLLAPSED) === 'true'; }
    function setSidebarCollapsed(collapsed) { localStorage.setItem(KEYS.SIDEBAR_COLLAPSED, String(collapsed)); }

    // ==================== RESET ====================
    function resetAll() {
        Object.values(KEYS).forEach(key => localStorage.removeItem(key));
        // Also clear absences module data
        localStorage.removeItem('pws_absences');
        localStorage.removeItem('pws_leave_requests');
        localStorage.removeItem('pws_notifications');
        init();
    }

    return {
        init, KEYS,
        toLocalDateStr, formatDateIT, formatDateLong,
        getItalianHolidays, isHoliday,
        getAdminCode, setAdminCode,
        getEmployees, getEmployee, getEmployeeByUsername,
        addEmployee, updateEmployee, deleteEmployee,
        getAssignments, getAssignment, getAssignmentsByDate,
        getAssignmentsByEmployee, getAssignmentsByDateRange,
        addAssignment, updateAssignment, deleteAssignment,
        getCurrentUser, setCurrentUser, clearCurrentUser,
        getTheme, setTheme,
        getSidebarCollapsed, setSidebarCollapsed,
        resetAll
    };
})();
