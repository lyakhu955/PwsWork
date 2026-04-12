/* ========================================
   PWSWORK - HOURS MODULE
   Ore Dipendenti — Upload/Download/Delete Excel files
   Files stored in Firebase Storage, metadata in Firestore
   ======================================== */

const Hours = (() => {
    const COLLECTION = 'hoursFiles';
    let _files = [];
    let _listenerStarted = false;

    // ==================== INIT LISTENER ====================
    function _startListener() {
        if (_listenerStarted) return;
        _listenerStarted = true;

        db.collection(COLLECTION).orderBy('uploadedAt', 'desc').onSnapshot((snapshot) => {
            _files = [];
            snapshot.forEach((doc) => {
                _files.push({ ...doc.data(), id: doc.id });
            });
            // Re-render if the page is visible
            const page = document.getElementById('page-hours');
            if (page && page.classList.contains('active')) {
                render();
            }
        }, (error) => {
            console.error('Hours listener error:', error);
        });
    }

    // ==================== UPLOAD ====================
    async function uploadFile(file) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const isAdmin = Auth.isAdmin();
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `hours/${user.id || user.username}_${timestamp}_${safeName}`;

        try {
            App.showToast('Upload', 'Caricamento in corso...', 'info');

            // Upload to Firebase Storage
            const ref = storage.ref(storagePath);
            await ref.put(file);
            const downloadURL = await ref.getDownloadURL();

            // Save metadata to Firestore
            await db.collection(COLLECTION).add({
                fileName: file.name,
                storagePath: storagePath,
                downloadURL: downloadURL,
                fileSize: file.size,
                uploadedBy: user.username,
                uploadedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
                employeeId: user.employeeId || user.id,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                uploadedAtLocal: new Date().toISOString()
            });

            App.showToast('Successo', 'File caricato con successo!', 'success');
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
            // Delete from Storage
            const ref = storage.ref(fileData.storagePath);
            await ref.delete();

            // Delete metadata from Firestore
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

        // Filter: admin sees all, employee sees own
        const visibleFiles = isAdmin
            ? _files
            : _files.filter(f => f.employeeId === user.employeeId || f.uploadedBy === user.username);

        // Bind upload input
        const fileInput = document.getElementById('hours-file-input');
        if (fileInput && !fileInput.dataset.bound) {
            fileInput.dataset.bound = 'true';
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    uploadFile(file);
                    fileInput.value = '';
                }
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

        // Group files by employee
        const grouped = {};
        visibleFiles.forEach(f => {
            const key = f.uploadedByName || f.uploadedBy || 'Sconosciuto';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(f);
        });

        let html = '';

        Object.keys(grouped).sort().forEach(name => {
            const files = grouped[name];
            html += `<div class="hours-group glass-card">`;
            html += `<div class="hours-group-header">
                        <div class="hours-group-avatar">${_getInitials(name)}</div>
                        <div>
                            <div class="hours-group-name">${name}</div>
                            <div class="hours-group-count">${files.length} file</div>
                        </div>
                     </div>`;
            html += `<div class="hours-file-list">`;

            files.forEach(f => {
                const date = f.uploadedAt
                    ? new Date(f.uploadedAt.seconds * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : (f.uploadedAtLocal ? new Date(f.uploadedAtLocal).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
                const size = _formatFileSize(f.fileSize);

                html += `
                    <div class="hours-file-item">
                        <div class="hours-file-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <div class="hours-file-info">
                            <div class="hours-file-name">${f.fileName}</div>
                            <div class="hours-file-meta">${date} · ${size}</div>
                        </div>
                        <div class="hours-file-actions">
                            <a href="${f.downloadURL}" target="_blank" class="icon-btn hours-action-btn" title="Scarica">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
                            ${isAdmin ? `
                            <button class="icon-btn hours-action-btn hours-delete-btn" onclick="Hours.confirmDelete('${f.id}')" title="Elimina">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>` : ''}
                        </div>
                    </div>`;
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

    return {
        render,
        uploadFile,
        deleteFile,
        confirmDelete
    };
})();
