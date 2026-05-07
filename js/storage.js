/* ========================================
   PWSWORK - STORAGE MODULE
   Firestore + In-Memory Cache
   Real-time sync across all devices
   ======================================== */

const Storage = (() => {
    // ==================== IN-MEMORY CACHE ====================
    let _employees = [];
    let _assignments = [];
    let _availabilities = [];
    let _dataReady = false;
    let _readyCallbacks = [];

    // Firestore collections
    const COLLECTIONS = {
        EMPLOYEES: 'employees',
        ASSIGNMENTS: 'assignments',
        AVAILABILITIES: 'availabilities'
    };

    // Local-only keys (stay in localStorage — per-browser)
    const LOCAL_KEYS = {
        CURRENT_USER: 'pws_current_user',
        THEME: 'pws_theme',
        SIDEBAR_COLLAPSED: 'pws_sidebar_collapsed'
    };

    function _normalizeAttachment(att) {
        if (!att) return null;
        return {
            id: att.id || ('att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
            name: att.name || 'Allegato',
            type: att.type || 'application/octet-stream',
            kind: att.kind || (String(att.type || '').includes('pdf') ? 'pdf' : 'image'),
            storagePath: att.path || att.storagePath || '',
            url: att.url || att.downloadURL || '',
            downloadURL: att.url || att.downloadURL || '',
            uploadedAt: att.uploadedAt || new Date().toISOString(),
            uploadedBy: att.uploadedBy || ''
        };
    }

    function _normalizeWorkplace(workplace) {
        const wp = workplace || {};
        return {
            name: wp.name || '',
            address: wp.address || '',
            lat: wp.lat ?? null,
            lng: wp.lng ?? null,
            info: wp.info || '',
            timeStart: wp.timeStart || null,
            timeEnd: wp.timeEnd || null,
            attachments: Array.isArray(wp.attachments)
                ? wp.attachments.map(_normalizeAttachment).filter(Boolean)
                : []
        };
    }

    function _normalizeAssignment(assignment) {
        const asgn = assignment || {};
        return {
            ...asgn,
            workplaces: Array.isArray(asgn.workplaces) ? asgn.workplaces.map(_normalizeWorkplace) : []
        };
    }

    function _collectAssignmentAttachmentPaths(assignments, excludeId = null) {
        const paths = new Set();
        (assignments || []).forEach(asgn => {
            if (!asgn || (excludeId && asgn.id === excludeId)) return;
            (asgn.workplaces || []).forEach(wp => {
                (wp.attachments || []).forEach(att => {
                    if (att?.storagePath) paths.add(att.storagePath);
                });
            });
        });
        return paths;
    }

    async function _deleteUnusedAttachmentsFromAssignment(assignment, excludeId = null) {
        if (!assignment || typeof storage === 'undefined') return;
        const usedElsewhere = _collectAssignmentAttachmentPaths(_assignments, excludeId);
        const deletions = [];
        (assignment.workplaces || []).forEach(wp => {
            (wp.attachments || []).forEach(att => {
                if (att?.storagePath && !usedElsewhere.has(att.storagePath)) {
                    deletions.push(
                        storage.ref(att.storagePath).delete().catch(err => {
                            console.error('Error deleting attachment:', att.storagePath, err);
                        })
                    );
                }
            });
        });
        await Promise.all(deletions);
    }

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

    // ==================== INIT ====================
    function init() {
        _startListeners();
    }

    // Wait for Firestore data to be loaded at least once
    function onReady(callback) {
        if (_dataReady) {
            callback();
        } else {
            _readyCallbacks.push(callback);
        }
    }

    function _markReady() {
        if (!_dataReady) {
            _dataReady = true;
            console.log('✅ Firestore data ready — employees:', _employees.length, 'assignments:', _assignments.length);
            _readyCallbacks.forEach(cb => {
                try { cb(); } catch (e) { console.error('Ready callback error:', e); }
            });
            _readyCallbacks = [];
        }
    }

    // ==================== REAL-TIME LISTENERS ====================
    let _listenersStarted = false;
    let _loadedSources = { employees: false, assignments: false, availabilities: false };
    let _firstLoad = true;

    function _checkAllLoaded() {
        if (_loadedSources.employees && _loadedSources.assignments && _loadedSources.availabilities) {
            _markReady();
        }
    }

    function _startListeners() {
        if (_listenersStarted) return;
        _listenersStarted = true;

        // --- Employees listener ---
        db.collection(COLLECTIONS.EMPLOYEES).onSnapshot((snapshot) => {
            _employees = [];
            snapshot.forEach((doc) => {
                _employees.push({ ...doc.data(), id: doc.id });
            });
            const wasLoaded = _loadedSources.employees;
            _loadedSources.employees = true;
            _checkAllLoaded();
            // Check if current user's role changed and update session
            if (wasLoaded && typeof Auth !== 'undefined' && Auth.getCurrentUser) {
                const currentUser = Auth.getCurrentUser();
                if (currentUser && currentUser.employeeId) {
                    const updatedEmp = _employees.find(e => e.id === currentUser.employeeId);
                    if (updatedEmp && updatedEmp.role !== currentUser.role) {
                        console.log('[Storage] Role changed for current user:', currentUser.role, '->', updatedEmp.role);
                        Auth.updateCurrentUser({ role: updatedEmp.role });
                        if (typeof App !== 'undefined' && App.updateAdminVisibility) {
                            App.updateAdminVisibility();
                        }
                    }
                }
            }
            if (wasLoaded) _onDataChange();
        }, (error) => {
            console.error('Firestore employees listener error:', error);
            _loadedSources.employees = true;
            _checkAllLoaded();
        });

        // --- Assignments listener ---
        db.collection(COLLECTIONS.ASSIGNMENTS).onSnapshot((snapshot) => {
            _assignments = [];
            snapshot.forEach((doc) => {
                _assignments.push(_normalizeAssignment({ ...doc.data(), id: doc.id }));
            });
            const wasLoaded = _loadedSources.assignments;
            _loadedSources.assignments = true;
            _checkAllLoaded();
            if (wasLoaded) _onDataChange();
        }, (error) => {
            console.error('Firestore assignments listener error:', error);
            _loadedSources.assignments = true;
            _checkAllLoaded();
        });

        // --- Availabilities listener ---
        db.collection(COLLECTIONS.AVAILABILITIES).onSnapshot((snapshot) => {
            _availabilities = [];
            snapshot.forEach((doc) => {
                _availabilities.push({ ...doc.data(), id: doc.id });
            });
            const wasLoaded = _loadedSources.availabilities;
            _loadedSources.availabilities = true;
            _checkAllLoaded();
            if (wasLoaded) _onDataChange();
        }, (error) => {
            console.error('Firestore availabilities listener error:', error);
            _loadedSources.availabilities = true;
            _checkAllLoaded();
        });

    }

    // Called when Firestore data changes from another device — refresh visible page
    let _refreshTimer = null;
    function _onDataChange() {
        if (!_dataReady) return;
        clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(() => {
            if (typeof App !== 'undefined' && App.refreshCurrentPage) {
                App.refreshCurrentPage();
            }
        }, 300);
    }

    // ==================== EMPLOYEES (sync read from cache, async write to Firestore) ====================
    function getEmployees() {
        return [..._employees];
    }

    function getEmployee(id) {
        return _employees.find(e => e.id === id) || null;
    }

    function getEmployeeByUsername(username) {
        if (!username) return null;
        const lowerUsername = String(username).toLowerCase();
        return _employees.find(e => (e.username || '').toLowerCase() === lowerUsername) || null;
    }

    function addEmployee(employee) {
        const id = 'emp_' + Date.now();
        employee.id = id;
        employee.createdAt = toLocalDateStr();

        // Optimistic: add to cache immediately
        _employees.push({ ...employee });

        // Write to Firestore
        db.collection(COLLECTIONS.EMPLOYEES).doc(id).set(employee).catch(err => {
            console.error('Error adding employee:', err);
        });

        return employee;
    }

    function updateEmployee(id, data) {
        const index = _employees.findIndex(e => e.id === id);
        if (index !== -1) {
            _employees[index] = { ..._employees[index], ...data };

            db.collection(COLLECTIONS.EMPLOYEES).doc(id).update(data).catch(err => {
                console.error('Error updating employee:', err);
            });

            return _employees[index];
        }
        return null;
    }

    function deleteEmployee(id) {
        _employees = _employees.filter(e => e.id !== id);

        db.collection(COLLECTIONS.EMPLOYEES).doc(id).delete().catch(err => {
            console.error('Error deleting employee:', err);
        });

        // Remove from assignments (cache + Firestore)
        _assignments.forEach(a => {
            if (a.employeeIds && a.employeeIds.includes(id)) {
                a.employeeIds = a.employeeIds.filter(eid => eid !== id);
                if (a.employeeIds.length > 0) {
                    db.collection(COLLECTIONS.ASSIGNMENTS).doc(a.id).update({
                        employeeIds: a.employeeIds
                    }).catch(err => console.error('Error updating assignment:', err));
                } else {
                    db.collection(COLLECTIONS.ASSIGNMENTS).doc(a.id).delete().catch(err =>
                        console.error('Error deleting empty assignment:', err));
                }
            }
        });
        _assignments = _assignments.filter(a => a.employeeIds && a.employeeIds.length > 0);
    }

    // ==================== ASSIGNMENTS ====================
    function getAssignments() {
        return [..._assignments];
    }

    function getAssignment(id) {
        return _assignments.find(a => a.id === id) || null;
    }

    function getAssignmentsByDate(date) {
        return _assignments.filter(a => a.date === date);
    }

    function getAssignmentsByEmployee(employeeId) {
        return _assignments.filter(a => a.employeeIds && a.employeeIds.includes(employeeId));
    }

    function getAssignmentsByDateRange(startDate, endDate) {
        return _assignments.filter(a => a.date >= startDate && a.date <= endDate);
    }

    function addAssignment(assignment) {
        const id = 'asgn_' + Date.now();
        assignment.id = id;
        assignment.createdAt = new Date().toISOString();
        assignment = _normalizeAssignment(assignment);

        _assignments.push({ ...assignment });

        db.collection(COLLECTIONS.ASSIGNMENTS).doc(id).set(assignment).catch(err => {
            console.error('Error adding assignment:', err);
        });

        return assignment;
    }

    /* Accepts a pre-built assignment object (id + createdAt already set).
       Used by AI-import to avoid Date.now() collisions in synchronous loops. */
    function _pushAssignment(assignment) {
        assignment = _normalizeAssignment(assignment);
        _assignments.push({ ...assignment });
        db.collection(COLLECTIONS.ASSIGNMENTS).doc(assignment.id).set(assignment).catch(err => {
            console.error('Error adding assignment:', err);
        });
        return assignment;
    }

    function addAssignmentsForDates(template, dates) {
        const uniqueDates = [...new Set((dates || []).filter(Boolean))].sort();
        if (uniqueDates.length === 0) return [];

        const created = [];
        uniqueDates.forEach((dateStr, idx) => {
            const assignment = _normalizeAssignment({
                ...template,
                id: 'asgn_' + Date.now() + '_' + idx,
                date: dateStr,
                createdAt: new Date().toISOString()
            });
            _pushAssignment(assignment);
            created.push(assignment);
        });

        return created;
    }

    function updateAssignment(id, data) {
        const index = _assignments.findIndex(a => a.id === id);
        if (index !== -1) {
            _assignments[index] = _normalizeAssignment({ ..._assignments[index], ...data });

            db.collection(COLLECTIONS.ASSIGNMENTS).doc(id).update(data).catch(err => {
                console.error('Error updating assignment:', err);
            });

            return _assignments[index];
        }
        return null;
    }

    async function deleteAssignment(id) {
        const assignment = _assignments.find(a => a.id === id);
        _assignments = _assignments.filter(a => a.id !== id);

        if (assignment) {
            await _deleteUnusedAttachmentsFromAssignment(assignment, id);
        }

        db.collection(COLLECTIONS.ASSIGNMENTS).doc(id).delete().catch(err => {
            console.error('Error deleting assignment:', err);
        });
    }

    // ==================== AVAILABILITIES ====================
    function getAvailabilities() {
        return [..._availabilities];
    }

    function addAvailability(availability) {
        const id = 'avail_' + Date.now();
        availability.id = id;
        availability.createdAt = new Date().toISOString();
        if (!availability.responses) availability.responses = {};

        _availabilities.push({ ...availability });

        db.collection(COLLECTIONS.AVAILABILITIES).doc(id).set(availability).catch(err => {
            console.error('Error adding availability:', err);
        });

        return availability;
    }

    function updateAvailability(id, data) {
        const index = _availabilities.findIndex(a => a.id === id);
        if (index !== -1) {
            _availabilities[index] = { ..._availabilities[index], ...data };

            db.collection(COLLECTIONS.AVAILABILITIES).doc(id).update(data).catch(err => {
                console.error('Error updating availability:', err);
            });

            return _availabilities[index];
        }
        return null;
    }

    function deleteAvailability(id) {
        _availabilities = _availabilities.filter(a => a.id !== id);
        db.collection(COLLECTIONS.AVAILABILITIES).doc(id).delete().catch(err => {
            console.error('Error deleting availability:', err);
        });
    }

    // ==================== CURRENT USER (local only) ====================
    function getCurrentUser() {
        try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.CURRENT_USER)); }
        catch { return null; }
    }

    function setCurrentUser(user) {
        localStorage.setItem(LOCAL_KEYS.CURRENT_USER, JSON.stringify(user));
    }

    function clearCurrentUser() {
        localStorage.removeItem(LOCAL_KEYS.CURRENT_USER);
    }

    // ==================== THEME (local only) ====================
    function getTheme() { return localStorage.getItem(LOCAL_KEYS.THEME) || 'dark'; }
    function setTheme(theme) { localStorage.setItem(LOCAL_KEYS.THEME, theme); }

    // ==================== SIDEBAR (local only) ====================
    function getSidebarCollapsed() { return localStorage.getItem(LOCAL_KEYS.SIDEBAR_COLLAPSED) === 'true'; }
    function setSidebarCollapsed(collapsed) { localStorage.setItem(LOCAL_KEYS.SIDEBAR_COLLAPSED, String(collapsed)); }

    // ==================== RESET ====================
    async function resetAll() {
        const attachmentPaths = Array.from(_collectAssignmentAttachmentPaths(_assignments));
        // Delete all Firestore docs in a batch
        const batch = db.batch();

        _employees.forEach(e => {
            batch.delete(db.collection(COLLECTIONS.EMPLOYEES).doc(e.id));
        });
        _assignments.forEach(a => {
            batch.delete(db.collection(COLLECTIONS.ASSIGNMENTS).doc(a.id));
        });
        _availabilities.forEach(a => {
            batch.delete(db.collection(COLLECTIONS.AVAILABILITIES).doc(a.id));
        });

        batch.commit().then(() => {
            console.log('✅ All Firestore data reset');
        }).catch(err => {
            console.error('Error resetting Firestore data:', err);
        });

        await Promise.all(attachmentPaths.map(path =>
            storage.ref(path).delete().catch(err => {
                console.error('Error deleting attachment during reset:', path, err);
            })
        ));

        // Clear caches
        _employees = [];
        _assignments = [];
        _availabilities = [];

        // Clear local storage
        Object.values(LOCAL_KEYS).forEach(key => localStorage.removeItem(key));

        // Also reset absences module
        if (typeof Absences !== 'undefined' && Absences.resetAll) {
            Absences.resetAll();
        }
    }

    return {
        init, onReady,
        toLocalDateStr, formatDateIT, formatDateLong,
        getItalianHolidays, isHoliday,
        getEmployees, getEmployee, getEmployeeByUsername,
        addEmployee, updateEmployee, deleteEmployee,
        getAssignments, getAssignment, getAssignmentsByDate,
        getAssignmentsByEmployee, getAssignmentsByDateRange,
        addAssignment, addAssignmentsForDates, _pushAssignment, updateAssignment, deleteAssignment,
        getAvailabilities, addAvailability, updateAvailability, deleteAvailability,
        getCurrentUser, setCurrentUser, clearCurrentUser,
        getTheme, setTheme,
        getSidebarCollapsed, setSidebarCollapsed,
        resetAll
    };
})();
