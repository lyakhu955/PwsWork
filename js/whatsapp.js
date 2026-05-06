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

    // ==================== SWITCH TAB ====================
    function switchTab(tab) {
        document.getElementById('wa-tab-msg').classList.toggle('active', tab === 'msg');
        document.getElementById('wa-tab-link').classList.toggle('active', tab === 'link');
        document.getElementById('wa-panel-msg').style.display = tab === 'msg' ? '' : 'none';
        document.getElementById('wa-panel-link').style.display = tab === 'link' ? '' : 'none';

        // Init week picker on first open
        if (tab === 'link') {
            if (!_linkWeekStart) {
                _linkWeekStart = _getMondayOf(new Date());
                // Pre-select first selected message date if available
                if (_selectedDates.length > 0) {
                    _linkSelectedDate = _selectedDates[0];
                    _linkWeekStart = _getMondayOf(new Date(_linkSelectedDate + 'T00:00:00'));
                }
            }
            _renderWeekPicker();
            _updateLinkPreview();
        }
    }

    // ==================== LINK TAB - WEEK PICKER ====================
    const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    let _linkWeekStart = null; // Monday of displayed week (Date obj)
    let _linkSelectedDate = null; // 'YYYY-MM-DD' string

    function _getMondayOf(date) {
        const d = new Date(date);
        const dow = d.getDay(); // 0=Sun
        const diff = dow === 0 ? -6 : 1 - dow; // shift to Monday
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function _toDateStr(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function _renderWeekPicker() {
        const labelEl = document.getElementById('wa-week-label');
        const daysEl = document.getElementById('wa-week-days');
        if (!labelEl || !daysEl || !_linkWeekStart) return;

        const weekEnd = new Date(_linkWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const formatShort = (d) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
        labelEl.textContent = `${formatShort(_linkWeekStart)} – ${formatShort(weekEnd)} ${weekEnd.getFullYear()}`;

        daysEl.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const day = new Date(_linkWeekStart);
            day.setDate(day.getDate() + i);
            const dateStr = _toDateStr(day);
            const isSelected = dateStr === _linkSelectedDate;
            const isToday = dateStr === _toDateStr(new Date());

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wa-week-day' + (isSelected ? ' selected' : '') + (isToday ? ' today' : '');
            btn.innerHTML = `<span class="wa-wd-name">${DAY_NAMES_SHORT[i]}</span><span class="wa-wd-num">${day.getDate()}</span>`;
            btn.addEventListener('click', () => {
                _linkSelectedDate = dateStr;
                _renderWeekPicker();
                _updateLinkPreview();
            });
            daysEl.appendChild(btn);
        }
    }

    function linkWeekPrev() {
        if (!_linkWeekStart) return;
        _linkWeekStart.setDate(_linkWeekStart.getDate() - 7);
        _renderWeekPicker();
    }

    function linkWeekNext() {
        if (!_linkWeekStart) return;
        _linkWeekStart.setDate(_linkWeekStart.getDate() + 7);
        _renderWeekPicker();
    }

    function _getBaseUrl() {
        return window.location.origin + window.location.pathname.replace(/\/$/, '');
    }

    function _updateLinkPreview() {
        const previewBox = document.getElementById('wa-link-preview');
        const copyBtn = document.getElementById('wa-copy-link-btn');
        const sendBtn = document.getElementById('wa-send-link-btn');
        if (!previewBox) return;

        if (!_linkSelectedDate) {
            previewBox.textContent = 'Seleziona un giorno...';
            if (copyBtn) copyBtn.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            return;
        }

        const url = `${_getBaseUrl()}?date=${_linkSelectedDate}`;
        previewBox.textContent = url;
        if (copyBtn) copyBtn.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    }

    function copyLink() {
        const previewBox = document.getElementById('wa-link-preview');
        const url = previewBox?.textContent?.trim();
        if (!url || url === 'Seleziona una data...') return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => _showLinkCopiedFeedback()).catch(() => _fallbackCopyLink(url));
        } else {
            _fallbackCopyLink(url);
        }
    }

    function _fallbackCopyLink(url) {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        _showLinkCopiedFeedback();
    }

    function _showLinkCopiedFeedback() {
        const btn = document.getElementById('wa-copy-link-btn');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '✅ Copiato!';
        btn.style.background = 'var(--success, #10b981)';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
        }, 2000);
    }

    function openWhatsAppLink() {
        if (!_linkSelectedDate) return;
        const url = `${_getBaseUrl()}?date=${_linkSelectedDate}`;
        const d = new Date(_linkSelectedDate + 'T00:00:00');
        const dateLabel = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
        
        // Using more compatible emojis and simpler dividers to avoid "broken" characters
        const text = `*PROGRAMMA LAVORI*\n--------------------------------\n📅 *${dateLabel}*\n--------------------------------\n\n👷 Clicca il link qui sotto per vedere la tua squadra e i posti di lavoro assegnati:\n\n🔗 ${url}\n\n📍 _PwsWork - Gestione Team_`;
        
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }

    // Bind date input change
    function _bindLinkDateInput() {
        const input = document.getElementById('wa-link-date');
        if (input) {
            input.addEventListener('change', _updateLinkPreview);
        }
    }

    // ==================== OPEN MODAL (updated) ====================
    const _origOpenModal = openModal;

    // Re-export openModal to also bind link date input
    const openModalFull = function(presetDate = null) {
        _origOpenModal(presetDate);
        // Default to "Link diretto" tab
        switchTab('link');
        setTimeout(_bindLinkDateInput, 50);
    };

    // ==================== PUBLIC ====================
    return {
        openModal: openModalFull,
        closeModal,
        generatePreview: _generatePreview,
        toggleCalendar,
        calendarPrev,
        calendarNext,
        toggleDay,
        copyText,
        openWhatsApp,
        openForDate,
        switchTab,
        copyLink,
        openWhatsAppLink,
        linkWeekPrev,
        linkWeekNext
    };
})();
