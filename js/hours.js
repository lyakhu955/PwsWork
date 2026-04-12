/* ========================================
   PWSWORK - HOURS MODULE
   Ore Dipendenti — Upload/Download/Delete Excel files
   Files stored in Firebase Storage, metadata in Firestore
   Duplicate detection: same user + same month/year = overwrite
   ======================================== */

const Hours = (() => {
    const COLLECTION = 'hoursFiles';
    let _files = [];
    let _listenerStarted = false;

    const MONTH_NAMES = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    // ==================== EXTRACT MONTH/YEAR FROM FILENAME ====================
    function _extractMonthYear(fileName) {
        if (!fileName) return null;
        const name = fileName.toLowerCase().replace(/[_\-\.]/g, ' ');
        let month = null, year = null;

        for (let i = 0; i < MONTH_NAMES.length; i++) {
            if (name.includes(MONTH_NAMES[i].toLowerCase())) {
                month = i;
                break;
            }
        }
        const yearMatch = fileName.match(/(\d{4})/);
        if (yearMatch) year = parseInt(yearMatch[1]);

        if (month !== null && year !== null) {
            return { month, year, label: `${MONTH_NAMES[month]} ${year}` };
        }
        return null;
    }

    // ==================== INIT LISTENER ====================
    function _startListener() {
        if (_listenerStarted) return;
        _listenerStarted = true;

        console.log('[Hours] Starting Firestore listener on collection:', COLLECTION);

        db.collection(COLLECTION).onSnapshot((snapshot) => {
            _files = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                _files.push({ ...data, id: doc.id, _monthYear: _extractMonthYear(data.fileName) });
            });

            _files.sort((a, b) => {
                const tA = a.uploadedAt ? a.uploadedAt.seconds : (a.uploadedAtLocal ? new Date(a.uploadedAtLocal).getTime() / 1000 : 0);
                const tB = b.uploadedAt ? b.uploadedAt.seconds : (b.uploadedAtLocal ? new Date(b.uploadedAtLocal).getTime() / 1000 : 0);
                return tB - tA;
            });

            console.log('[Hours] Received', _files.length, 'files from Firestore');

            const page = document.getElementById('page-hours');
            if (page && page.classList.contains('active')) {
                render();
            }
        }, (error) => {
            console.error('[Hours] Listener error:', error);
        });
    }

    // ==================== FIND DUPLICATE ====================
    function _findDuplicate(uploaderKey, monthYear) {
        if (!monthYear) return null;
        return _files.find(f => {
            if (!f._monthYear) return false;
            return f.uploadedBy === uploaderKey &&
                   f._monthYear.month === monthYear.month &&
                   f._monthYear.year === monthYear.year;
        });
    }

    // ==================== UPLOAD (with overwrite) ====================
    async function uploadFile(file) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `hours/${user.id || user.username}_${timestamp}_${safeName}`;
        const monthYear = _extractMonthYear(file.name);

        try {
            App.showToast('Upload', 'Caricamento in corso...', 'info');

            const duplicate = _findDuplicate(user.username, monthYear);

            const ref = storage.ref(storagePath);
            await ref.put(file);
            const downloadURL = await ref.getDownloadURL();

            const metadata = {
                fileName: file.name,
                storagePath: storagePath,
                downloadURL: downloadURL,
                fileSize: file.size,
                uploadedBy: user.username,
                uploadedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
                employeeId: user.employeeId || user.id,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                uploadedAtLocal: new Date().toISOString()
            };

            if (duplicate) {
                try { await storage.ref(duplicate.storagePath).delete(); } catch (e) { /* ignore */ }
                await db.collection(COLLECTION).doc(duplicate.id).set(metadata);
                App.showToast('Aggiornato', `File di ${monthYear ? monthYear.label : 'questo mese'} aggiornato!`, 'success');
            } else {
                await db.collection(COLLECTION).add(metadata);
                App.showToast('Successo', 'File caricato con successo!', 'success');
            }
        } catch (error) {
            console.error('Upload error:', error);
            App.showToast('Errore', 'Errore durante il caricamento: ' + error.message, 'error');
        }
    }

    // ==================== DELETE ====================
    async function deleteFile(fileId) {
        const fileData = _files.find(f => f.id === fileId);
        if (!fileData) return;

        try {
            try { await storage.ref(fileData.storagePath).delete(); } catch (e) { /* ignore */ }
            await db.collection(COLLECTION).doc(fileId).delete();
            App.showToast('Eliminato', 'File eliminato con successo', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            App.showToast('Errore', 'Errore durante l\'eliminazione: ' + error.message, 'error');
        }
    }

    // ==================== RENDER ====================
    function render() {
        _startListener();

        const container = document.getElementById('hours-content');
        if (!container) return;

        const user = Auth.getCurrentUser();
        const isAdmin = Auth.isAdmin();

        const visibleFiles = isAdmin
            ? _files
            : _files.filter(f => f.employeeId === user.employeeId || f.uploadedBy === user.username);

        // Bind upload input
        const fileInput = document.getElementById('hours-file-input');
        if (fileInput && !fileInput.dataset.bound) {
            fileInput.dataset.bound = 'true';
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) { uploadFile(file); fileInput.value = ''; }
            });
        }

        if (visibleFiles.length === 0) {
            container.innerHTML = `
                <div class="hours-empty glass-card">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <h4>Nessun file presente</h4>
                    <p>Carica un file Excel delle ore lavorative oppure generalo dal sito Ore PWS.</p>
                </div>`;
            return;
        }

        // Group: employee → month/year
        const grouped = {};
        visibleFiles.forEach(f => {
            const empKey = f.uploadedByName || f.uploadedBy || 'Sconosciuto';
            if (!grouped[empKey]) grouped[empKey] = {};
            const monthLabel = f._monthYear ? f._monthYear.label : 'Altro';
            if (!grouped[empKey][monthLabel]) grouped[empKey][monthLabel] = [];
            grouped[empKey][monthLabel].push(f);
        });

        let html = '';

        Object.keys(grouped).sort().forEach(empName => {
            const months = grouped[empName];
            const totalFiles = Object.values(months).reduce((s, a) => s + a.length, 0);

            html += `<div class="hours-employee-card glass-card">`;
            html += `
                <div class="hours-emp-header">
                    <div class="hours-emp-avatar">${_getInitials(empName)}</div>
                    <div class="hours-emp-info">
                        <div class="hours-emp-name">${empName}</div>
                        <div class="hours-emp-stats">${totalFiles} file · ${Object.keys(months).length} mesi</div>
                    </div>
                </div>`;

            const sortedMonths = Object.keys(months).sort((a, b) => {
                const mA = _parseMonthLabel(a), mB = _parseMonthLabel(b);
                if (!mA && !mB) return 0;
                if (!mA) return 1;
                if (!mB) return -1;
                return mB.year !== mA.year ? mB.year - mA.year : mB.month - mA.month;
            });

            html += `<div class="hours-months-grid">`;
            sortedMonths.forEach(monthLabel => {
                const files = months[monthLabel];
                const isOther = monthLabel === 'Altro';
                const monthData = _parseMonthLabel(monthLabel);
                const monthColor = monthData ? _getMonthColor(monthData.month) : '#6366f1';

                files.forEach(f => {
                    const uploadDate = _getFileDate(f);
                    const size = _formatFileSize(f.fileSize);
                    const source = f.source === 'ore-pws-auto' ? 'Ore PWS' : 'Manuale';

                    html += `
                        <div class="hours-month-card" style="--month-accent: ${monthColor}">
                            <div class="hours-month-badge" style="background: ${monthColor}15; color: ${monthColor}">
                                <span class="hours-month-icon">${isOther ? '📄' : _getMonthIcon(monthData.month)}</span>
                                <span>${monthLabel}</span>
                            </div>
                            <div class="hours-month-file">
                                <div class="hours-month-filename" title="${f.fileName}">${f.fileName}</div>
                                <div class="hours-month-details">
                                    <span>${uploadDate}</span>
                                    <span class="hours-dot">·</span>
                                    <span>${size}</span>
                                    <span class="hours-dot">·</span>
                                    <span class="hours-source-tag hours-source-${f.source === 'ore-pws-auto' ? 'auto' : 'manual'}">${source}</span>
                                </div>
                            </div>
                            <div class="hours-month-actions">
                                <a href="${f.downloadURL}" target="_blank" class="hours-btn hours-btn-download" title="Scarica">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </a>
                                ${isAdmin ? `
                                <button class="hours-btn hours-btn-delete" onclick="Hours.confirmDelete('${f.id}')" title="Elimina">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>` : ''}
                            </div>
                        </div>`;
                });
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;
    }

    // ==================== CONFIRM DELETE ====================
    function confirmDelete(fileId) {
        const fileData = _files.find(f => f.id === fileId);
        if (!fileData) return;
        App.showConfirm('Elimina file', `Sei sicuro di voler eliminare "${fileData.fileName}"?`, () => {
            deleteFile(fileId);
        });
    }

    // ==================== HELPERS ====================
    function _getInitials(name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    function _formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function _getFileDate(f) {
        const ts = f.uploadedAt ? new Date(f.uploadedAt.seconds * 1000)
                 : f.uploadedAtLocal ? new Date(f.uploadedAtLocal) : null;
        if (!ts) return '';
        return ts.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function _parseMonthLabel(label) {
        if (label === 'Altro') return null;
        for (let i = 0; i < MONTH_NAMES.length; i++) {
            if (label.startsWith(MONTH_NAMES[i])) {
                return { month: i, year: parseInt(label.split(' ')[1]) || 0 };
            }
        }
        return null;
    }

    function _getMonthColor(m) {
        return ['#3b82f6','#6366f1','#10b981','#f59e0b','#ef4444','#ec4899',
                '#f97316','#eab308','#14b8a6','#8b5cf6','#64748b','#06b6d4'][m] || '#6366f1';
    }

    function _getMonthIcon(m) {
        return ['❄️','💜','🌱','🌸','☀️','🌹','🔥','⛱️','🍂','🎃','🍁','🎄'][m] || '📅';
    }

    return { render, uploadFile, deleteFile, confirmDelete };
})();
