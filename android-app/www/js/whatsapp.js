/* ========================================
   PWSWORK - WHATSAPP SHARE MODULE
   Condivisione programma lavorativo per WhatsApp
   Organizzato per gregge/gruppo con emoji
   ======================================== */

const WhatsApp = (() => {

    const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                         'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

    // Selected dates (array of 'YYYY-MM-DD' strings)
    let _selectedDates = [];
    // Calendar state
    let _calYear = 0;
    let _calMonth = 0;
    let _calVisible = false;

    // ==================== OPEN MODAL ====================
    function openModal(presetDate = null) {
        const modal = document.getElementById('whatsapp-modal');
        if (!modal) return;

        // Default: tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const defaultDate = presetDate || Storage.toLocalDateStr(tomorrow);

        _selectedDates = [defaultDate];
        _calVisible = false;

        const calContainer = document.getElementById('wa-calendar-container');
        if (calContainer) calContainer.style.display = 'none';

        modal.classList.add('active');
        _updateDatesLabel();
        _generatePreview();
    }

    function closeModal() {
        const modal = document.getElementById('whatsapp-modal');
        if (modal) modal.classList.remove('active');
    }

    // ==================== DATES LABEL ====================
    function _updateDatesLabel() {
        const el = document.getElementById('wa-selected-dates-label');
        if (!el) return;
        if (_selectedDates.length === 0) {
            el.innerHTML = '📅 <strong>Nessun giorno selezionato</strong>';
        } else if (_selectedDates.length === 1) {
            const d = new Date(_selectedDates[0] + 'T00:00:00');
            el.innerHTML = `📅 <strong>${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}</strong>`;
        } else {
            const sorted = [..._selectedDates].sort();
            el.innerHTML = `📅 <strong>${_selectedDates.length} giorni selezionati</strong> <span style="font-size:0.8em;opacity:0.7">(${sorted.map(s => { const d = new Date(s+'T00:00:00'); return d.getDate()+' '+MONTH_NAMES[d.getMonth()].substring(0,3); }).join(', ')})</span>`;
        }
    }

    // ==================== CALENDAR ====================
    function toggleCalendar() {
        _calVisible = !_calVisible;
        const container = document.getElementById('wa-calendar-container');
        if (!container) return;
        container.style.display = _calVisible ? 'block' : 'none';
        if (_calVisible) {
            // Show current month (or month of first selected date)
            const base = _selectedDates.length > 0 ? new Date(_selectedDates[0] + 'T00:00:00') : new Date();
            _calYear = base.getFullYear();
            _calMonth = base.getMonth();
            _renderCalendar();
        }
    }

    function calendarPrev() {
        _calMonth--;
        if (_calMonth < 0) { _calMonth = 11; _calYear--; }
        _renderCalendar();
    }

    function calendarNext() {
        _calMonth++;
        if (_calMonth > 11) { _calMonth = 0; _calYear++; }
        _renderCalendar();
    }

    function _renderCalendar() {
        const titleEl = document.getElementById('wa-calendar-title');
        const gridEl = document.getElementById('wa-calendar-grid');
        if (!titleEl || !gridEl) return;

        titleEl.textContent = `${MONTH_NAMES[_calMonth]} ${_calYear}`;

        // Day headers
        const dayHeaders = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];
        let html = dayHeaders.map(d => `<div class="wa-cal-header">${d}</div>`).join('');

        // First day of month (Monday-based)
        const firstDay = new Date(_calYear, _calMonth, 1);
        let startDow = firstDay.getDay(); // 0=Sun
        startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

        // Empty cells before first day
        for (let i = 0; i < startDow; i++) {
            html += '<div class="wa-cal-empty"></div>';
        }

        // Days in month
        const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${_calYear}-${String(_calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isSelected = _selectedDates.includes(dateStr);
            html += `<div class="wa-cal-day${isSelected ? ' selected' : ''}" onclick="WhatsApp.toggleDay('${dateStr}')">${d}</div>`;
        }

        gridEl.innerHTML = html;
    }

    function toggleDay(dateStr) {
        const idx = _selectedDates.indexOf(dateStr);
        if (idx >= 0) {
            _selectedDates.splice(idx, 1);
        } else {
            _selectedDates.push(dateStr);
            _selectedDates.sort();
        }
        _renderCalendar();
        _updateDatesLabel();
        _generatePreview();
    }

    // ==================== GENERATE PREVIEW ====================
    function _generatePreview() {
        if (_selectedDates.length === 0) {
            const preview = document.getElementById('wa-preview-text');
            if (preview) preview.textContent = 'Seleziona almeno un giorno.';
            document.getElementById('wa-copy-btn').disabled = true;
            document.getElementById('wa-open-btn').disabled = true;
            return;
        }

        const text = _buildMessage([..._selectedDates].sort());
        const preview = document.getElementById('wa-preview-text');
        if (preview) preview.textContent = text || 'Nessuna assegnazione nei giorni selezionati.';

        const hasContent = text.trim().length > 0;
        document.getElementById('wa-copy-btn').disabled = !hasContent;
        document.getElementById('wa-open-btn').disabled = !hasContent;
    }

    // ==================== BUILD MESSAGE ====================

    // Splits an info string into individual task lines.
    // If any line starts with '-', each '-' line is a separate task.
    // Otherwise the whole string is one task.
    function _splitInfoLines(info) {
        if (!info || !info.trim()) return [];
        const raw = info.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const hasDash = raw.some(l => l.startsWith('-'));
        if (hasDash) {
            // Only keep lines that start with '-'; ignore continuation lines without '-'
            return raw.filter(l => l.startsWith('-'));
        }
        // No dash: treat entire text as one task (join lines)
        return [raw.join(' ')];
    }

    function _buildMessage(dates) {
        const lines = [];
        let hasAny = false;

        // Header
        lines.push('╔══════════════════════════════╗');
        lines.push('║   🏗️  PROGRAMMA LAVORI PWS    ║');
        lines.push('╚══════════════════════════════╝');
        lines.push('');

        dates.forEach(dateStr => {
            const assignments = Storage.getAssignmentsByDate(dateStr);
            if (assignments.length === 0) return;

            hasAny = true;

            const dateObj = new Date(dateStr + 'T00:00:00');
            const dayName = DAY_NAMES[dateObj.getDay()].toUpperCase();
            const day = dateObj.getDate();
            const month = MONTH_NAMES[dateObj.getMonth()].toUpperCase();
            const year = dateObj.getFullYear();

            lines.push(`━━━ 📅 ${dayName} ${day} ${month} ${year} ━━━`);
            lines.push('');

            assignments.forEach((asgn, idx) => {
                const teamName = (asgn.teamName || `Gregge ${idx + 1}`).toUpperCase();

                // Centred team name with sheep emoji
                const label = `🐑 *${teamName}*`;
                const pad = ' '.repeat(Math.max(0, Math.floor((34 - label.replace(/[*]/g, '').length) / 2)));
                lines.push(`${pad}${label}`);

                // Members joined by em dash, all uppercase
                const members = (asgn.employeeIds || []).map(eid => {
                    const emp = Storage.getEmployee(eid);
                    return emp ? `${emp.firstName} ${emp.lastName}`.toUpperCase() : null;
                }).filter(Boolean);

                if (members.length > 0) {
                    lines.push(`👷 ${members.join('—')}`);
                }

                // Workplaces — each gets 📍 → 🔨(s) → 🗺️ → ┄┄┄
                if (asgn.workplaces && asgn.workplaces.length > 0) {
                    asgn.workplaces.forEach(wp => {
                        const name = (wp.name || '').toUpperCase();
                        const address = wp.address || '';
                        const infoLines = _splitInfoLines(wp.info || '');

                        // 📍 line
                        if (name && address && name !== address.toUpperCase()) {
                            lines.push(`📍 ${name} — ${address}`);
                        } else if (name) {
                            lines.push(`📍 ${name}`);
                        } else if (address) {
                            lines.push(`📍 ${address}`);
                        }

                        // 🔨 lines (one per task)
                        infoLines.forEach(task => {
                            lines.push(`🔨 ${task}`);
                        });

                        // 🗺️ maps link
                        if (wp.lat && wp.lng) {
                            lines.push(`🗺️ https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lng}`);
                        } else if (address) {
                            lines.push(`🗺️ https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
                        } else if (name) {
                            lines.push(`🗺️ https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`);
                        }

                        // Divider after every workplace
                        lines.push('┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄');
                    });
                } else {
                    lines.push('┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄');
                }
            });

            lines.push('');
        });

        if (!hasAny) return '';

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
        toggleCalendar,
        calendarPrev,
        calendarNext,
        toggleDay,
        copyText,
        openWhatsApp,
        openForDate
    };
})();
