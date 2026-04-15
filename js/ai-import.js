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
    let _matchOverrides = {};    // user corrections: { "squadIdx_empIdx": empId|null }

    // ==================== ITALIAN NICKNAME MAP ====================
    // Common Italian diminutives/nicknames → canonical first names
    const NICKNAME_MAP = {
        'ale': ['alessandro', 'alessio', 'alessandra'],
        'alex': ['alessandro', 'alessio'],
        'andro': ['alessandro'],
        'sandro': ['alessandro'],
        'andy': ['andrea'],
        'beppe': ['giuseppe'],
        'peppe': ['giuseppe'],
        'pino': ['giuseppe'],
        'giuse': ['giuseppe'],
        'fra': ['francesco', 'francesca'],
        'francy': ['francesco', 'francesca'],
        'cesco': ['francesco'],
        'checco': ['francesco'],
        'luca': ['luca', 'gianluca'],
        'gianlù': ['gianluca'],
        'matte': ['matteo', 'mattia'],
        'matt': ['matteo', 'mattia'],
        'teo': ['matteo'],
        'leo': ['leonardo', 'leone'],
        'nardo': ['leonardo'],
        'vale': ['valentino', 'valentina', 'valerio', 'valeria'],
        'roby': ['roberto'],
        'rob': ['roberto'],
        'robe': ['roberto'],
        'dave': ['davide'],
        'davi': ['davide'],
        'dany': ['daniele', 'daniela'],
        'dani': ['daniele', 'daniela'],
        'miky': ['michele'],
        'mike': ['michele'],
        'miki': ['michele'],
        'mich': ['michele'],
        'manu': ['emanuele', 'emanuela', 'manuel'],
        'lele': ['emanuele', 'gabriele'],
        'gabri': ['gabriele', 'gabriella'],
        'gab': ['gabriele'],
        'nick': ['nicola', 'nicolò'],
        'nico': ['nicola', 'nicolò'],
        'ste': ['stefano', 'stefania'],
        'stefy': ['stefano', 'stefania'],
        'fede': ['federico', 'federica'],
        'fedo': ['federico'],
        'rico': ['federico', 'enrico'],
        'enri': ['enrico'],
        'simo': ['simone', 'simona'],
        'cri': ['cristian', 'cristina'],
        'chris': ['cristian', 'christian'],
        'fabri': ['fabrizio'],
        'gio': ['giovanni', 'giorgio'],
        'giova': ['giovanni'],
        'nanni': ['giovanni'],
        'vanni': ['giovanni'],
        'gianni': ['giovanni', 'gianni'],
        'salvo': ['salvatore', 'salvo'],
        'totò': ['salvatore'],
        'turi': ['salvatore'],
        'gert': ['gerti'],
        'santi': ['santilo', 'santiago'],
        'san': ['santilo', 'santiago'],
        'lollo': ['lorenzo'],
        'lory': ['lorenzo', 'lorena'],
        'enzo': ['vincenzo', 'lorenzo', 'enzo'],
        'vinny': ['vincenzo'],
        'vince': ['vincenzo'],
        'marco': ['marco', 'marcello'],
        'cello': ['marcello'],
        'tony': ['antonio', 'antonino'],
        'anto': ['antonio', 'antonino'],
        'nino': ['antonino'],
        'gigi': ['luigi'],
        'tom': ['tommaso'],
        'tommy': ['tommaso'],
        'filo': ['filippo'],
        'pippo': ['filippo'],
        'fil': ['filippo'],
        'edo': ['edoardo'],
        'pete': ['pietro'],
        'max': ['massimo', 'massimiliano'],
        'massi': ['massimo', 'massimiliano'],
        'claudio': ['claudio'],
        'clau': ['claudio', 'claudia'],
        'jeff': ['jeffrey'],
        'jef': ['jeffrey'],
        'jefrey': ['jeffrey'],
        'pat': ['patrizio', 'patrizia', 'patrick'],
    };

    // ==================== OPEN MODAL ====================
    function openModal() {
        const modal = document.getElementById('ai-import-modal');
        if (!modal) return;

        // Default date = tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        _importDate = tomorrow.toISOString().split('T')[0];

        _parsedAssignments = [];
        _matchOverrides = {};

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
        _matchOverrides = {};
    }

    // ==================== BUILD SYSTEM PROMPT ====================
    function _buildSystemPrompt() {
        const employees = Storage.getEmployees();
        const empList = employees.map(e => `  - "${e.firstName} ${e.lastName}" (id: ${e.id})`).join('\n');

        return `Sei un assistente esperto nell'analizzare programmi di lavoro giornalieri scritti in italiano informale (spesso via WhatsApp) e convertirli in JSON strutturato.

═══════════════════════════════════════
DIPENDENTI REGISTRATI NEL SISTEMA:
═══════════════════════════════════════
${empList}

═══════════════════════════════════════
STRUTTURA DEL TESTO IN INPUT:
═══════════════════════════════════════
Il testo descrive il programma di lavoro per il giorno successivo. Tipicamente:
- Ogni BLOCCO separato da una o più righe vuote rappresenta una SQUADRA diversa
- All'interno di un blocco: prima i NOMI dei dipendenti, poi il CANTIERE/CLIENTE, poi eventualmente INDIRIZZO, LAVORO, ORARI e NOTE
- Il formato è molto libero e informale — può contenere abbreviazioni, errori di battitura, emoji, punteggiatura mancante

═══════════════════════════════════════
REGOLE DI IDENTIFICAZIONE DIPENDENTI:
═══════════════════════════════════════
1. I NOMI appaiono SEMPRE all'inizio del blocco, separati da "e", virgola, "con", "+" o semplicemente spazio
2. Fai matching FUZZY dei nomi: gestisci abbreviazioni, diminutivi, errori di battitura. Esempi:
   - "Jefrey", "Jeff", "Jeffry" → "Jeffrey"
   - "Leo" → "Leonardo"
   - "Salvo" → "Salvatore" (se esiste) oppure "Salvo" (se esiste)
   - "Matte" → "Matteo"
   - "Giova" → "Giovanni"
   - "Santi" → "Santilo"
   - "Beppe" → "Giuseppe"
3. USA SOLO i nomi dalla lista dipendenti sopra. Se un nome nel testo non corrisponde a NESSUN dipendente, riportalo comunque in employeeNames così com'è scritto
4. Se un nome è ambiguo (potrebbe corrispondere a più dipendenti), scegli il più probabile in base al contesto
5. "da" + nome azienda NON è un cognome: "Leo da Orecchia" → dipendente "Leo", workplace "Orecchia"

═══════════════════════════════════════
REGOLE DI IDENTIFICAZIONE CANTIERI/CLIENTI:
═══════════════════════════════════════
6. Il NOME del cantiere/cliente appare dopo i nomi dei dipendenti
7. ABBREVIAZIONI COMUNI da espandere nel nome workplace:
   - "CUF" = "Centrufficio"
   - "AQA" = "AQASOFT"  
   - Altre abbreviazioni vanno lasciate come sono
8. ⚠️ REGOLA CRITICA — PATTERN "N CUF" (numero + CUF):
   Quando trovi "2 CUF", "3 CUF", "4 CUF" ecc., il NUMERO indica QUANTI cantieri Centrufficio ci sono.
   Le righe SUCCESSIVE al "N CUF" descrivono i singoli cantieri (uno per riga: nome cliente, metratura, indirizzo).
   DEVI creare ESATTAMENTE N workplaces separati nella stessa squadra.
   Il nome di ogni workplace DEVE essere "N CUF - [nome cliente]", mantenendo la dicitura originale "N CUF" davanti.
   Esempio: "3 CUF Zona MB\nBianchi 26mq Via Roma 5 Monza\nVerdi 30mq Via Garibaldi Seregno\nNeri 18mq Viale Italia Lissone"
   → 3 workplaces: "3 CUF - Bianchi", "3 CUF - Verdi", "3 CUF - Neri"
   Se scritto solo "CUF" senza numero davanti = 1 singolo cantiere, nome: "CUF - [nome cliente]"
9. "da [nome]" dopo i dipendenti = workplace. Es: "Leo da Orecchia" → wp name "Orecchia"; "Marco e Luca da Bianchi" → wp name "Bianchi"
10. Se lo stesso blocco menziona PIÙ cantieri (righe successive con indirizzi/clienti diversi), crea PIÙ workplaces nella stessa squadra

═══════════════════════════════════════
REGOLE DI IDENTIFICAZIONE INDIRIZZI:
═══════════════════════════════════════
11. Gli INDIRIZZI contengono parole chiave: Via, Viale, V.le, Piazza, P.za, P.zza, Corso, C.so, Largo, Vicolo, Strada, S.da, Loc., Località, Fraz., Frazione
12. Dopo l'indirizzo spesso c'è il COMUNE e la PROVINCIA (sigla 2 lettere: MI, MB, BG, VA, CO, ecc.)
13. Se un indirizzo è incompleto, riporta quello che c'è senza inventare
14. Normalizza: aggiungi la virgola prima del comune se mancante. Es: "Via Roma 5 Milano" → "Via Roma 5, Milano"

═══════════════════════════════════════
REGOLE DI IDENTIFICAZIONE LAVORO/TASK:
═══════════════════════════════════════
15. Il TASK è descritto con verbi o azioni: spellicolare, ripellicolare, demolire, montare, smontare, posare, rimuovere, installare, consegna, ritiro, carico, scarico, pulizia, sopralluogo, misure, preventivo, manutenzione, riparazione, tinteggiare, cartongesso, pavimento, controsoffitto, ecc.
16. Se ci sono più azioni, concatenale: "spellicolare e ripellicolare" → task: "spellicolare e ripellicolare"
17. Se non c'è un task esplicito, lascia task come stringa vuota ""

═══════════════════════════════════════
REGOLE DI IDENTIFICAZIONE ORARI E NOTE:
═══════════════════════════════════════
18. ORARI: cerca pattern come "h 08.00", "ore 8", "dalle 09:00 alle 17:00", "8.30-16.30", "mattina", "pomeriggio"
    - "h 08.00" o "ore 8" → timeStart: "08:00"
    - "dalle 09.00 alle 13.00 poi 14.00-17.00" → timeStart: "09:00", timeEnd: "17:00", info include dettaglio pausa
    - "mattina" → timeStart: "08:00", timeEnd: "13:00"
    - "pomeriggio" → timeStart: "14:00", timeEnd: "18:00"
19. NOTE/INFO: tutte le informazioni extra vanno nel campo "info":
    - Metrature: "26 MQ", "30mq", "120 m²"
    - Istruzioni: "chiamare prima", "avvisare il portiere", "chiedere chiavi"
    - Referenti: "Sig. Rossi", "chiedere di Mario"
    - Piano: "3° piano", "piano terra", "seminterrato"
    - Dettagli vari: "portare scala", "serve furgone", "parcheggio retro"

═══════════════════════════════════════
REGOLE GENERALI:
═══════════════════════════════════════
20. IGNORA frasi generiche: "Programma per domani:", "Buonasera", "Grazie a tutti", saluti, emoji decorative, messaggi meta
21. Il nome della squadra (teamName) deve essere "Gregge 1", "Gregge 2", ecc. numerato progressivamente
22. Se un blocco contiene UN SOLO dipendente, è comunque una squadra valida
23. Se trovi righe con solo un indirizzo o cantiere senza dipendenti, probabilmente appartengono alla squadra/blocco precedente come workplace aggiuntivo
24. Cerca di NON duplicare dipendenti tra squadre diverse (lo stesso operaio non può essere in 2 posti)
25. Se il testo menziona veicoli (furgone, camion, mezzo) mettilo nelle info, non come task
26. ⚠️ REMINDER CUF: quando c'è "N CUF" (es: "3 CUF"), DEVI creare esattamente N workplaces. Ogni workplace si chiama "N CUF - [nome cliente]". NON creare un solo workplace generico. Ogni riga dopo "N CUF" è un cantiere separato

═══════════════════════════════════════
FORMATO OUTPUT:
═══════════════════════════════════════
Rispondi ESCLUSIVAMENTE con un array JSON valido, senza testo prima o dopo, senza markdown code block.

Schema per ogni elemento dell'array:
{
  "teamName": "Gregge N",
  "employeeNames": ["Nome1", "Nome2"],
  "workplaces": [
    {
      "name": "Nome Cantiere/Cliente",
      "address": "Via/Piazza/Corso ..., Comune PROV",
      "task": "azione da fare",
      "info": "note, metrature, istruzioni, orari dettagliati",
      "timeStart": "HH:MM" | null,
      "timeEnd": "HH:MM" | null
    }
  ]
}

ESEMPIO COMPLETO:
Input: "Jefrey e Salvo AQASOFT spellicolare furgone Via Circonvallazione 67A Bellusco h 08.00

Gerti e Santilo da Centrufficio Rosales Via Manzoni 12 Milano

Matteo e Gianni 3 CUF Zona MB
Bianchi 26mq Via Roma 5 Monza
Verdi 30mq Via Garibaldi 10 Seregno  
Neri 18mq Viale Italia 3 Lissone"

Output:
[
  {
    "teamName": "Gregge 1",
    "employeeNames": ["Jeffrey", "Salvo"],
    "workplaces": [{
      "name": "AQASOFT",
      "address": "Via Circonvallazione 67A, Bellusco",
      "task": "spellicolare furgone",
      "info": "",
      "timeStart": "08:00",
      "timeEnd": null
    }]
  },
  {
    "teamName": "Gregge 2",
    "employeeNames": ["Gerti", "Santilo"],
    "workplaces": [{
      "name": "Centrufficio Rosales",
      "address": "Via Manzoni 12, Milano",
      "task": "",
      "info": "",
      "timeStart": null,
      "timeEnd": null
    }]
  },
  {
    "teamName": "Gregge 3",
    "employeeNames": ["Matteo", "Gianni"],
    "workplaces": [
      {
        "name": "3 CUF - Bianchi",
        "address": "Via Roma 5, Monza",
        "task": "",
        "info": "26 mq",
        "timeStart": null,
        "timeEnd": null
      },
      {
        "name": "3 CUF - Verdi",
        "address": "Via Garibaldi 10, Seregno",
        "task": "",
        "info": "30 mq",
        "timeStart": null,
        "timeEnd": null
      },
      {
        "name": "3 CUF - Neri",
        "address": "Viale Italia 3, Lissone",
        "task": "",
        "info": "18 mq",
        "timeStart": null,
        "timeEnd": null
      }
    ]
  }
]`;
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
            _matchOverrides = {}; // reset corrections on re-analyze
            _renderPreview();

        } catch (err) {
            console.error('AI Import error:', err);
            App.showToast('Errore', 'Impossibile analizzare il testo: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }

    // ==================== TEXT NORMALIZATION ====================
    function _normalize(str) {
        return str.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
            .replace(/[''`]/g, "'");
    }

    // ==================== MATCH EMPLOYEES ====================
    function _matchEmployeeByName(name) {
        const employees = Storage.getEmployees();
        const raw = name.trim();
        const norm = _normalize(raw);
        if (!norm) return null;

        // 1. Exact full name match (first + last)
        let match = employees.find(e =>
            _normalize(`${e.firstName} ${e.lastName}`) === norm ||
            _normalize(`${e.lastName} ${e.firstName}`) === norm
        );
        if (match) return match;

        // 2. Exact first name match
        match = employees.find(e => _normalize(e.firstName) === norm);
        if (match) return match;

        // 3. Exact last name match
        match = employees.find(e => _normalize(e.lastName) === norm);
        if (match) return match;

        // 4. Nickname map lookup
        const nickMatches = NICKNAME_MAP[norm];
        if (nickMatches) {
            for (const canonical of nickMatches) {
                match = employees.find(e => _normalize(e.firstName) === canonical);
                if (match) return match;
            }
        }

        // 5. Partial prefix match (input starts with name or name starts with input), min 3 chars
        if (norm.length >= 3) {
            match = employees.find(e => {
                const fn = _normalize(e.firstName);
                return fn.startsWith(norm) || norm.startsWith(fn);
            });
            if (match) return match;

            // Also check last name prefix
            match = employees.find(e => {
                const ln = _normalize(e.lastName);
                return ln.startsWith(norm) || norm.startsWith(ln);
            });
            if (match) return match;
        }

        // 6. Jaro-Winkler similarity on first name (threshold ≥ 0.85)
        let bestMatch = null;
        let bestScore = 0;
        employees.forEach(e => {
            const fn = _normalize(e.firstName);
            const score = _jaroWinkler(norm, fn);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = e;
            }
            // Also try against last name
            const ln = _normalize(e.lastName);
            const lnScore = _jaroWinkler(norm, ln);
            if (lnScore > bestScore) {
                bestScore = lnScore;
                bestMatch = e;
            }
        });
        if (bestMatch && bestScore >= 0.85) return bestMatch;

        // 7. Levenshtein fallback (max 2 edits for short names, 3 for longer)
        bestMatch = null;
        let bestDist = 999;
        const maxDist = norm.length <= 5 ? 2 : 3;
        employees.forEach(e => {
            const fn = _normalize(e.firstName);
            const dist = _levenshtein(norm, fn);
            if (dist < bestDist && dist <= maxDist) {
                bestDist = dist;
                bestMatch = e;
            }
        });

        return bestMatch;
    }

    // ==================== JARO-WINKLER SIMILARITY ====================
    function _jaroWinkler(s1, s2) {
        if (s1 === s2) return 1.0;
        const len1 = s1.length, len2 = s2.length;
        if (len1 === 0 || len2 === 0) return 0.0;

        const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
        const s1Matches = new Array(len1).fill(false);
        const s2Matches = new Array(len2).fill(false);

        let matches = 0, transpositions = 0;

        for (let i = 0; i < len1; i++) {
            const start = Math.max(0, i - matchDist);
            const end = Math.min(i + matchDist + 1, len2);
            for (let j = start; j < end; j++) {
                if (s2Matches[j] || s1[i] !== s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }
        if (matches === 0) return 0.0;

        let k = 0;
        for (let i = 0; i < len1; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }

        const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

        // Winkler bonus for common prefix (up to 4 chars)
        let prefix = 0;
        for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
            if (s1[i] === s2[i]) prefix++;
            else break;
        }
        return jaro + prefix * 0.1 * (1 - jaro);
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

        const employees = Storage.getEmployees();
        const dateFormatted = new Date(_importDate + 'T00:00:00').toLocaleDateString('it-IT', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        let html = `
            <div class="ai-preview-header">
                <h4>✅ Anteprima — ${dateFormatted}</h4>
                <p>Controlla i risultati. Puoi correggere i dipendenti con i menu a tendina.</p>
            </div>
        `;

        _parsedAssignments.forEach((squad, sIdx) => {
            // Match employee names to IDs (considering overrides)
            const matchedEmployees = (squad.employeeNames || []).map((name, eIdx) => {
                const overrideKey = `${sIdx}_${eIdx}`;
                if (_matchOverrides.hasOwnProperty(overrideKey)) {
                    const overrideId = _matchOverrides[overrideKey];
                    if (overrideId === '__none__') {
                        return { name, matched: null, id: null, displayName: null, overridden: true };
                    }
                    const emp = employees.find(e => e.id === overrideId);
                    return { name, matched: emp, id: emp?.id, displayName: emp ? `${emp.firstName} ${emp.lastName}` : null, overridden: true };
                }
                const emp = _matchEmployeeByName(name);
                return {
                    name,
                    matched: emp,
                    id: emp?.id || null,
                    displayName: emp ? `${emp.firstName} ${emp.lastName}` : null,
                    overridden: false
                };
            });

            html += `
                <div class="ai-preview-card glass-card">
                    <div class="ai-preview-team">
                        <span class="ai-preview-team-name">🐑 ${squad.teamName || `Gregge ${sIdx + 1}`}</span>
                    </div>
                    <div class="ai-preview-employees">
                        <strong>👷 Dipendenti:</strong>
                        <div class="ai-emp-list">
            `;

            matchedEmployees.forEach((m, eIdx) => {
                const overrideKey = `${sIdx}_${eIdx}`;
                const selectId = `ai-emp-select-${overrideKey}`;
                const isMatched = !!m.matched;
                const statusIcon = isMatched ? '✅' : '⚠️';
                const statusClass = isMatched ? 'ai-emp-matched' : 'ai-emp-unmatched';

                html += `
                    <div class="ai-emp-row ${statusClass}">
                        <span class="ai-emp-original">${statusIcon} "${m.name}"</span>
                        <span class="ai-emp-arrow">→</span>
                        <select id="${selectId}" class="ai-emp-select" onchange="AiImport.overrideEmployee('${overrideKey}', this.value)">
                            <option value="__none__"${!isMatched ? ' selected' : ''}>-- Non assegnato --</option>
                `;

                employees.forEach(emp => {
                    const selected = (m.id === emp.id) ? ' selected' : '';
                    html += `<option value="${emp.id}"${selected}>${emp.firstName} ${emp.lastName}</option>`;
                });

                html += `
                        </select>
                    </div>
                `;
            });

            html += `
                        </div>
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

    // ==================== OVERRIDE EMPLOYEE MATCH ====================
    function overrideEmployee(key, empId) {
        _matchOverrides[key] = empId;
        // Update visual status of the row
        const select = document.getElementById(`ai-emp-select-${key}`);
        if (select) {
            const row = select.closest('.ai-emp-row');
            if (row) {
                row.classList.remove('ai-emp-matched', 'ai-emp-unmatched');
                row.classList.add(empId === '__none__' ? 'ai-emp-unmatched' : 'ai-emp-matched');
                const icon = row.querySelector('.ai-emp-original');
                if (icon) {
                    icon.textContent = icon.textContent.replace(/^[✅⚠️]/, empId === '__none__' ? '⚠️' : '✅');
                }
            }
        }
    }

    // ==================== CONFIRM IMPORT ====================
    function confirmImport() {
        if (_parsedAssignments.length === 0) return;

        const employees = Storage.getEmployees();
        let created = 0;
        let skipped = 0;
        let unmatchedNames = [];

        _parsedAssignments.forEach((squad, idx) => {
            // Match employees (respecting user overrides)
            const employeeIds = [];
            (squad.employeeNames || []).forEach((name, eIdx) => {
                const overrideKey = `${idx}_${eIdx}`;
                let empId = null;

                if (_matchOverrides.hasOwnProperty(overrideKey)) {
                    empId = _matchOverrides[overrideKey];
                    if (empId === '__none__') empId = null;
                } else {
                    const emp = _matchEmployeeByName(name);
                    empId = emp?.id || null;
                }

                if (empId && !employeeIds.includes(empId)) {
                    employeeIds.push(empId);
                } else if (!empId) {
                    unmatchedNames.push(name);
                }
            });

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

            if (workplaces.length === 0 && employeeIds.length === 0) {
                skipped++;
                return;
            }

            const assignment = {
                id: 'asgn_' + Date.now() + '_' + idx,
                date: _importDate,
                teamName: squad.teamName || `Gregge ${idx + 1}`,
                employeeIds,
                workplaces,
                notes: '',
                createdAt: new Date().toISOString()
            };

            // Save directly to avoid ID collision from Date.now()
            Storage._pushAssignment(assignment);
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
            App.showToast('Attenzione', `${skipped} squadre saltate (vuote)`, 'warning');
        }
        if (unmatchedNames.length > 0) {
            App.showToast('Info', `Dipendenti non trovati: ${unmatchedNames.join(', ')}`, 'warning');
        }
    }

    return {
        openModal,
        closeModal,
        analyzeText,
        confirmImport,
        overrideEmployee
    };
})();
