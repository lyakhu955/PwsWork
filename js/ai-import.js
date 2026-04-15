/* ========================================
   PWSWORK - AI IMPORT MODULE
   Import work schedules from free text
   using Google Gemini AI
   ======================================== */

const AiImport = (() => {
    const _k = atob('QUl6YVN5RHp0SzUwZk1ZcmI0RXFZSmxPaGh0RHZmRkxjLTEzUk8w');
    const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    let _parsedAssignments = []; // preview data from AI
    let _importDate = '';        // target date for import

    // ==================== OPEN MODAL ====================
    function openModal() {
        const modal = document.getElementById('ai-import-modal');
        if (!modal) return;

        // Default date = tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        _importDate = tomorrow.toISOString().split('T')[0];

        _parsedAssignments = [];

        const html = `
            <div class="modal-header">
                <h3>🤖 Importa Programma da Testo</h3>
                <button class="modal-close" onclick="AiImport.closeModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body" id="ai-import-body">
                <div class="ai-import-input-section">
                    <div class="form-group">
                        <label>📅 Data del programma</label>
                        <input type="date" id="ai-import-date" class="form-input" value="${_importDate}">
                    </div>
                    <div class="form-group">
                        <label>📋 Incolla il programma di lavoro</label>
                        <textarea id="ai-import-text" class="form-input ai-import-textarea" rows="10" placeholder="Es:\nJefrey e Salvo AQASOFT, spellicolare furgone Via Circonvallazione 67A Bellusco\n\nGerti e Santilo Centrufficio Rosales, Milano\n\nMatteo e Gianni 3 CUF Zona MB..."></textarea>
                    </div>
                    <button class="btn btn-primary ai-import-btn" onclick="AiImport.analyzeText()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        Analizza con AI
                    </button>
                </div>
                <div id="ai-import-preview" class="ai-import-preview" style="display:none;"></div>
            </div>
        `;

        modal.querySelector('.modal').innerHTML = html;
        modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('ai-import-modal');
        if (modal) modal.classList.remove('active');
        _parsedAssignments = [];
    }

    // ==================== BUILD SYSTEM PROMPT ====================
    function _buildSystemPrompt() {
        const employees = Storage.getEmployees();
        const empList = employees.map(e => `- "${e.firstName} ${e.lastName}" (id: ${e.id})`).join('\n');

        return `Sei un assistente che analizza programmi di lavoro scritti in italiano e li converte in JSON strutturato.

DIPENDENTI DISPONIBILI NEL SISTEMA:
${empList}

REGOLE DI PARSING:
1. Ogni blocco separato da riga vuota è una SQUADRA diversa
2. I NOMI dei dipendenti sono sempre all'inizio del blocco, separati da "e", virgola, o spazio
3. Fai matching fuzzy dei nomi: "Jefrey" → potrebbe essere "Jeffrey", "Leo" → "Leonardo", ecc. Usa i nomi dal sistema sopra
4. Dopo i nomi viene il NOME del posto di lavoro / cliente (es: "AQASOFT", "Centrufficio Rosales", "CUF")
5. Gli INDIRIZZI contengono parole come Via, Viale, Piazza, Corso + città
6. Il LAVORO DA FARE (task) è descritto con verbi o azioni (spellicolare, demolire, montare, ecc.)
7. NOTE/INFO: orari specifici (h 08.00, dalle 09.00 alle 17.00), istruzioni (chiamare prima, avvisare), metrature (26 MQ)
8. Se un gruppo di dipendenti ha PIÙ cantieri (righe successive con indirizzi diversi), crea PIÙ workplace nella stessa squadra
9. "da" + nome azienda = posto di lavoro (es: "Leo da Orecchia" → dipendente Leo, workplace "Orecchia")
10. Ignora frasi generiche come "Programma per domani:", "Grazie a tutti", saluti, ecc.
11. Il nome della squadra (teamName) deve essere "Gregge 1", "Gregge 2", ecc. numerato progressivamente
12. "CUF" è l'abbreviazione di "Centrufficio". Se c'è scritto "2 CUF", "3 CUF", "4 CUF" ecc., il numero indica QUANTI cantieri Centrufficio sono da fare. Quindi "3 CUF Zona MB" significa che ci sono 3 cantieri Centrufficio nella zona MB, e le righe successive descrivono ciascuno dei 3 cantieri (nome cliente, metratura, indirizzo). Ogni cantiere diventa un workplace separato nella stessa squadra.

FORMATO OUTPUT JSON (array di oggetti):
[
  {
    "teamName": "Gregge 1",
    "employeeNames": ["Jeffrey", "Salvo"],
    "workplaces": [
      {
        "name": "AQASOFT",
        "address": "Via Circonvallazione 67A, Bellusco MB",
        "task": "spellicolare e ripellicolare furgone",
        "info": "h 08.00",
        "timeStart": "08:00",
        "timeEnd": null
      }
    ]
  }
]

REGOLE IMPORTANTI:
- timeStart e timeEnd in formato "HH:MM" (24h) se specificati, altrimenti null
- Se ci sono info come "Dalle 09.00 alle 13.00 poi 14.00 alle 17.00" metti timeStart: "09:00", timeEnd: "17:00" e le info dettagliate nel campo info
- Metti TUTTE le note, metrature, istruzioni nel campo "info"
- Il campo "task" è il lavoro da fare (verbo/azione)
- Se non c'è un task esplicito, lascia task come stringa vuota ""
- Se non c'è un indirizzo, lascia address come stringa vuota ""
- Rispondi SOLO con il JSON valido, nessun testo prima o dopo, nessun markdown code block`;
    }

    // ==================== CALL GEMINI API ====================
    async function analyzeText() {
        const textArea = document.getElementById('ai-import-text');
        const dateInput = document.getElementById('ai-import-date');
        const text = textArea?.value.trim();
        _importDate = dateInput?.value || _importDate;

        if (!text) {
            App.showToast('Errore', 'Incolla il testo del programma', 'error');
            return;
        }

        if (!_importDate) {
            App.showToast('Errore', 'Seleziona una data', 'error');
            return;
        }

        // Show loading
        const btn = document.querySelector('.ai-import-btn');
        const originalBtnHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="ai-loading-spinner"></span> Analisi in corso...`;

        try {
            const systemPrompt = _buildSystemPrompt();
            const requestBody = JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: text }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            // Retry logic with model fallback for 429/503 errors
            let response = null;
            const maxRetries = 3;
            for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
                const model = GEMINI_MODELS[modelIdx];
                const url = `${GEMINI_BASE}${model}:generateContent?key=${_k}`;
                let success = false;

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    btn.innerHTML = `<span class="ai-loading-spinner"></span> Analisi in corso...${modelIdx > 0 ? ' (modello alternativo)' : ''}`;
                    
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: requestBody
                    });

                    if ((response.status === 429 || response.status === 503) && attempt < maxRetries - 1) {
                        const waitSec = Math.pow(2, attempt + 1); // 2, 4, 8s
                        btn.innerHTML = `<span class="ai-loading-spinner"></span> ${response.status === 503 ? 'Server occupato' : 'Limite API'} — riprovo tra ${waitSec}s...`;
                        await new Promise(r => setTimeout(r, waitSec * 1000));
                        continue;
                    }

                    if (response.ok) {
                        success = true;
                        break;
                    }
                    break; // non-retryable error, try next model
                }

                if (success) break;

                // If this model failed with 429/503, try next model
                if ((response.status === 429 || response.status === 503) && modelIdx < GEMINI_MODELS.length - 1) {
                    btn.innerHTML = `<span class="ai-loading-spinner"></span> Provo modello alternativo...`;
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                break;
            }

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Troppe richieste — aspetta 1 minuto e riprova');
                }
                throw new Error(`Errore API: ${response.status}`);
            }

            const result = await response.json();
            const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                throw new Error('Risposta vuota da Gemini');
            }

            // Parse JSON
            const parsed = JSON.parse(aiText);
            
            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('Nessuna squadra trovata nel testo');
            }

            _parsedAssignments = parsed;
            _renderPreview();

        } catch (err) {
            console.error('AI Import error:', err);
            App.showToast('Errore', 'Impossibile analizzare il testo: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }

    // ==================== MATCH EMPLOYEES ====================
    function _matchEmployeeByName(name) {
        const employees = Storage.getEmployees();
        const nameLower = name.toLowerCase().trim();

        // Exact first name match
        let match = employees.find(e => e.firstName.toLowerCase() === nameLower);
        if (match) return match;

        // Exact last name match
        match = employees.find(e => e.lastName.toLowerCase() === nameLower);
        if (match) return match;

        // Exact full name match
        match = employees.find(e => `${e.firstName} ${e.lastName}`.toLowerCase() === nameLower);
        if (match) return match;

        // Partial match (starts with)
        match = employees.find(e => e.firstName.toLowerCase().startsWith(nameLower) || nameLower.startsWith(e.firstName.toLowerCase()));
        if (match) return match;

        // Levenshtein-like fuzzy: find closest first name
        let bestMatch = null;
        let bestScore = 999;
        employees.forEach(e => {
            const dist = _levenshtein(nameLower, e.firstName.toLowerCase());
            if (dist < bestScore && dist <= 3) { // max 3 edits
                bestScore = dist;
                bestMatch = e;
            }
        });

        return bestMatch;
    }

    function _levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // ==================== RENDER PREVIEW ====================
    function _renderPreview() {
        const preview = document.getElementById('ai-import-preview');
        if (!preview) return;

        const dateFormatted = new Date(_importDate + 'T00:00:00').toLocaleDateString('it-IT', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        let html = `
            <div class="ai-preview-header">
                <h4>✅ Anteprima — ${dateFormatted}</h4>
                <p>Controlla che sia tutto corretto, poi clicca "Crea Programmi"</p>
            </div>
        `;

        _parsedAssignments.forEach((squad, idx) => {
            // Match employee names to IDs
            const matchedEmployees = (squad.employeeNames || []).map(name => {
                const emp = _matchEmployeeByName(name);
                return {
                    name,
                    matched: emp,
                    id: emp?.id || null,
                    displayName: emp ? `${emp.firstName} ${emp.lastName}` : null
                };
            });

            html += `
                <div class="ai-preview-card glass-card">
                    <div class="ai-preview-team">
                        <span class="ai-preview-team-name">🐑 ${squad.teamName || `Gregge ${idx + 1}`}</span>
                    </div>
                    <div class="ai-preview-employees">
                        <strong>👷 Dipendenti:</strong>
                        ${matchedEmployees.map(m => {
                            if (m.matched) {
                                return `<span class="ai-emp-matched" title="Trovato: ${m.displayName}">✅ ${m.displayName}</span>`;
                            } else {
                                return `<span class="ai-emp-unmatched" title="Non trovato nel sistema">⚠️ ${m.name} <small>(non trovato)</small></span>`;
                            }
                        }).join(' ')}
                    </div>
                    <div class="ai-preview-workplaces">
            `;

            (squad.workplaces || []).forEach(wp => {
                html += `
                    <div class="ai-preview-wp">
                        <div class="ai-preview-wp-name">📍 ${wp.name || 'Senza nome'}</div>
                        ${wp.address ? `<div class="ai-preview-wp-addr">🗺️ ${wp.address}</div>` : ''}
                        ${wp.task ? `<div class="ai-preview-wp-task">🔨 ${wp.task}</div>` : ''}
                        ${wp.info ? `<div class="ai-preview-wp-info">📝 ${wp.info}</div>` : ''}
                        ${wp.timeStart ? `<div class="ai-preview-wp-time">🕐 ${wp.timeStart}${wp.timeEnd ? ' — ' + wp.timeEnd : ''}</div>` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `
            <div class="ai-preview-actions">
                <button class="btn btn-outline" onclick="AiImport.analyzeText()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                    Rianalizza
                </button>
                <button class="btn btn-primary" onclick="AiImport.confirmImport()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Crea ${_parsedAssignments.length} Programmi
                </button>
            </div>
        `;

        preview.innerHTML = html;
        preview.style.display = 'block';
        preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==================== CONFIRM IMPORT ====================
    function confirmImport() {
        if (_parsedAssignments.length === 0) return;

        let created = 0;
        let skipped = 0;

        _parsedAssignments.forEach((squad, idx) => {
            // Match employees
            const employeeIds = [];
            (squad.employeeNames || []).forEach(name => {
                const emp = _matchEmployeeByName(name);
                if (emp && !employeeIds.includes(emp.id)) {
                    employeeIds.push(emp.id);
                }
            });

            if (employeeIds.length === 0) {
                skipped++;
                return;
            }

            // Build workplaces
            const workplaces = (squad.workplaces || []).map(wp => ({
                name: wp.name || '',
                address: wp.address || '',
                lat: null,
                lng: null,
                info: [wp.task, wp.info].filter(Boolean).join(' — '),
                timeStart: wp.timeStart || null,
                timeEnd: wp.timeEnd || null
            }));

            if (workplaces.length === 0) {
                skipped++;
                return;
            }

            const assignment = {
                date: _importDate,
                teamName: squad.teamName || `Gregge ${idx + 1}`,
                employeeIds,
                workplaces,
                notes: ''
            };

            Storage.addAssignment(assignment);
            created++;
        });

        closeModal();

        if (created > 0) {
            App.showToast('Importato! 🎉', `${created} squadre create con successo`, 'success');
            // Refresh schedule view
            if (typeof Schedule !== 'undefined' && Schedule.render) {
                Schedule.render();
            }
        }
        if (skipped > 0) {
            App.showToast('Attenzione', `${skipped} squadre saltate (dipendenti non trovati)`, 'warning');
        }
    }

    return {
        openModal,
        closeModal,
        analyzeText,
        confirmImport
    };
})();
