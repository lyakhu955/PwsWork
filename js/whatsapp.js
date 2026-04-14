/* ========================================
   PWSWORK - WHATSAPP SHARE MODULE
   Condivisione programma lavorativo per WhatsApp
   Organizzato per gregge/gruppo con emoji
   ======================================== */

const WhatsApp = (() => {

    const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                         'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    // ==================== OPEN MODAL ====================
    function openModal(presetDate = null) {
        const modal = document.getElementById('whatsapp-modal');
        if (!modal) return;

        // Reset
        _resetModal();

        // Set default date range: today → +6 days
        const today = new Date();
        const todayStr = Storage.toLocalDateStr(today);
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 6);
        const endStr = Storage.toLocalDateStr(endDate);

        document.getElementById('wa-date-from').value = todayStr;
        document.getElementById('wa-date-to').value = endStr;

        // If presetDate given (from dashboard button), set single day
        if (presetDate) {
            document.getElementById('wa-date-from').value = presetDate;
            document.getElementById('wa-date-to').value = presetDate;
        }

        modal.classList.add('active');
        _generatePreview();
    }

    function closeModal() {
        const modal = document.getElementById('whatsapp-modal');
        if (modal) modal.classList.remove('active');
    }

    function _resetModal() {
        const preview = document.getElementById('wa-preview-text');
        if (preview) preview.textContent = '';
        const copyBtn = document.getElementById('wa-copy-btn');
        if (copyBtn) copyBtn.disabled = true;
        const waBtn = document.getElementById('wa-open-btn');
        if (waBtn) waBtn.disabled = true;
    }

    // ==================== GENERATE PREVIEW ====================
    function _generatePreview() {
        const fromVal = document.getElementById('wa-date-from').value;
        const toVal = document.getElementById('wa-date-to').value;

        if (!fromVal || !toVal) return;

        const from = new Date(fromVal + 'T00:00:00');
        const to = new Date(toVal + 'T00:00:00');

        if (from > to) {
            document.getElementById('wa-preview-text').textContent = '⚠️ La data di inizio deve essere prima della data di fine.';
            return;
        }

        // Collect all dates in range
        const dates = [];
        const cur = new Date(from);
        while (cur <= to) {
            dates.push(Storage.toLocalDateStr(cur));
            cur.setDate(cur.getDate() + 1);
        }

        const text = _buildMessage(dates);
        const preview = document.getElementById('wa-preview-text');
        if (preview) preview.textContent = text || 'Nessuna assegnazione nel periodo selezionato.';

        const hasContent = text.trim().length > 0;
        document.getElementById('wa-copy-btn').disabled = !hasContent;
        document.getElementById('wa-open-btn').disabled = !hasContent;
    }

    // ==================== BUILD MESSAGE ====================
    function _buildMessage(dates) {
        let lines = [];
        let hasAny = false;

        lines.push('🏗️ *PROGRAMMA LAVORATIVO PWS*');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');

        dates.forEach(dateStr => {
            const assignments = Storage.getAssignmentsByDate(dateStr);
            if (assignments.length === 0) return;

            hasAny = true;

            const dateObj = new Date(dateStr + 'T00:00:00');
            const dayName = DAY_NAMES[dateObj.getDay()];
            const day = dateObj.getDate();
            const month = MONTH_NAMES[dateObj.getMonth()];
            const year = dateObj.getFullYear();

            lines.push(`📅 *${dayName} ${day} ${month} ${year}*`);
            lines.push('─────────────────────');

            assignments.forEach((asgn, idx) => {
                const teamName = asgn.teamName || `Gregge ${idx + 1}`;

                // Get employee names
                const members = (asgn.employeeIds || []).map(eid => {
                    const emp = Storage.getEmployee(eid);
                    return emp ? `${emp.firstName} ${emp.lastName}` : null;
                }).filter(Boolean);

                lines.push(`👥 *${teamName}*`);

                if (members.length > 0) {
                    lines.push(`👷 ${members.join(', ')}`);
                }

                // Workplaces
                if (asgn.workplaces && asgn.workplaces.length > 0) {
                    asgn.workplaces.forEach(wp => {
                        const name = wp.name || '';
                        const address = wp.address || '';
                        if (name && address && name !== address) {
                            lines.push(`📍 ${name} — ${address}`);
                        } else if (name) {
                            lines.push(`📍 ${name}`);
                        } else if (address) {
                            lines.push(`📍 ${address}`);
                        }
                    });
                }

                // Notes
                if (asgn.notes && asgn.notes.trim()) {
                    lines.push(`📝 ${asgn.notes.trim()}`);
                }

                // Spacer between groups
                if (idx < assignments.length - 1) {
                    lines.push('');
                }
            });

            lines.push('');
        });

        if (!hasAny) return '';

        lines.push('━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('📲 _Inviato da PwsWork_');

        return lines.join('\n');
    }

    // ==================== FORMAT SINGLE DATE FOR DISPLAY ====================
    function _formatDateDisplay(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }

    // ==================== COPY TO CLIPBOARD ====================
    function copyText() {
        const preview = document.getElementById('wa-preview-text');
        if (!preview || !preview.textContent.trim()) return;

        const text = preview.textContent;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                _showCopiedFeedback();
            }).catch(() => {
                _fallbackCopy(text);
            });
        } else {
            _fallbackCopy(text);
        }
    }

    function _fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        _showCopiedFeedback();
    }

    function _showCopiedFeedback() {
        const btn = document.getElementById('wa-copy-btn');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '✅ Copiato!';
        btn.style.background = 'var(--success, #10b981)';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
        }, 2000);
        App.showToast('Copiato!', 'Testo copiato negli appunti. Vai su WhatsApp e incolla!', 'success');
    }

    // ==================== OPEN WHATSAPP ====================
    function openWhatsApp() {
        const preview = document.getElementById('wa-preview-text');
        if (!preview || !preview.textContent.trim()) return;

        const text = encodeURIComponent(preview.textContent);
        // Opens WhatsApp with prefilled text (user selects contact/group)
        const url = `https://wa.me/?text=${text}`;
        window.open(url, '_blank');
    }

    // ==================== QUICK OPEN FOR A SPECIFIC DATE ====================
    function openForDate(dateStr) {
        openModal(dateStr);
    }

    // ==================== PUBLIC ====================
    return {
        openModal,
        closeModal,
        generatePreview: _generatePreview,
        copyText,
        openWhatsApp,
        openForDate
    };
})();
