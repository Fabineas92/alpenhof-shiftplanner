// ========== PASSCODE LOCK ==========
(function () {
    'use strict';

    // Passcode hash is loaded from server, never exposed in code
    let PASSCODE_HASH = null;

    async function hashCode(code) {
        const encoded = new TextEncoder().encode(code + '_schichtplan_salt_julen');
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const QUOTES = [
        'Natur, Genuss & Wellness',
        'Traditionell, Authentisch & Informell',
        'Einzigartig, Entspannend & Atemberaubend',
        'Zeit fuer Tradition Julen',
        'Gelebte Familientradition seit 1910',
        'Herzlichen Service & Wohlfuehlmomente',
        'Die Magie dieser einzigartigen Bergwelt'
    ];

    async function initLockScreen() {
        const lockScreen = document.getElementById('lock-screen');
        if (!lockScreen) return;

        // Check if already authenticated this session
        if (sessionStorage.getItem('schichtplan_auth') === '1') {
            unlock();
            return;
        }

        // Load passcode hash from Supabase
        try {
            const res = await fetch('https://rpkdlckoupswdwttnvvt.supabase.co/rest/v1/settings?key=eq.passcode_hash&select=value', {
                headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa2RsY2tvdXBzd2R3dHRudnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzM2NDMsImV4cCI6MjA5MTMwOTY0M30.bguDIZx_Tl9jw88Z_nVlMpSdkJyXEufLrvBUSI2Qlg0',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa2RsY2tvdXBzd2R3dHRudnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzM2NDMsImV4cCI6MjA5MTMwOTY0M30.bguDIZx_Tl9jw88Z_nVlMpSdkJyXEufLrvBUSI2Qlg0'
                }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                PASSCODE_HASH = String(data[0].value);
            }
        } catch (e) {
            console.warn('Could not load passcode hash from server');
        }

        // Rotate quotes
        let quoteIdx = 0;
        const quoteEl = document.getElementById('lock-quote');
        setInterval(() => {
            quoteIdx = (quoteIdx + 1) % QUOTES.length;
            quoteEl.style.opacity = '0';
            setTimeout(() => {
                quoteEl.textContent = QUOTES[quoteIdx];
                quoteEl.style.opacity = '1';
            }, 400);
        }, 4000);

        // Digit input auto-focus
        const digits = document.querySelectorAll('.lock-digit');
        digits.forEach((input, i) => {
            input.addEventListener('input', () => {
                input.classList.remove('error');
                document.getElementById('lock-error').textContent = '';
                if (input.value.length === 1 && i < 3) {
                    digits[i + 1].focus();
                }
                // Auto-submit when all 4 filled
                const code = [...digits].map(d => d.value).join('');
                if (code.length === 4) {
                    setTimeout(() => checkCode(digits), 100);
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && input.value === '' && i > 0) {
                    digits[i - 1].focus();
                    digits[i - 1].value = '';
                }
                if (e.key === 'Enter') {
                    checkCode(digits);
                }
            });
            // Only allow numbers
            input.addEventListener('keypress', (e) => {
                if (!/[0-9]/.test(e.key)) e.preventDefault();
            });
        });

        document.getElementById('lock-submit').addEventListener('click', () => checkCode(digits));
    }

    async function checkCode(digits) {
        const code = [...digits].map(d => d.value).join('');
        const codeHash = await hashCode(code);
        if (PASSCODE_HASH && codeHash === PASSCODE_HASH) {
            sessionStorage.setItem('schichtplan_auth', '1');
            // Success animation
            digits.forEach(d => {
                d.style.borderColor = '#7dab6e';
                d.style.background = 'rgba(125,171,110,.1)';
            });
            setTimeout(unlock, 400);
        } else {
            digits.forEach(d => {
                d.classList.add('error');
                d.value = '';
            });
            document.getElementById('lock-error').textContent = 'Falscher Code';
            digits[0].focus();
            setTimeout(() => {
                digits.forEach(d => d.classList.remove('error'));
            }, 600);
        }
    }

    function unlock() {
        const lockScreen = document.getElementById('lock-screen');
        lockScreen.style.opacity = '0';
        lockScreen.style.transition = 'opacity .5s ease';
        setTimeout(() => {
            lockScreen.classList.add('hidden');
            document.getElementById('app').style.display = '';
            // Show tutorial if first time
            if (!localStorage.getItem('schichtplan_tutorial_done')) {
                setTimeout(() => window.startTutorial && window.startTutorial(), 300);
            }
        }, 500);
    }

    document.addEventListener('DOMContentLoaded', initLockScreen);
})();

// ========== INTERACTIVE GUIDE ==========
(function () {
    'use strict';

    // Each step targets a real UI element and shows a tooltip next to it
    const STEPS = [
        // --- Welcome (centered, no target) ---
        {
            title: 'Willkommen beim Schichtplaner',
            text: 'Dieses Tool hilft dir, die Schichtplaene fuer Hotel Julen und Hotel Alpenhof zu verwalten. Wir zeigen dir Schritt fuer Schritt, wo alles ist.',
            target: null, tab: null, pos: 'center'
        },
        // --- Sidebar Navigation ---
        {
            title: 'Navigation',
            text: 'Hier wechselst du zwischen den verschiedenen Bereichen: Wochenplan, Mitarbeiter, Schichttypen, Abwesenheiten, Statistiken und Einstellungen.',
            target: '#sidebar nav', tab: null, pos: 'right'
        },
        // --- Schedule: Week nav ---
        {
            title: 'Wochen-Navigation',
            text: 'Mit den Pfeilen wechselst du zwischen Wochen. "Heute" springt zur aktuellen Woche. Die Kalenderwoche und der Zeitraum werden oben angezeigt.',
            target: '.week-nav', tab: 'schedule', pos: 'bottom'
        },
        // --- Schedule: Hotel filter ---
        {
            title: 'Hotel-Filter',
            text: 'Zeige beide Hotels gleichzeitig oder filtere nach Hotel Julen oder Hotel Alpenhof. So hast du den Fokus auf ein Hotel, wenn du planst.',
            target: '.hotel-filter', tab: 'schedule', pos: 'bottom'
        },
        // --- Schedule: Auto-Fill ---
        {
            title: 'Auto-Fill',
            text: 'Fuellt die gesamte Woche automatisch. Beruecksichtigt Standard-Freitage, feste Schichten pro Wochentag und sorgt dafuer, dass immer Frueh- und Spaetschicht besetzt sind.',
            target: '#btn-auto-fill', tab: 'schedule', pos: 'bottom'
        },
        // --- Schedule: Copy ---
        {
            title: 'Woche kopieren',
            text: 'Kopiere den aktuellen Plan in die naechste Woche oder uebernimm den Plan der Vorwoche. Ideal wenn sich die Woche wiederholt.',
            target: '#btn-copy-week', tab: 'schedule', pos: 'bottom'
        },
        // --- Schedule: Shift cell ---
        {
            title: 'Schicht zuweisen',
            text: 'Klicke auf eine Zelle um die Schicht zu aendern. Du kannst Frueh, Spaet, Mittel, Frei, Ferien, Krank waehlen — oder eine eigene Vorlage erstellen. Die Stunden werden rechts unten angezeigt.',
            target: '.schedule-table tbody tr:first-child td:nth-child(2)', tab: 'schedule', pos: 'bottom'
        },
        // --- Schedule: Hours column ---
        {
            title: 'Wochenstunden',
            text: 'In der letzten Spalte siehst du die Gesamtstunden pro Mitarbeiter fuer diese Woche. So erkennst du schnell, ob jemand zu viel oder zu wenig arbeitet.',
            target: '.hours-col', tab: 'schedule', pos: 'left'
        },
        // --- Schedule: Coverage row ---
        {
            title: 'Besetzung pro Tag',
            text: 'Am Ende jeder Hotel-Tabelle siehst du die aktuelle Besetzung im Vergleich zum Minimum (z.B. 3/2). Gruen = ausreichend, Rot = unterbesetzt.',
            target: '.coverage-row', tab: 'schedule', pos: 'top'
        },
        // --- Schedule: Add employee row ---
        {
            title: 'Mitarbeiter direkt hinzufuegen',
            text: 'Klicke hier um einen neuen Mitarbeiter direkt aus dem Wochenplan heraus anzulegen. Das Hotel wird automatisch vorausgewaehlt.',
            target: '.btn-add-row', tab: 'schedule', pos: 'top'
        },
        // --- Employees tab ---
        {
            title: 'Mitarbeiter verwalten',
            text: 'Hier siehst du alle Mitarbeiter als Karten. Klicke "Bearbeiten" um Hotels, Freitage, feste Schichten und Tages-Schichten einzustellen.',
            target: '#employees-list', tab: 'employees', pos: 'top'
        },
        // --- Employees: Add button ---
        {
            title: 'Neuen Mitarbeiter anlegen',
            text: 'Klicke hier um einen neuen Mitarbeiter hinzuzufuegen. Du kannst Hotels zuordnen, Standard-Freitage festlegen und fuer jeden Wochentag eine feste Schicht waehlen.',
            target: '#btn-add-employee', tab: 'employees', pos: 'bottom'
        },
        // --- Shifts tab ---
        {
            title: 'Schichtvorlagen',
            text: 'Hier verwaltest du alle Schichttypen (Frueh, Spaet, Mittel, Tag, Schule). Du kannst eigene Vorlagen erstellen — z.B. halbe Schichten oder Teildienste.',
            target: '#shifts-list', tab: 'shifts', pos: 'top'
        },
        // --- Absences tab ---
        {
            title: 'Abwesenheiten eintragen',
            text: 'Trage hier Ferien, Krankheitstage oder sonstige Abwesenheiten mit Zeitraum ein. Die Tage werden automatisch im Schichtplan markiert.',
            target: '#btn-add-absence', tab: 'absences', pos: 'bottom'
        },
        // --- Stats tab ---
        {
            title: 'Statistiken & Ueberblick',
            text: 'Gesamtstunden, Hotel-Abdeckung, Schichtkonsistenz und ein visueller Stunden-Vergleich aller Mitarbeiter — alles auf einen Blick.',
            target: '#stats-container', tab: 'stats', pos: 'top'
        },
        // --- Settings: Coverage ---
        {
            title: 'Besetzung pro Hotel',
            text: 'Stelle die Mindestbesetzung fuer jedes Hotel separat ein. Der Wochenplan warnt dich, wenn ein Tag unterbesetzt ist.',
            target: '#coverage-settings', tab: 'settings', pos: 'top'
        },
        // --- Settings: Tutorial button ---
        {
            title: 'Tutorial erneut starten',
            text: 'Du kannst diesen Guide jederzeit hier erneut starten. Auch neue Mitarbeiter koennen sich so einarbeiten.',
            target: '#btn-restart-tutorial', tab: 'settings', pos: 'top'
        },
        // --- Done ---
        {
            title: 'Fertig!',
            text: 'Du kennst jetzt alle Funktionen. Viel Spass beim Planen! Tipp: Starte mit Auto-Fill und passe dann manuell an.\n\nMit Liebe gemacht von Fabian',
            target: null, tab: 'schedule', pos: 'center'
        }
    ];

    let currentStep = 0;
    let overlay, tooltip, highlight;

    window.startTutorial = function () {
        currentStep = 0;
        createGuideElements();
        renderGuideStep();
    };

    function createGuideElements() {
        // Dark overlay with hole
        overlay = document.getElementById('guide-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'guide-overlay';
            overlay.className = 'guide-overlay';
            document.body.appendChild(overlay);

            // Highlight ring
            highlight = document.createElement('div');
            highlight.id = 'guide-highlight';
            highlight.className = 'guide-highlight';
            document.body.appendChild(highlight);

            // Tooltip
            tooltip = document.createElement('div');
            tooltip.id = 'guide-tooltip';
            tooltip.className = 'guide-tooltip';
            tooltip.innerHTML = `
                <div class="guide-tooltip-arrow" id="guide-arrow"></div>
                <div class="guide-tooltip-header">
                    <span class="guide-step-badge" id="guide-badge"></span>
                    <h4 id="guide-title"></h4>
                </div>
                <p id="guide-text"></p>
                <div class="guide-tooltip-footer">
                    <button class="guide-btn-skip" id="guide-skip">Ueberspringen</button>
                    <div class="guide-tooltip-nav">
                        <button class="guide-btn-back" id="guide-back">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <span class="guide-counter" id="guide-counter"></span>
                        <button class="guide-btn-next" id="guide-next">Weiter</button>
                    </div>
                </div>
            `;
            document.body.appendChild(tooltip);

            document.getElementById('guide-skip').addEventListener('click', closeGuide);
            document.getElementById('guide-back').addEventListener('click', () => {
                if (currentStep > 0) { currentStep--; renderGuideStep(); }
            });
            document.getElementById('guide-next').addEventListener('click', () => {
                if (currentStep < STEPS.length - 1) { currentStep++; renderGuideStep(); }
                else closeGuide();
            });

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.style.display !== 'none') closeGuide();
            });
        }
        overlay.style.display = '';
        highlight.style.display = '';
        tooltip.style.display = '';
    }

    function renderGuideStep() {
        const step = STEPS[currentStep];

        // Switch tab
        if (step.tab) {
            const btn = document.querySelector(`.nav-btn[data-view="${step.tab}"]`);
            if (btn) btn.click();
        }

        // Wait for DOM to update after tab switch
        requestAnimationFrame(() => { requestAnimationFrame(() => {
            positionGuide(step);
        }); });
    }

    function positionGuide(step) {
        const tgt = step.target ? document.querySelector(step.target) : null;

        // Update text
        document.getElementById('guide-badge').textContent = (currentStep + 1);
        document.getElementById('guide-title').textContent = step.title;
        document.getElementById('guide-text').textContent = step.text;
        document.getElementById('guide-counter').textContent = `${currentStep + 1} / ${STEPS.length}`;

        // Back visibility
        document.getElementById('guide-back').style.visibility = currentStep === 0 ? 'hidden' : 'visible';

        // Next text
        const nextBtn = document.getElementById('guide-next');
        nextBtn.textContent = currentStep === STEPS.length - 1 ? 'Fertig' : 'Weiter';

        // Skip text
        document.getElementById('guide-skip').style.display = currentStep === STEPS.length - 1 ? 'none' : '';

        const arrow = document.getElementById('guide-arrow');

        if (!tgt || step.pos === 'center') {
            // Center tooltip, hide highlight
            highlight.style.display = 'none';
            overlay.style.background = 'rgba(0,0,0,.5)';
            overlay.style.clipPath = '';

            tooltip.style.position = 'fixed';
            tooltip.style.left = '50%';
            tooltip.style.top = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            tooltip.style.maxWidth = '420px';
            arrow.style.display = 'none';
            return;
        }

        // Scroll element into view
        tgt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setTimeout(() => {
            const rect = tgt.getBoundingClientRect();
            const pad = 8;

            // Position highlight
            highlight.style.display = '';
            highlight.style.left = (rect.left - pad) + 'px';
            highlight.style.top = (rect.top - pad) + 'px';
            highlight.style.width = (rect.width + pad * 2) + 'px';
            highlight.style.height = (rect.height + pad * 2) + 'px';

            // Clip overlay to create hole
            const hx = rect.left - pad;
            const hy = rect.top - pad;
            const hw = rect.width + pad * 2;
            const hh = rect.height + pad * 2;
            const r = 10;
            overlay.style.background = 'rgba(0,0,0,.45)';
            overlay.style.clipPath = `polygon(
                0% 0%, 0% 100%, ${hx}px 100%, ${hx}px ${hy}px,
                ${hx + hw}px ${hy}px, ${hx + hw}px ${hy + hh}px,
                ${hx}px ${hy + hh}px, ${hx}px 100%, 100% 100%, 100% 0%
            )`;

            // Position tooltip based on pos
            const ttWidth = 340;
            const ttHeight = tooltip.offsetHeight || 180;
            tooltip.style.position = 'fixed';
            tooltip.style.transform = 'none';
            tooltip.style.maxWidth = ttWidth + 'px';
            arrow.style.display = '';

            const gap = 16;
            let ttLeft, ttTop;

            if (step.pos === 'bottom') {
                ttLeft = rect.left + rect.width / 2 - ttWidth / 2;
                ttTop = rect.bottom + gap;
                arrow.className = 'guide-tooltip-arrow arrow-top';
            } else if (step.pos === 'top') {
                ttLeft = rect.left + rect.width / 2 - ttWidth / 2;
                ttTop = rect.top - ttHeight - gap;
                arrow.className = 'guide-tooltip-arrow arrow-bottom';
            } else if (step.pos === 'right') {
                ttLeft = rect.right + gap;
                ttTop = rect.top + rect.height / 2 - ttHeight / 2;
                arrow.className = 'guide-tooltip-arrow arrow-left';
            } else if (step.pos === 'left') {
                ttLeft = rect.left - ttWidth - gap;
                ttTop = rect.top + rect.height / 2 - ttHeight / 2;
                arrow.className = 'guide-tooltip-arrow arrow-right';
            }

            // Clamp to viewport
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            if (ttLeft < 12) ttLeft = 12;
            if (ttLeft + ttWidth > vw - 12) ttLeft = vw - ttWidth - 12;
            if (ttTop < 12) ttTop = 12;
            if (ttTop + ttHeight > vh - 12) ttTop = vh - ttHeight - 12;

            tooltip.style.left = ttLeft + 'px';
            tooltip.style.top = ttTop + 'px';
        }, 150);
    }

    function closeGuide() {
        if (overlay) overlay.style.display = 'none';
        if (highlight) highlight.style.display = 'none';
        if (tooltip) tooltip.style.display = 'none';
        localStorage.setItem('schichtplan_tutorial_done', '1');
        const btn = document.querySelector('.nav-btn[data-view="schedule"]');
        if (btn) btn.click();
    }
})();

// ========== SCHICHTPLAN APP ==========
(function () {
    'use strict';

    // ========== DEFAULT DATA ==========
    const DEFAULT_HOTELS = [
        { id: 'julen', name: 'Hotel Julen', color: '#3b82f6' },
        { id: 'alpenhof', name: 'Hotel Alpenhof', color: '#a855f7' }
    ];

    const DEFAULT_SHIFT_TYPES = [
        { id: 'early', name: 'Früh', start: '07:00', end: '16:30', breakMin: 60, color: '#3b82f6', cssClass: 'early' },
        { id: 'late', name: 'Spät', start: '14:00', end: '23:00', breakMin: 60, color: '#a855f7', cssClass: 'late' },
        { id: 'mid', name: 'Mittel', start: '11:00', end: '20:30', breakMin: 60, color: '#f97316', cssClass: 'mid' },
        { id: 'day', name: 'Tag', start: '09:00', end: '18:00', breakMin: 60, color: '#14b8a6', cssClass: 'custom' },
        { id: 'school', name: 'Schule', start: '08:00', end: '16:00', breakMin: 30, color: '#64748b', cssClass: 'custom' },
        { id: 'half_early', name: 'Halbe Früh', start: '07:00', end: '12:00', breakMin: 0, color: '#60a5fa', cssClass: 'early' },
        { id: 'half_late', name: 'Halbe Spät', start: '18:00', end: '23:00', breakMin: 0, color: '#c084fc', cssClass: 'late' },
        { id: 'custom_16_22', name: 'Nachmittag', start: '16:00', end: '22:00', breakMin: 0, color: '#e879f9', cssClass: 'custom' },
        { id: 'custom_8_12', name: 'Vormittag', start: '08:00', end: '12:00', breakMin: 0, color: '#38bdf8', cssClass: 'custom' }
    ];

    // defaultFreeDays: array of day indices (0=Mo,1=Di,...,6=So)
    // dayShifts: { 0: 'early', 1: 'early', ... } - fixed shift per weekday (optional)
    const DEFAULT_EMPLOYEES = [
        { id: 'e1', name: 'Johanna', hotels: ['julen'], fixedShift: null, maxDays: 5, color: '#3b82f6', defaultFreeDays: [3, 4], dayShifts: {}, order: 0 },
        { id: 'e2', name: 'Noemi', hotels: ['julen'], fixedShift: null, maxDays: 5, color: '#8b5cf6', defaultFreeDays: [0, 6], dayShifts: {}, order: 1 },
        { id: 'e3', name: 'Fabian', hotels: ['julen'], fixedShift: null, maxDays: 5, color: '#22c55e', defaultFreeDays: [0, 1], dayShifts: {}, order: 2 },
        { id: 'e4', name: 'Rocio', hotels: ['julen', 'alpenhof'], fixedShift: null, maxDays: 5, color: '#f59e0b', defaultFreeDays: [5, 6], dayShifts: {}, order: 3 },
        { id: 'e9', name: 'Alisa', hotels: ['julen'], fixedShift: 'day', maxDays: 5, color: '#06b6d4', defaultFreeDays: [], dayShifts: {}, order: 4, excludeFromCoverage: true, position: 'Front Office Manager' },
        { id: 'e5', name: 'Karin', hotels: ['alpenhof'], fixedShift: null, maxDays: 5, color: '#ec4899', defaultFreeDays: [5, 6], dayShifts: {}, order: 5 },
        { id: 'e6', name: 'Anano', hotels: ['alpenhof'], fixedShift: null, maxDays: 5, color: '#14b8a6', defaultFreeDays: [1, 2], dayShifts: {}, order: 6 },
        { id: 'e7', name: 'Lea', hotels: ['alpenhof'], fixedShift: null, maxDays: 3, color: '#f97316', defaultFreeDays: [3, 4, 5, 6], dayShifts: {}, order: 7 },
        { id: 'e8', name: 'Klaudia', hotels: ['alpenhof'], fixedShift: null, maxDays: 5, color: '#6366f1', defaultFreeDays: [0, 1], dayShifts: {}, order: 8 },
        { id: 'e10', name: 'Jenny', hotels: ['alpenhof'], fixedShift: 'day', maxDays: 5, color: '#d946ef', defaultFreeDays: [5, 6], dayShifts: {}, order: 9, excludeFromCoverage: true },
        { id: 'e11', name: 'Anja', hotels: ['julen', 'alpenhof'], fixedShift: 'school', maxDays: 5, color: '#94a3b8', defaultFreeDays: [5, 6], dayShifts: {}, order: 10, position: 'Auszubildende' },
        { id: 'e12', name: 'Olya', hotels: ['alpenhof'], fixedShift: 'school', maxDays: 5, color: '#78716c', defaultFreeDays: [5, 6], dayShifts: {}, order: 11 }
    ];

    const DEFAULT_SETTINGS = {
        maxDaysPerWeek: 5,
        minRestHours: 11,
        freeDaysPerWeek: 2,
        consistentShift: true,
        warnShiftSwitch: true,
        minCoverage: { julen: 2, alpenhof: 2 }
    };

    // ========== STATE ==========
    let state = {
        hotels: [],
        shiftTypes: [],
        employees: [],
        schedule: {}, // { 'YYYY-MM-DD': { employeeId: { hotel, shiftTypeId } } }
        absences: [], // { id, employeeId, type, startDate, endDate, note }
        rules: [], // { employeeId, type, description, maxHours }
        vacationRequests: [], // { id, employeeId, startDate, endDate, note, status }
        settings: {},
        currentWeekStart: null, // Monday date
        currentHotelFilter: 'all',
        currentView: 'schedule'
    };

    // ========== UTILITIES ==========
    function generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatDate(date) {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    function parseDate(str) {
        return new Date(str + 'T00:00:00');
    }

    function getMonday(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function getWeekDays(monday) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(monday, i));
        }
        return days;
    }

    function getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const DAY_NAMES_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    function formatDateShort(date) {
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatDateFull(date) {
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }

    function calcShiftHours(shiftType, includeBreak) {
        if (!shiftType) return 0;
        const [sh, sm] = shiftType.start.split(':').map(Number);
        const [eh, em] = shiftType.end.split(':').map(Number);
        let minutes = eh * 60 + em - sh * 60 - sm;
        if (minutes < 0) minutes += 24 * 60;
        // Subtract break for net hours calculation
        if (includeBreak !== false && shiftType.breakMin) {
            minutes -= shiftType.breakMin;
        }
        return minutes / 60;
    }

    function calcShiftHoursGross(shiftType) {
        if (!shiftType) return 0;
        const [sh, sm] = shiftType.start.split(':').map(Number);
        const [eh, em] = shiftType.end.split(':').map(Number);
        let minutes = eh * 60 + em - sh * 60 - sm;
        if (minutes < 0) minutes += 24 * 60;
        return minutes / 60;
    }

    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // Swiss/Valais holidays + Zermatt school holidays
    const HOLIDAYS = {
        // Fixed holidays
        '01-01': 'Neujahr', '01-02': 'Berchtoldstag', '03-19': 'Josefstag',
        '08-01': 'Nationalfeiertag', '08-15': 'Maria Himmelfahrt',
        '11-01': 'Allerheiligen', '12-08': 'Maria Empfaengnis',
        '12-25': '1. Weihnachtstag', '12-26': '2. Weihnachtstag'
    };

    // School holidays Valais 2025/2026 (approximate)
    const SCHOOL_HOLIDAYS_2026 = [
        { start: '2026-02-07', end: '2026-02-22', name: 'Sportferien' },
        { start: '2026-04-04', end: '2026-04-19', name: 'Osterferien' },
        { start: '2026-07-04', end: '2026-08-16', name: 'Sommerferien' },
        { start: '2026-10-10', end: '2026-10-25', name: 'Herbstferien' },
        { start: '2026-12-19', end: '2027-01-04', name: 'Weihnachtsferien' }
    ];

    function getHoliday(date) {
        const d = new Date(date);
        const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return HOLIDAYS[mmdd] || null;
    }

    function getSchoolHoliday(date) {
        const ds = formatDate(date);
        return SCHOOL_HOLIDAYS_2026.find(h => ds >= h.start && ds <= h.end);
    }

    function isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }

    // ========== PERSISTENCE ==========
    let saveTimer = null;
    const undoStack = [];
    const MAX_UNDO = 30;

    function pushUndo() {
        undoStack.push(JSON.stringify({
            schedule: state.schedule,
            employees: state.employees,
            absences: state.absences,
            shiftTypes: state.shiftTypes
        }));
        if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function undo() {
        if (undoStack.length === 0) { showToast('Nichts zum Rueckgaengig machen', 'info'); return; }
        const prev = JSON.parse(undoStack.pop());
        state.schedule = prev.schedule;
        state.employees = prev.employees;
        state.absences = prev.absences;
        state.shiftTypes = prev.shiftTypes;
        saveState();
        renderSchedule();
        showToast('Rueckgaengig gemacht', 'success');
    }

    function saveState(skipUndo) {
        // Push undo state before saving (unless skipped)
        if (!skipUndo) pushUndo();

        // Save to localStorage immediately (cache)
        const toSave = {
            hotels: state.hotels,
            shiftTypes: state.shiftTypes,
            employees: state.employees,
            schedule: state.schedule,
            absences: state.absences,
            rules: state.rules || [],
            vacationRequests: state.vacationRequests || [],
            settings: state.settings
        };
        localStorage.setItem('schichtplan_data', JSON.stringify(toSave));

        // Debounced save to Supabase (500ms)
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            if (window.db) {
                window.db.saveAll(state).then(() => {
                    console.log('Supabase sync OK');
                }).catch(err => {
                    console.error('Supabase sync error:', err);
                });
            }
        }, 500);
    }

    async function loadState() {
        state.currentWeekStart = getMonday(new Date());

        // Try Supabase first
        if (window.db) {
            try {
                const remote = await window.db.loadAll();
                if (remote && remote.employees && remote.employees.length > 0) {
                    state.hotels = remote.hotels.length > 0 ? remote.hotels : DEFAULT_HOTELS;
                    state.shiftTypes = remote.shiftTypes.length > 0 ? remote.shiftTypes : DEFAULT_SHIFT_TYPES;
                    state.employees = remote.employees;
                    state.schedule = remote.schedule || {};
                    state.absences = remote.absences || [];
                    state.settings = { ...DEFAULT_SETTINGS, ...(remote.settings || {}) };
                    // Cache locally
                    localStorage.setItem('schichtplan_data', JSON.stringify({
                        hotels: state.hotels, shiftTypes: state.shiftTypes,
                        employees: state.employees, schedule: state.schedule,
                        absences: state.absences, settings: state.settings
                    }));
                    console.log('Loaded from Supabase');
                    return;
                }
            } catch (err) {
                console.warn('Supabase load failed, using local:', err);
            }
        }

        // Fallback: localStorage
        const raw = localStorage.getItem('schichtplan_data');
        if (raw) {
            try {
                const data = JSON.parse(raw);
                state.hotels = data.hotels || DEFAULT_HOTELS;
                state.shiftTypes = data.shiftTypes || DEFAULT_SHIFT_TYPES;
                state.employees = data.employees || DEFAULT_EMPLOYEES;
                state.schedule = data.schedule || {};
                state.absences = data.absences || [];
                state.rules = data.rules || [];
                state.vacationRequests = data.vacationRequests || [];
                state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
            } catch {
                initDefaults();
            }
        } else {
            initDefaults();
            // First time: push defaults to Supabase
            if (window.db) {
                window.db.saveAll(state).then(() => console.log('Defaults synced to Supabase')).catch(() => {});
            }
        }
    }

    function initDefaults() {
        state.hotels = JSON.parse(JSON.stringify(DEFAULT_HOTELS));
        state.shiftTypes = JSON.parse(JSON.stringify(DEFAULT_SHIFT_TYPES));
        state.employees = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
        state.schedule = {};
        state.absences = [];
        state.rules = [
            { employeeId: 'e11', type: 'not-alone', description: 'Anja darf nicht alleine auf einer Schicht sein' }
        ];
        state.vacationRequests = [];
        state.settings = { ...DEFAULT_SETTINGS, vacationDaysPerMonth: 1.75 };

        // ===== SCHEDULE DATA =====
        // Helper
        function applyWeek(weekDays, assignments, sched) {
            assignments.forEach(([empId, hotel, shifts]) => {
                shifts.forEach((shift, i) => {
                    const dk = formatDate(weekDays[i]);
                    if (!sched[dk]) sched[dk] = {};
                    sched[dk][empId] = { hotel, shiftTypeId: shift };
                });
            });
        }

        const sched = {};
        const monday = getMonday(new Date());

        // ===== KW 16: 13.04-19.04 (FROM PDF - EXACT) =====
        const kw16 = getWeekDays(addDays(monday, 7));
        applyWeek(kw16, [
            // Hotel Julen (exact from PDF)
            ['e1','julen',['early','early','early','free','free','late','late']],
            ['e2','julen',['free','late','late','late','late','late','free']],
            ['e3','julen',['free','free','early','early','early','early','early']],
            ['e4','julen',['late','mid','mid','vacation','vacation','vacation','vacation']],
            ['e9','julen',['day','day','day','day','day','free','free']],
            ['e11','julen',['school','school','school','school','school','free','free']],
            // Hotel Alpenhof (exact from PDF)
            ['e5','alpenhof',['late','late','late','late','late','free','free']],
            ['e6','alpenhof',['late','free','free','late','late','late','late']],
            ['e7','alpenhof',['early','early','early','absent','absent','absent','absent']],
            ['e8','alpenhof',['free','free','early','early','early','early','early']],
            ['e10','alpenhof',['day','day','day','day','day','free','free']],
            ['e12','alpenhof',['school','school','school','school','school','free','free']],
            ['e11','alpenhof',['school','school','school','school','school','free','free']]
        ], sched);

        // ===== KW 15: 06.04-12.04 (CURRENT WEEK) =====
        const kw15 = getWeekDays(monday);
        applyWeek(kw15, [
            ['e1','julen',['early','early','early','free','free','late','late']],
            ['e2','julen',['free','late','late','late','late','late','free']],
            ['e3','julen',['free','free','early','early','early','early','early']],
            ['e4','julen',['late','mid','mid','late','late','mid','early']],
            ['e9','julen',['day','day','day','day','day','free','free']],
            ['e11','julen',['school','school','school','school','school','free','free']],
            ['e5','alpenhof',['late','late','late','late','late','free','free']],
            ['e6','alpenhof',['late','free','free','late','late','late','late']],
            ['e7','alpenhof',['early','early','early','early','early','free','free']],
            ['e8','alpenhof',['free','free','early','early','early','early','early']],
            ['e10','alpenhof',['day','day','day','day','day','free','free']],
            ['e12','alpenhof',['school','school','school','school','school','free','free']],
            ['e11','alpenhof',['school','school','school','school','school','free','free']]
        ], sched);

        // ===== KW 14: 30.03-05.04 (Fabian starts 01.04 = Mi) =====
        const kw14 = getWeekDays(addDays(monday, -7));
        applyWeek(kw14, [
            ['e1','julen',['early','early','early','free','free','late','late']],
            ['e2','julen',['free','late','late','late','late','late','free']],
            ['e3','julen',['absent','absent','early','early','early','early','early']],
            ['e4','julen',['late','late','mid','mid','late','free','free']],
            ['e9','julen',['day','day','day','day','day','free','free']],
            ['e11','julen',['school','school','school','school','school','free','free']],
            ['e5','alpenhof',['late','late','late','late','late','free','free']],
            ['e6','alpenhof',['late','late','free','free','late','late','late']],
            ['e7','alpenhof',['early','early','early','early','early','free','free']],
            ['e8','alpenhof',['free','free','early','early','early','early','early']],
            ['e10','alpenhof',['day','day','day','day','day','free','free']],
            ['e12','alpenhof',['school','school','school','school','school','free','free']],
            ['e11','alpenhof',['school','school','school','school','school','free','free']]
        ], sched);

        // ===== KW 13: 23.03-29.03 (Fabian not yet started) =====
        const kw13 = getWeekDays(addDays(monday, -14));
        applyWeek(kw13, [
            ['e1','julen',['free','free','early','early','early','late','late']],
            ['e2','julen',['late','late','late','late','late','free','free']],
            ['e4','julen',['mid','mid','late','late','free','free','mid']],
            ['e9','julen',['day','day','day','day','day','free','free']],
            ['e11','julen',['school','school','school','school','school','free','free']],
            ['e5','alpenhof',['late','late','late','late','late','free','free']],
            ['e6','alpenhof',['free','free','late','late','late','late','late']],
            ['e7','alpenhof',['early','early','early','early','early','free','free']],
            ['e8','alpenhof',['early','early','free','free','early','early','early']],
            ['e10','alpenhof',['day','day','day','day','day','free','free']],
            ['e12','alpenhof',['school','school','school','school','school','free','free']],
            ['e11','alpenhof',['school','school','school','school','school','free','free']]
        ], sched);

        // ===== KW 12: 16.03-22.03 (Fabian not yet started) =====
        const kw12 = getWeekDays(addDays(monday, -21));
        applyWeek(kw12, [
            ['e1','julen',['early','early','early','late','late','free','free']],
            ['e2','julen',['late','late','free','free','late','late','late']],
            ['e4','julen',['late','mid','late','late','free','free','mid']],
            ['e9','julen',['day','day','day','day','day','free','free']],
            ['e11','julen',['school','school','school','school','school','free','free']],
            ['e5','alpenhof',['late','late','late','late','late','free','free']],
            ['e6','alpenhof',['late','free','free','late','late','late','late']],
            ['e7','alpenhof',['early','early','early','early','free','free','early']],
            ['e8','alpenhof',['free','free','early','early','early','early','early']],
            ['e10','alpenhof',['day','day','day','day','day','free','free']],
            ['e12','alpenhof',['school','school','school','school','school','free','free']],
            ['e11','alpenhof',['school','school','school','school','school','free','free']]
        ], sched);

        // ===== KW 11: 09.03-15.03 (Fabian not yet started) =====
        const kw11 = getWeekDays(addDays(monday, -28));
        applyWeek(kw11, [
            ['e1','julen',['early','early','free','free','early','late','late']],
            ['e2','julen',['free','late','late','late','late','free','late']],
            ['e4','julen',['late','mid','mid','late','free','free','mid']],
            ['e9','julen',['day','day','day','day','day','free','free']],
            ['e11','julen',['school','school','school','school','school','free','free']],
            ['e5','alpenhof',['late','late','late','late','late','free','free']],
            ['e6','alpenhof',['late','late','free','free','late','late','late']],
            ['e7','alpenhof',['early','early','early','early','early','free','free']],
            ['e8','alpenhof',['free','free','early','early','early','early','early']],
            ['e10','alpenhof',['day','day','day','day','day','free','free']],
            ['e12','alpenhof',['school','school','school','school','school','free','free']],
            ['e11','alpenhof',['school','school','school','school','school','free','free']]
        ], sched);

        state.schedule = sched;

        // Absences
        // Rocio: Ferien KW 16 Do-So
        state.absences.push({ id: generateId(), employeeId: 'e4', type: 'vacation',
            startDate: formatDate(kw16[3]), endDate: formatDate(kw16[6]), note: 'Ferien' });
        // Lea: ausgetreten ab KW 16 Do
        state.absences.push({ id: generateId(), employeeId: 'e7', type: 'other',
            startDate: formatDate(kw16[3]), endDate: '2099-12-31', note: 'Ausgetreten' });
    }

    // ========== TOAST ==========
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    }

    // ========== MODAL ==========
    function openModal(title, bodyHTML, onSave, opts = {}) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-overlay').classList.remove('hidden');

        const saveBtn = document.getElementById('modal-save');
        const cancelBtn = document.getElementById('modal-cancel');

        if (opts.hideSave) {
            saveBtn.style.display = 'none';
        } else {
            saveBtn.style.display = '';
            saveBtn.textContent = opts.saveText || 'Speichern';
        }

        // Remove old listeners
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newSave.addEventListener('click', () => {
            if (onSave && onSave() !== false) {
                closeModal();
            }
        });
        newCancel.addEventListener('click', closeModal);
        document.getElementById('modal-close').onclick = closeModal;
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    // ========== NAVIGATION ==========
    function initNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                switchView(view);
            });
        });
    }

    function switchView(viewName) {
        state.currentView = viewName;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-view="${viewName}"]`).classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        if (viewName === 'schedule') renderSchedule();
        else if (viewName === 'employees') renderEmployees();
        else if (viewName === 'shifts') renderShifts();
        else if (viewName === 'absences') renderAbsences();
        else if (viewName === 'stats') renderStats();
        else if (viewName === 'settings') renderSettings();
        else if (viewName === 'vacation' && window.renderVacation) window.renderVacation();
        else if (viewName === 'rules' && window.renderRules) window.renderRules();
        else if (viewName === 'vacation-requests' && window.renderVacationRequests) window.renderVacationRequests();
        else if (viewName === 'gantt' && window.renderGantt) window.renderGantt();
        else if (viewName === 'portal' && window.renderPortal) window.renderPortal();
    }

    // ========== SCHEDULE VIEW ==========
    function initScheduleControls() {
        document.getElementById('btn-prev-week').addEventListener('click', () => {
            state.currentWeekStart = addDays(state.currentWeekStart, -7);
            renderSchedule();
        });
        document.getElementById('btn-next-week').addEventListener('click', () => {
            state.currentWeekStart = addDays(state.currentWeekStart, 7);
            renderSchedule();
        });
        document.getElementById('btn-today').addEventListener('click', () => {
            state.currentWeekStart = getMonday(new Date());
            renderSchedule();
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentHotelFilter = btn.dataset.hotel;
                renderSchedule();
            });
        });

        document.getElementById('btn-auto-fill').addEventListener('click', autoFillWeek);
        document.getElementById('btn-copy-week').addEventListener('click', copyWeek);
        document.getElementById('btn-undo').addEventListener('click', undo);

        // Week jump
        document.getElementById('week-jump').addEventListener('change', (e) => {
            const val = e.target.value; // format: "2026-W15"
            if (!val) return;
            const [year, wStr] = val.split('-W');
            const jan4 = new Date(parseInt(year), 0, 4);
            const dayOfWeek = jan4.getDay() || 7;
            const monday = new Date(jan4);
            monday.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(wStr) - 1) * 7);
            state.currentWeekStart = monday;
            renderSchedule();
        });
        document.getElementById('btn-export').addEventListener('click', exportPDF);
    }

    function renderSchedule() {
        const container = document.getElementById('schedule-container');
        const weekDays = getWeekDays(state.currentWeekStart);
        const kw = getWeekNumber(state.currentWeekStart);

        document.getElementById('week-title').textContent =
            `KW ${kw} | ${formatDateShort(weekDays[0])} - ${formatDateShort(weekDays[6])}.${weekDays[6].getFullYear()}`;

        // Sync week-jump input to current week
        const wj = document.getElementById('week-jump');
        if (wj) wj.value = `${weekDays[0].getFullYear()}-W${String(kw).padStart(2, '0')}`;

        let html = '';
        const hotelsToShow = state.currentHotelFilter === 'all'
            ? state.hotels
            : state.hotels.filter(h => h.id === state.currentHotelFilter);

        hotelsToShow.forEach(hotel => {
            const hotelEmployees = state.employees
                .filter(e => e.hotels.includes(hotel.id))
                .sort((a, b) => {
                    // excludeFromCoverage employees always at bottom
                    if (a.excludeFromCoverage && !b.excludeFromCoverage) return 1;
                    if (!a.excludeFromCoverage && b.excludeFromCoverage) return -1;
                    // Alphabetical within each group
                    return a.name.localeCompare(b.name);
                });
            html += renderHotelTable(hotel, hotelEmployees, weekDays);
        });

        container.innerHTML = html;
        renderWeekSummary(weekDays);

        // Attach click events to shift cells
        container.querySelectorAll('.shift-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const empId = cell.dataset.employee;
                const dateStr = cell.dataset.date;
                const hotel = cell.dataset.hotel;
                openShiftPicker(empId, dateStr, hotel);
            });
        });

        // Attach click events to add-employee buttons in table
        container.querySelectorAll('.btn-add-row').forEach(btn => {
            btn.addEventListener('click', () => {
                openQuickAddEmployee(btn.dataset.hotel);
            });
        });

        // Drag & drop for employee row reordering
        let dragSrcRow = null;
        container.querySelectorAll('.emp-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragSrcRow = row;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.dataset.empId);
            });
            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                container.querySelectorAll('.emp-row').forEach(r => r.classList.remove('drag-over'));
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                container.querySelectorAll('.emp-row').forEach(r => r.classList.remove('drag-over'));
                if (row !== dragSrcRow && row.dataset.hotel === dragSrcRow?.dataset.hotel) {
                    row.classList.add('drag-over');
                }
            });
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!dragSrcRow || row === dragSrcRow) return;
                if (row.dataset.hotel !== dragSrcRow.dataset.hotel) return;

                const srcId = dragSrcRow.dataset.empId;
                const tgtId = row.dataset.empId;
                const hotelId = row.dataset.hotel;

                // Get employees for this hotel sorted
                const hotelEmps = state.employees
                    .filter(emp => emp.hotels.includes(hotelId))
                    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

                const srcIdx = hotelEmps.findIndex(e => e.id === srcId);
                const tgtIdx = hotelEmps.findIndex(e => e.id === tgtId);
                if (srcIdx === -1 || tgtIdx === -1) return;

                // Move in array
                const [moved] = hotelEmps.splice(srcIdx, 1);
                hotelEmps.splice(tgtIdx, 0, moved);

                // Reassign order
                hotelEmps.forEach((emp, i) => { emp.order = i; });

                saveState();
                renderSchedule();
                showToast('Reihenfolge geaendert', 'success');
            });
        });

        // Remove employee from schedule buttons
        container.querySelectorAll('.btn-remove-emp').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const empId = btn.dataset.empId;
                const hotelId = btn.dataset.hotel;
                openRemoveEmployee(empId, hotelId);
            });
        });
    }

    // ========== REMOVE EMPLOYEE FROM SCHEDULE ==========
    function openRemoveEmployee(empId, hotelId) {
        const emp = state.employees.find(e => e.id === empId);
        const hotel = state.hotels.find(h => h.id === hotelId);
        if (!emp || !hotel) return;

        const weekDays = getWeekDays(state.currentWeekStart);
        const sundayStr = formatDate(weekDays[6]);

        let html = `
            <p style="margin-bottom:16px"><strong>${emp.name}</strong> vom Schichtplan entfernen (${hotel.name})</p>
            <div class="shift-picker">
                <div class="shift-option" data-remove="week">
                    <span class="dot" style="background:var(--warning)"></span>
                    <div class="shift-info">
                        <div class="shift-name">Nur diese Woche</div>
                        <div class="shift-hours">Entfernt alle Eintraege dieser Woche fuer ${hotel.name}</div>
                    </div>
                </div>
                <div class="shift-option" data-remove="until">
                    <span class="dot" style="background:var(--shift-mid)"></span>
                    <div class="shift-info">
                        <div class="shift-name">Bis zu einem Datum</div>
                        <div class="shift-hours">Mitarbeiter ist bis zum gewaehlten Datum abwesend</div>
                    </div>
                </div>
                <div class="shift-option" data-remove="permanent">
                    <span class="dot" style="background:var(--danger)"></span>
                    <div class="shift-info">
                        <div class="shift-name">Dauerhaft entfernen</div>
                        <div class="shift-hours">Mitarbeiter wird aus ${hotel.name} komplett entfernt</div>
                    </div>
                </div>
            </div>
            <div id="remove-date-picker" style="display:none;margin-top:16px">
                <div class="form-group">
                    <label>Abwesend bis (einschliesslich)</label>
                    <input type="date" id="remove-until-date" value="${sundayStr}">
                </div>
            </div>
        `;

        openModal('Mitarbeiter entfernen', html, () => {}, { hideSave: true });

        setTimeout(() => {
            document.querySelectorAll('[data-remove]').forEach(opt => {
                opt.addEventListener('click', () => {
                    const mode = opt.dataset.remove;

                    if (mode === 'until') {
                        // Show date picker, then confirm
                        const picker = document.getElementById('remove-date-picker');
                        if (picker.style.display === 'none') {
                            picker.style.display = '';
                            // Change this option to show "Bestaetigen" state
                            opt.querySelector('.shift-name').textContent = 'Datum waehlen und nochmal klicken';
                            return;
                        }
                        const untilDate = document.getElementById('remove-until-date').value;
                        if (!untilDate) { showToast('Bitte Datum waehlen', 'error'); return; }

                        // Add absence record
                        const startDate = formatDate(weekDays[0]);
                        state.absences.push({
                            id: generateId(),
                            employeeId: empId,
                            type: 'other',
                            startDate: startDate,
                            endDate: untilDate,
                            note: 'Vom Schichtplan entfernt bis ' + untilDate
                        });

                        // Clear schedule entries for this period
                        let d = parseDate(startDate);
                        const end = parseDate(untilDate);
                        while (d <= end) {
                            const ds = formatDate(d);
                            if (state.schedule[ds] && state.schedule[ds][empId]) {
                                const a = state.schedule[ds][empId];
                                if (a.hotel === hotelId) {
                                    state.schedule[ds][empId] = { hotel: hotelId, shiftTypeId: 'absent' };
                                }
                            }
                            d = addDays(d, 1);
                        }

                        saveState();
                        closeModal();
                        renderSchedule();
                        showToast(emp.name + ' abwesend bis ' + untilDate, 'info');

                    } else if (mode === 'week') {
                        // Mark absent for entire week at this hotel
                        weekDays.forEach(day => {
                            const ds = formatDate(day);
                            if (!state.schedule[ds]) state.schedule[ds] = {};
                            state.schedule[ds][empId] = { hotel: hotelId, shiftTypeId: 'absent' };
                        });
                        saveState();
                        closeModal();
                        renderSchedule();
                        showToast(emp.name + ' fuer diese Woche entfernt', 'info');

                    } else if (mode === 'permanent') {
                        // Remove hotel from employee
                        emp.hotels = emp.hotels.filter(h => h !== hotelId);
                        if (emp.hotels.length === 0) {
                            // No hotels left — remove employee entirely
                            state.employees = state.employees.filter(e => e.id !== empId);
                            Object.keys(state.schedule).forEach(ds => { delete state.schedule[ds][empId]; });
                            state.absences = state.absences.filter(a => a.employeeId !== empId);
                            showToast(emp.name + ' komplett entfernt', 'warning');
                        } else {
                            // Remove from this hotel's schedule
                            Object.keys(state.schedule).forEach(ds => {
                                const a = state.schedule[ds][empId];
                                if (a && a.hotel === hotelId) delete state.schedule[ds][empId];
                            });
                            showToast(emp.name + ' aus ' + hotel.name + ' entfernt', 'info');
                        }
                        saveState();
                        closeModal();
                        renderSchedule();
                    }
                });
            });
        }, 50);
    }

    function renderHotelTable(hotel, employees, weekDays) {
        const cssClass = hotel.id;
        let html = `
        <div class="hotel-section">
            <div class="hotel-section-header">
                <h3><span class="hotel-badge ${cssClass}"></span>${hotel.name}</h3>
                <span style="font-size:12px;color:var(--text-muted)">${employees.length} Mitarbeiter</span>
            </div>
            <table class="schedule-table">
                <thead><tr>
                    <th>Mitarbeiter</th>`;

        weekDays.forEach((day, i) => {
            const todayCls = isToday(day) ? ' today' : '';
            const holiday = getHoliday(day);
            const schoolHol = getSchoolHoliday(day);
            let dayExtra = '';
            let extraCls = todayCls;
            if (holiday) { dayExtra = `<span class="day-holiday">${holiday}</span>`; extraCls += ' holiday'; }
            if (schoolHol) { dayExtra += `<span class="day-school">Schulferien</span>`; }
            html += `<th class="${extraCls}">${DAY_NAMES[i]}<span class="day-date">${formatDateShort(day)}</span>${dayExtra}</th>`;
        });
        html += `<th>Std.</th></tr></thead><tbody>`;

        employees.forEach(emp => {
            const isDual = emp.hotels.length > 1;

            // Analyze the week for this employee at THIS hotel
            let hasShiftHere = false;
            let hasShiftOther = false;
            let allAbsentHere = true;

            weekDays.forEach(day => {
                const ds = formatDate(day);
                const a = (state.schedule[ds] || {})[emp.id];
                if (!a) { allAbsentHere = false; return; }
                if (a.hotel === hotel.id) {
                    if (a.shiftTypeId !== 'absent') allAbsentHere = false;
                    if (a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') hasShiftHere = true;
                } else if (a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                    hasShiftOther = true;
                }
            });

            // Hide if all absent here
            if (allAbsentHere) return;
            // Hide dual-hotel employee if no shifts anywhere this week
            if (isDual && !hasShiftHere && !hasShiftOther) {
                const hasAny = weekDays.some(d => { const a = (state.schedule[formatDate(d)] || {})[emp.id]; return a && a.hotel === hotel.id; });
                if (!hasAny) return;
            }

            let weekHours = 0;
            html += `<tr class="emp-row" draggable="true" data-emp-id="${emp.id}" data-hotel="${hotel.id}"><td><div class="employee-name-cell">
                <span class="drag-handle" title="Reihenfolge aendern">&#x2630;</span>
                <div class="avatar" style="background:${emp.color}">${getInitials(emp.name)}</div>
                ${emp.name}
                <button class="btn-remove-emp" data-emp-id="${emp.id}" data-hotel="${hotel.id}" title="Vom Schichtplan entfernen">&times;</button>
            </div></td>`;

            weekDays.forEach(day => {
                const dateStr = formatDate(day);
                const assignment = (state.schedule[dateStr] || {})[emp.id];
                const absence = getAbsenceForDate(emp.id, dateStr);

                // Dual-hotel: show placeholder if working at OTHER hotel this day
                if (isDual && assignment && assignment.hotel !== hotel.id &&
                    assignment.shiftTypeId !== 'free' && assignment.shiftTypeId !== 'vacation' &&
                    assignment.shiftTypeId !== 'sick' && assignment.shiftTypeId !== 'absent') {
                    const otherHotel = state.hotels.find(h => h.id === assignment.hotel);
                    const otherShift = state.shiftTypes.find(s => s.id === assignment.shiftTypeId);
                    const shortName = otherHotel ? otherHotel.name.replace('Hotel ', '') : '?';
                    const timeStr = otherShift ? `${otherShift.start}-${otherShift.end}` : '';
                    html += `<td><div class="shift-cell other-hotel" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotel.id}" title="Arbeitet im ${otherHotel ? otherHotel.name : '?'}">
                        <span class="shift-time">${shortName}</span>
                        <span class="shift-day-hours">${timeStr}</span>
                    </div></td>`;
                } else {
                    html += `<td>${renderShiftCell(emp, dateStr, hotel.id, assignment, absence)}</td>`;
                }

                // Count hours only for THIS hotel
                if (assignment && assignment.hotel === hotel.id &&
                    assignment.shiftTypeId !== 'free' && assignment.shiftTypeId !== 'vacation' &&
                    assignment.shiftTypeId !== 'sick' && assignment.shiftTypeId !== 'absent') {
                    const st = state.shiftTypes.find(s => s.id === assignment.shiftTypeId);
                    if (st) weekHours += calcShiftHours(st);
                    // Support split/double shifts (second shift stored as shiftTypeId2)
                    if (assignment.shiftTypeId2) {
                        const st2 = state.shiftTypes.find(s => s.id === assignment.shiftTypeId2);
                        if (st2) weekHours += calcShiftHours(st2);
                    }
                }
            });

            html += `<td class="hours-col">${weekHours.toFixed(1)}h</td></tr>`;
        });

        // Add employee row
        html += `<tr class="add-employee-row"><td colspan="${weekDays.length + 2}">
            <button class="btn-add-row" data-hotel="${hotel.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Mitarbeiter hinzufügen
            </button>
        </td></tr>`;

        // Coverage row
        html += `<tr class="coverage-row"><td style="font-size:11px;color:var(--text-dim)">Besetzung</td>`;
        weekDays.forEach(day => {
            const dateStr = formatDate(day);
            let count = 0;
            employees.forEach(emp => {
                if (emp.excludeFromCoverage) return;
                const a = (state.schedule[dateStr] || {})[emp.id];
                if (a && a.hotel === hotel.id && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                    count++;
                }
            });
            const cov = state.settings.minCoverage;
            const min = (typeof cov === 'object') ? (cov[hotel.id] || 2) : (cov || 2);
            const cls = count >= min ? 'coverage-good' : count > 0 ? 'coverage-warn' : 'coverage-bad';
            html += `<td class="${cls}">${count}/${min}</td>`;
        });
        html += `<td></td></tr>`;

        html += `</tbody></table></div>`;
        return html;
    }

    function renderShiftCell(emp, dateStr, hotelId, assignment, absence) {
        if (absence) {
            const label = absence.type === 'vacation' ? 'Ferien' : absence.type === 'sick' ? 'Krank' : 'Abwesend';
            const cls = absence.type === 'vacation' ? 'vacation' : absence.type === 'sick' ? 'absent' : 'absent';
            return `<div class="shift-cell ${cls}" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">
                <span class="shift-time">${label}</span></div>`;
        }

        if (!assignment || assignment.hotel !== hotelId) {
            return `<div class="shift-cell empty" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">+</div>`;
        }

        const sid = assignment.shiftTypeId;
        if (sid === 'free') {
            return `<div class="shift-cell free" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">
                <span class="shift-time">Frei</span></div>`;
        }
        if (sid === 'vacation') {
            return `<div class="shift-cell vacation" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">
                <span class="shift-time">Ferien</span></div>`;
        }
        if (sid === 'sick') {
            return `<div class="shift-cell absent" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}" style="background:var(--warning-bg);color:var(--warning);border-color:rgba(245,158,11,.2)">
                <span class="shift-time">Krank</span></div>`;
        }
        if (sid === 'absent') {
            return `<div class="shift-cell absent" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">
                <span class="shift-time">&mdash;</span></div>`;
        }

        const shiftType = state.shiftTypes.find(s => s.id === sid);
        if (!shiftType) {
            return `<div class="shift-cell empty" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">+</div>`;
        }

        // Check for shift inconsistency warning
        let warningDot = '';
        if (state.settings.warnShiftSwitch) {
            const weekDays = getWeekDays(state.currentWeekStart);
            const shifts = weekDays.map(d => {
                const a = (state.schedule[formatDate(d)] || {})[emp.id];
                return a && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent' ? a.shiftTypeId : null;
            }).filter(Boolean);
            const uniqueShifts = [...new Set(shifts)];
            if (uniqueShifts.length > 1) {
                warningDot = '<span class="warning-dot" title="Schichtwechsel in dieser Woche"></span>';
            }
        }

        // Check for split/double shift
        if (assignment.shiftTypeId2) {
            const st2 = state.shiftTypes.find(s => s.id === assignment.shiftTypeId2);
            if (st2) {
                const totalH = calcShiftHours(shiftType) + calcShiftHours(st2);
                return `<div class="shift-cell split-shift ${shiftType.cssClass}" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">
                    ${warningDot}
                    <span class="shift-time">${shiftType.start}-${shiftType.end}</span>
                    <span class="shift-time">${st2.start}-${st2.end}</span>
                    <span class="shift-day-hours">${totalH.toFixed(1)}h</span></div>`;
            }
        }

        const dayHours = calcShiftHours(shiftType);
        return `<div class="shift-cell ${shiftType.cssClass}" data-employee="${emp.id}" data-date="${dateStr}" data-hotel="${hotelId}">
            ${warningDot}
            <span class="shift-time">${shiftType.start}-${shiftType.end}</span>
            <span class="shift-day-hours">${dayHours.toFixed(1)}h</span></div>`;
    }

    function getAbsenceForDate(empId, dateStr) {
        return state.absences.find(a => {
            if (a.employeeId !== empId) return false;
            return dateStr >= a.startDate && dateStr <= a.endDate;
        });
    }

    function renderWeekSummary(weekDays) {
        const container = document.getElementById('week-summary');
        let totalShifts = 0;
        let totalHours = 0;
        let freeDays = 0;
        let vacationDays = 0;
        let shiftWarnings = 0;
        const complianceWarnings = [];

        state.employees.forEach(emp => {
            const shifts = [];
            let empWeekHours = 0;

            weekDays.forEach((day, i) => {
                const dateStr = formatDate(day);
                const a = (state.schedule[dateStr] || {})[emp.id];
                if (a) {
                    if (a.shiftTypeId === 'free') freeDays++;
                    else if (a.shiftTypeId === 'vacation') vacationDays++;
                    else if (a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                        totalShifts++;
                        const st = state.shiftTypes.find(s => s.id === a.shiftTypeId);
                        if (st) {
                            const h = calcShiftHours(st);
                            totalHours += h;
                            empWeekHours += h;
                        }
                        shifts.push(a.shiftTypeId);
                    }
                }

                // Check rest period (11h) between consecutive days
                if (i > 0) {
                    const prevDate = formatDate(weekDays[i - 1]);
                    const prevA = (state.schedule[prevDate] || {})[emp.id];
                    if (prevA && a && prevA.shiftTypeId !== 'free' && prevA.shiftTypeId !== 'vacation' && prevA.shiftTypeId !== 'sick' && prevA.shiftTypeId !== 'absent' &&
                        a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                        const prevShift = state.shiftTypes.find(s => s.id === prevA.shiftTypeId);
                        const currShift = state.shiftTypes.find(s => s.id === a.shiftTypeId);
                        if (prevShift && currShift) {
                            const [peh, pem] = prevShift.end.split(':').map(Number);
                            const [csh, csm] = currShift.start.split(':').map(Number);
                            const restHours = (csh * 60 + csm + 24 * 60 - peh * 60 - pem) / 60;
                            const minRest = state.settings.minRestHours || 11;
                            if (restHours < minRest) {
                                complianceWarnings.push(`${emp.name}: Nur ${restHours.toFixed(1)}h Ruhezeit ${DAY_NAMES[i-1]}→${DAY_NAMES[i]} (min. ${minRest}h)`);
                            }
                        }
                    }
                }
            });

            if (new Set(shifts).size > 1) shiftWarnings++;

            // Check weekly hours (CH max 45h)
            if (empWeekHours > 45) {
                complianceWarnings.push(`${emp.name}: ${empWeekHours.toFixed(1)}h/Woche (max. 45h CH-Arbeitsrecht)`);
            } else if (empWeekHours > 42) {
                complianceWarnings.push(`${emp.name}: ${empWeekHours.toFixed(1)}h/Woche (nahe am 45h-Limit)`);
            }
        });

        let warningHtml = '';
        if (complianceWarnings.length > 0) {
            warningHtml = `<div class="compliance-warnings">
                <div class="compliance-header">⚠ Compliance-Warnungen (${complianceWarnings.length})</div>
                ${complianceWarnings.map(w => `<div class="compliance-item">${w}</div>`).join('')}
            </div>`;
        }

        container.innerHTML = `
            ${warningHtml}
            <div class="summary-items">
                <div class="summary-item"><span class="label">Schichten</span><span class="value">${totalShifts}</span></div>
                <div class="summary-item"><span class="label">Stunden</span><span class="value">${totalHours.toFixed(0)}h</span></div>
                <div class="summary-item"><span class="label">Freie Tage</span><span class="value">${freeDays}</span></div>
                <div class="summary-item"><span class="label">Ferien</span><span class="value" style="color:var(--shift-vacation)">${vacationDays}</span></div>
                <div class="summary-item"><span class="label">Warnungen</span><span class="value" style="color:${(shiftWarnings + complianceWarnings.length) > 0 ? 'var(--danger)' : 'var(--success)'}">${shiftWarnings + complianceWarnings.length}</span></div>
            </div>
        `;
    }

    // ========== SHIFT PICKER ==========
    function openShiftPicker(empId, dateStr, hotelId) {
        const emp = state.employees.find(e => e.id === empId);
        const day = parseDate(dateStr);
        const dayIdx = (day.getDay() + 6) % 7;
        const current = (state.schedule[dateStr] || {})[empId];

        let html = `<p style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">
            ${emp.name} &mdash; ${DAY_NAMES_FULL[dayIdx]}, ${formatDateFull(dateStr)}</p>
            <div class="shift-picker">`;

        state.shiftTypes.forEach(st => {
            const sel = current && current.shiftTypeId === st.id ? 'selected' : '';
            const hours = calcShiftHours(st);
            html += `<div class="shift-option ${sel}" data-shift="${st.id}">
                <span class="dot" style="background:${st.color}"></span>
                <div class="shift-info">
                    <div class="shift-name">${st.name}</div>
                    <div class="shift-hours">${st.start} - ${st.end} (${hours.toFixed(1)}h)</div>
                </div></div>`;
        });

        // Special options
        const freeSel = current && current.shiftTypeId === 'free' ? 'selected' : '';
        html += `<div class="shift-option ${freeSel}" data-shift="free">
            <span class="dot" style="background:var(--success)"></span>
            <div class="shift-info"><div class="shift-name">Frei</div><div class="shift-hours">Freier Tag</div></div></div>`;

        const vacSel = current && current.shiftTypeId === 'vacation' ? 'selected' : '';
        html += `<div class="shift-option ${vacSel}" data-shift="vacation">
            <span class="dot" style="background:var(--danger)"></span>
            <div class="shift-info"><div class="shift-name">Ferien</div><div class="shift-hours">Urlaub / Ferien</div></div></div>`;

        const sickSel = current && current.shiftTypeId === 'sick' ? 'selected' : '';
        html += `<div class="shift-option ${sickSel}" data-shift="sick">
            <span class="dot" style="background:var(--warning)"></span>
            <div class="shift-info"><div class="shift-name">Krank</div><div class="shift-hours">Krankheitstag</div></div></div>`;

        const absSel = current && current.shiftTypeId === 'absent' ? 'selected' : '';
        html += `<div class="shift-option ${absSel}" data-shift="absent">
            <span class="dot" style="background:var(--shift-absent)"></span>
            <div class="shift-info"><div class="shift-name">Nicht verfügbar</div><div class="shift-hours">Abwesend / Kein Einsatz</div></div></div>`;

        html += `<div class="shift-option" data-shift="clear" style="border-color:var(--danger);opacity:.7">
            <span class="dot" style="background:transparent;border:1px dashed var(--danger)"></span>
            <div class="shift-info"><div class="shift-name" style="color:var(--danger)">Eintrag löschen</div></div></div>`;

        html += `</div>`;

        // Split shift option
        html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <p style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Doppelschicht (z.B. 07:00-12:00 + 18:00-23:00)</p>
            <div class="form-row">
                <div class="form-group">
                    <label>1. Schicht</label>
                    <select id="split-shift-1">
                        <option value="">--</option>
                        ${state.shiftTypes.map(s => `<option value="${s.id}">${s.name} (${s.start}-${s.end})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>2. Schicht</label>
                    <select id="split-shift-2">
                        <option value="">--</option>
                        ${state.shiftTypes.map(s => `<option value="${s.id}">${s.name} (${s.start}-${s.end})</option>`).join('')}
                    </select>
                </div>
            </div>
            <button class="btn-secondary" id="btn-apply-split" style="width:100%;justify-content:center;margin-top:4px">Doppelschicht zuweisen</button>
        </div>`;

        // Create new shift template button
        html += `<div style="margin-top:8px">
            <button class="btn-secondary" id="btn-new-shift-from-picker" style="width:100%;justify-content:center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Neue Schichtvorlage erstellen
            </button>
        </div>`;

        // Batch fill option
        html += `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
            <label class="checkbox-label" style="margin-bottom:8px">
                <input type="checkbox" id="fill-rest-of-week">
                Restliche Woche gleich füllen
            </label>
        </div>`;

        openModal(`Schicht zuweisen`, html, () => {
            // handled by click events below
        }, { hideSave: true });

        // Split shift + new template button handlers
        setTimeout(() => {
            const splitBtn = document.getElementById('btn-apply-split');
            if (splitBtn) {
                splitBtn.addEventListener('click', () => {
                    const s1 = document.getElementById('split-shift-1').value;
                    const s2 = document.getElementById('split-shift-2').value;
                    if (!s1 || !s2) { showToast('Beide Schichten waehlen', 'error'); return; }
                    if (!state.schedule[dateStr]) state.schedule[dateStr] = {};
                    state.schedule[dateStr][empId] = { hotel: hotelId, shiftTypeId: s1, shiftTypeId2: s2 };
                    saveState();
                    closeModal();
                    renderSchedule();
                    showToast('Doppelschicht zugewiesen', 'success');
                });
            }
            const newShiftBtn = document.getElementById('btn-new-shift-from-picker');
            if (newShiftBtn) {
                newShiftBtn.addEventListener('click', () => {
                    closeModal();
                    openShiftFormInline(empId, dateStr, hotelId);
                });
            }
        }, 50);

        // Click handlers
        document.querySelectorAll('.shift-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const shiftId = opt.dataset.shift;
                const fillWeek = document.getElementById('fill-rest-of-week').checked;

                if (fillWeek) {
                    const weekDays = getWeekDays(state.currentWeekStart);
                    const startIdx = weekDays.findIndex(d => formatDate(d) === dateStr);
                    for (let i = startIdx; i < 7; i++) {
                        applyShift(empId, formatDate(weekDays[i]), hotelId, shiftId);
                    }
                } else {
                    applyShift(empId, dateStr, hotelId, shiftId);
                }

                saveState();
                closeModal();
                renderSchedule();
                showToast('Schicht aktualisiert', 'success');
            });
        });
    }

    function applyShift(empId, dateStr, hotelId, shiftId) {
        if (!state.schedule[dateStr]) state.schedule[dateStr] = {};
        if (shiftId === 'clear') {
            delete state.schedule[dateStr][empId];
        } else {
            state.schedule[dateStr][empId] = { hotel: hotelId, shiftTypeId: shiftId };
        }
    }

    // ========== INLINE SHIFT TEMPLATE CREATION ==========
    function openShiftFormInline(empId, dateStr, hotelId) {
        const colors = ['#3b82f6','#a855f7','#f97316','#22c55e','#ec4899','#ef4444','#14b8a6','#f59e0b'];

        let html = `
            <p style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">Erstelle eine neue Schichtvorlage (z.B. halbe Schicht, Teildienst) und weise sie direkt zu.</p>
            <div class="form-group">
                <label>Bezeichnung</label>
                <input type="text" id="inline-shift-name" placeholder="z.B. Halbe Früh, Teildienst" autofocus>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Beginn</label>
                    <input type="time" id="inline-shift-start" value="07:00">
                </div>
                <div class="form-group">
                    <label>Ende</label>
                    <input type="time" id="inline-shift-end" value="12:00">
                </div>
            </div>
            <div class="form-group">
                <label>Farbe</label>
                <div class="color-picker-row">
                    ${colors.map((c, i) => `<div class="color-swatch ${i === 0 ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')}
                </div>
            </div>
            <label class="checkbox-label" style="margin-top:8px">
                <input type="checkbox" id="inline-shift-assign" checked>
                Direkt diesem Tag zuweisen
            </label>
        `;

        openModal('Neue Schichtvorlage erstellen', html, () => {
            const name = document.getElementById('inline-shift-name').value.trim();
            if (!name) { showToast('Name ist erforderlich', 'error'); return false; }
            const start = document.getElementById('inline-shift-start').value;
            const end = document.getElementById('inline-shift-end').value;
            if (!start || !end) { showToast('Zeiten sind erforderlich', 'error'); return false; }
            const selectedColor = document.querySelector('.color-swatch.selected');
            const color = selectedColor ? selectedColor.dataset.color : colors[0];

            const newId = generateId();
            state.shiftTypes.push({ id: newId, name, start, end, color, cssClass: 'custom' });

            if (document.getElementById('inline-shift-assign').checked) {
                applyShift(empId, dateStr, hotelId, newId);
            }

            saveState();
            renderSchedule();
            const hours = calcShiftHours({ start, end });
            showToast(`"${name}" erstellt (${hours.toFixed(1)}h)`, 'success');
        });

        setTimeout(() => {
            document.querySelectorAll('.color-swatch').forEach(sw => {
                sw.addEventListener('click', () => {
                    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                    sw.classList.add('selected');
                });
            });
        }, 50);
    }

    // ========== QUICK ADD EMPLOYEE (from schedule table) ==========
    function openQuickAddEmployee(hotelId) {
        const colors = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#6366f1','#ef4444','#06b6d4'];
        const hotel = state.hotels.find(h => h.id === hotelId);

        let html = `
            <div class="form-group">
                <label>Name</label>
                <input type="text" id="quick-emp-name" placeholder="Vor- und Nachname" autofocus>
            </div>
            <div class="form-group">
                <label>Hotels</label>
                <div class="checkbox-group">
                    ${state.hotels.map(h => `
                        <label class="checkbox-label">
                            <input type="checkbox" name="quick-emp-hotel" value="${h.id}" ${h.id === hotelId ? 'checked' : ''}>
                            ${h.name}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Max. Arbeitstage / Woche</label>
                    <input type="number" id="quick-emp-max-days" min="1" max="7" value="5">
                </div>
                <div class="form-group">
                    <label>Feste Schicht</label>
                    <select id="quick-emp-fixed-shift">
                        <option value="">Flexibel</option>
                        ${state.shiftTypes.map(s => `<option value="${s.id}">${s.name} (${s.start}-${s.end})</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Standard-Freitage</label>
                <div class="checkbox-group">
                    ${DAY_NAMES.map((d, i) => `
                        <label class="checkbox-label">
                            <input type="checkbox" name="quick-emp-free-day" value="${i}">
                            ${d}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;

        openModal(`Mitarbeiter hinzufügen (${hotel ? hotel.name : ''})`, html, () => {
            const name = document.getElementById('quick-emp-name').value.trim();
            if (!name) { showToast('Name ist erforderlich', 'error'); return false; }

            const hotels = [...document.querySelectorAll('input[name="quick-emp-hotel"]:checked')].map(c => c.value);
            if (hotels.length === 0) { showToast('Mindestens ein Hotel wählen', 'error'); return false; }

            const maxDays = parseInt(document.getElementById('quick-emp-max-days').value) || 5;
            const fixedShift = document.getElementById('quick-emp-fixed-shift').value || null;
            const defaultFreeDays = [...document.querySelectorAll('input[name="quick-emp-free-day"]:checked')].map(c => parseInt(c.value));
            const color = colors[state.employees.length % colors.length];

            state.employees.push({ id: generateId(), name, hotels, fixedShift, maxDays, defaultFreeDays, dayShifts: {}, color });
            saveState();
            renderSchedule();
            showToast(`${name} hinzugefügt`, 'success');
        });
    }

    // ========== AUTO-FILL ==========
    function autoFillWeek() {
        const weekDays = getWeekDays(state.currentWeekStart);

        state.hotels.forEach(hotel => {
            const hotelEmployees = state.employees.filter(e => e.hotels.includes(hotel.id));

            hotelEmployees.forEach(emp => {
                // Check if already has assignments this week
                const existingShifts = weekDays.map(d => (state.schedule[formatDate(d)] || {})[emp.id]).filter(Boolean);
                if (existingShifts.length >= 5) return; // already mostly filled

                // Determine preferred shift
                let preferredShift = emp.fixedShift;
                if (!preferredShift) {
                    // Check last week for consistency
                    const lastWeek = getWeekDays(addDays(state.currentWeekStart, -7));
                    const lastShifts = lastWeek.map(d => {
                        const a = (state.schedule[formatDate(d)] || {})[emp.id];
                        return a && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent' ? a.shiftTypeId : null;
                    }).filter(Boolean);

                    if (lastShifts.length > 0) {
                        // Use most common shift from last week
                        const counts = {};
                        lastShifts.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
                        preferredShift = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
                    } else {
                        preferredShift = state.shiftTypes[0]?.id || 'early';
                    }
                }

                const maxDays = emp.maxDays || state.settings.maxDaysPerWeek;
                const empFreeDays = emp.defaultFreeDays || [];
                let assigned = 0;

                // First: count existing work assignments
                weekDays.forEach((day, i) => {
                    const dateStr = formatDate(day);
                    const existing = (state.schedule[dateStr] || {})[emp.id];
                    if (existing && existing.shiftTypeId !== 'free' && existing.shiftTypeId !== 'vacation' && existing.shiftTypeId !== 'sick' && existing.shiftTypeId !== 'absent') {
                        assigned++;
                    }
                });

                const empDayShifts = emp.dayShifts || {};

                // Second: fill empty days, respecting default free days + dayShifts
                weekDays.forEach((day, i) => {
                    const dateStr = formatDate(day);
                    const absence = getAbsenceForDate(emp.id, dateStr);
                    if (absence) return;

                    const existing = (state.schedule[dateStr] || {})[emp.id];
                    if (existing) return;

                    // Default free day for this employee
                    if (empFreeDays.includes(i)) {
                        applyShift(emp.id, dateStr, hotel.id, 'free');
                        return;
                    }

                    if (assigned >= maxDays) {
                        applyShift(emp.id, dateStr, hotel.id, 'free');
                    } else {
                        // Use day-specific shift if set, otherwise preferred
                        const shiftForDay = empDayShifts[i] || preferredShift;
                        applyShift(emp.id, dateStr, hotel.id, shiftForDay);
                        assigned++;
                    }
                });
            });
        });

        // === OPTIMIZATION PASS ===
        // Ensure each hotel has at least 1 early + 1 late shift per day
        // Mid shift only used if 3+ employees are working that day
        state.hotels.forEach(hotel => {
            const hotelEmployees = state.employees.filter(e => e.hotels.includes(hotel.id));
            const earlyId = state.shiftTypes.find(s => s.cssClass === 'early')?.id;
            const lateId = state.shiftTypes.find(s => s.cssClass === 'late')?.id;
            const midId = state.shiftTypes.find(s => s.cssClass === 'mid')?.id;

            if (!earlyId || !lateId) return;

            weekDays.forEach((day, i) => {
                const dateStr = formatDate(day);
                // Collect working employees for this hotel/day
                const working = [];
                hotelEmployees.forEach(emp => {
                    const a = (state.schedule[dateStr] || {})[emp.id];
                    if (a && a.hotel === hotel.id && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                        working.push({ emp, assignment: a });
                    }
                });

                if (working.length === 0) return;

                const hasEarly = working.some(w => w.assignment.shiftTypeId === earlyId);
                const hasLate = working.some(w => w.assignment.shiftTypeId === lateId);

                // If no early shift, reassign one flexible employee
                if (!hasEarly && working.length >= 1) {
                    const candidate = working.find(w => {
                        const ds = w.emp.dayShifts || {};
                        return !ds[i] && !w.emp.fixedShift;
                    });
                    if (candidate) {
                        state.schedule[dateStr][candidate.emp.id].shiftTypeId = earlyId;
                    }
                }

                // If no late shift, reassign one flexible employee
                if (!hasLate && working.length >= 2) {
                    const updatedWorking = [];
                    hotelEmployees.forEach(emp => {
                        const a = (state.schedule[dateStr] || {})[emp.id];
                        if (a && a.hotel === hotel.id && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                            updatedWorking.push({ emp, assignment: a });
                        }
                    });
                    const candidate = updatedWorking.find(w => {
                        const ds = w.emp.dayShifts || {};
                        return !ds[i] && !w.emp.fixedShift && w.assignment.shiftTypeId !== earlyId;
                    });
                    if (candidate) {
                        state.schedule[dateStr][candidate.emp.id].shiftTypeId = lateId;
                    }
                }

                // Mid shift: only if 3+ employees working and someone doesn't have fixed day-shift
                if (midId && working.length >= 3) {
                    const midCandidates = working.filter(w => {
                        const ds = w.emp.dayShifts || {};
                        return !ds[i] && !w.emp.fixedShift && w.assignment.shiftTypeId !== earlyId && w.assignment.shiftTypeId !== lateId;
                    });
                    // Only assign mid if there's someone left after early+late
                    if (midCandidates.length > 0) {
                        const current = (state.schedule[dateStr] || {})[midCandidates[0].emp.id];
                        if (current && current.shiftTypeId !== earlyId && current.shiftTypeId !== lateId) {
                            state.schedule[dateStr][midCandidates[0].emp.id].shiftTypeId = midId;
                        }
                    }
                }
            });
        });

        // === EMERGENCY PASS: Move dual-hotel employees to understaffed hotel ===
        weekDays.forEach((day, i) => {
            const dateStr = formatDate(day);
            state.hotels.forEach(hotel => {
                const covObj = state.settings.minCoverage;
                const minCov = (typeof covObj === 'object') ? (covObj[hotel.id] || 2) : (covObj || 2);

                // Count working employees at this hotel today
                const hotelEmps = state.employees.filter(e => e.hotels.includes(hotel.id));
                let working = 0;
                hotelEmps.forEach(emp => {
                    const a = (state.schedule[dateStr] || {})[emp.id];
                    if (a && a.hotel === hotel.id && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                        working++;
                    }
                });

                if (working < minCov) {
                    // Find dual-hotel employees working at the OTHER hotel who could help
                    const otherHotels = state.hotels.filter(h => h.id !== hotel.id);
                    for (const otherHotel of otherHotels) {
                        if (working >= minCov) break;
                        const dualEmps = state.employees.filter(e =>
                            e.hotels.includes(hotel.id) && e.hotels.includes(otherHotel.id)
                        );
                        for (const emp of dualEmps) {
                            if (working >= minCov) break;
                            const a = (state.schedule[dateStr] || {})[emp.id];
                            if (!a || a.hotel !== otherHotel.id) continue;
                            if (a.shiftTypeId === 'free' || a.shiftTypeId === 'vacation' || a.shiftTypeId === 'sick' || a.shiftTypeId === 'absent') continue;

                            // Check if the other hotel would still have enough coverage
                            let otherWorking = 0;
                            state.employees.filter(e => e.hotels.includes(otherHotel.id)).forEach(e => {
                                const oa = (state.schedule[dateStr] || {})[e.id];
                                if (oa && oa.hotel === otherHotel.id && oa.shiftTypeId !== 'free' && oa.shiftTypeId !== 'vacation' && oa.shiftTypeId !== 'sick' && oa.shiftTypeId !== 'absent') {
                                    otherWorking++;
                                }
                            });
                            const otherMin = (typeof covObj === 'object') ? (covObj[otherHotel.id] || 2) : (covObj || 2);

                            // Only move if the other hotel has MORE than minimum
                            if (otherWorking > otherMin) {
                                state.schedule[dateStr][emp.id] = { hotel: hotel.id, shiftTypeId: a.shiftTypeId };
                                working++;
                            }
                        }
                    }
                }
            });
        });

        saveState();
        renderSchedule();
        showToast('Woche automatisch gefüllt & optimiert', 'success');
    }

    // ========== COPY WEEK ==========
    function copyWeek() {
        const options = `
            <p style="margin-bottom:16px;font-size:13px;color:var(--text-muted)">Wohin soll der aktuelle Wochenplan kopiert werden?</p>
            <div class="shift-picker">
                <div class="shift-option" data-copy="to-next">
                    <span class="dot" style="background:var(--primary)"></span>
                    <div class="shift-info">
                        <div class="shift-name">Aktuelle Woche → Nächste Woche</div>
                        <div class="shift-hours">Kopiert den aktuellen Plan in die nächste Woche</div>
                    </div>
                </div>
                <div class="shift-option" data-copy="from-prev">
                    <span class="dot" style="background:var(--success)"></span>
                    <div class="shift-info">
                        <div class="shift-name">Vorherige Woche → Aktuelle Woche</div>
                        <div class="shift-hours">Übernimmt den Plan der letzten Woche</div>
                    </div>
                </div>
            </div>
        `;

        openModal('Woche kopieren', options, () => {}, { hideSave: true });

        setTimeout(() => {
            document.querySelectorAll('[data-copy]').forEach(opt => {
                opt.addEventListener('click', () => {
                    const mode = opt.dataset.copy;
                    if (mode === 'to-next') {
                        copyWeekToNext();
                    } else {
                        copyWeekFromPrev();
                    }
                    closeModal();
                });
            });
        }, 50);
    }

    function copyWeekToNext() {
        const weekDays = getWeekDays(state.currentWeekStart);
        const nextWeekDays = getWeekDays(addDays(state.currentWeekStart, 7));

        weekDays.forEach((day, i) => {
            const srcDate = formatDate(day);
            const destDate = formatDate(nextWeekDays[i]);
            if (state.schedule[srcDate]) {
                state.schedule[destDate] = JSON.parse(JSON.stringify(state.schedule[srcDate]));
            }
        });

        saveState();
        state.currentWeekStart = addDays(state.currentWeekStart, 7);
        renderSchedule();
        showToast('Woche kopiert nach KW ' + getWeekNumber(state.currentWeekStart), 'success');
    }

    function copyWeekFromPrev() {
        const prevWeekDays = getWeekDays(addDays(state.currentWeekStart, -7));
        const weekDays = getWeekDays(state.currentWeekStart);

        prevWeekDays.forEach((day, i) => {
            const srcDate = formatDate(day);
            const destDate = formatDate(weekDays[i]);
            if (state.schedule[srcDate]) {
                state.schedule[destDate] = JSON.parse(JSON.stringify(state.schedule[srcDate]));
            }
        });

        saveState();
        renderSchedule();
        showToast('Plan von Vorwoche übernommen', 'success');
    }

    // ========== EMPLOYEES VIEW ==========
    function renderEmployees() {
        const container = document.getElementById('employees-list');
        let html = '';

        const sortedEmps = [...state.employees].sort((a, b) => {
            if (a.excludeFromCoverage && !b.excludeFromCoverage) return 1;
            if (!a.excludeFromCoverage && b.excludeFromCoverage) return -1;
            return a.name.localeCompare(b.name);
        });
        sortedEmps.forEach(emp => {
            const hotelTags = emp.hotels.map(hid => {
                const h = state.hotels.find(x => x.id === hid);
                return `<span class="tag ${hid}">${h ? h.name : hid}</span>`;
            }).join('');

            const fixedShift = emp.fixedShift
                ? state.shiftTypes.find(s => s.id === emp.fixedShift)
                : null;

            html += `<div class="card">
                <div class="card-header">
                    <h4><div class="avatar" style="background:${emp.color}">${getInitials(emp.name)}</div>${emp.name}</h4>
                    <div class="card-actions">
                        <button class="btn-xs" onclick="window.app.editEmployee('${emp.id}')">Bearbeiten</button>
                        <button class="btn-xs" style="color:var(--danger)" onclick="window.app.deleteEmployee('${emp.id}')">Löschen</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-tags">${hotelTags}</div>
                    <div class="card-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Max. ${emp.maxDays} Tage/Woche
                    </div>
                    ${fixedShift ? `<div class="card-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        Feste Schicht: ${fixedShift.name} (${fixedShift.start}-${fixedShift.end})
                    </div>` : `<div class="card-info" style="color:var(--text-dim)">Flexible Schichten</div>`}
                    <div class="card-info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Frei: ${emp.defaultFreeDays && emp.defaultFreeDays.length > 0 ? emp.defaultFreeDays.map(d => DAY_NAMES[d]).join(', ') : 'Nicht festgelegt'}
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    }

    function openEmployeeForm(emp = null) {
        const isEdit = !!emp;
        const title = isEdit ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter';

        const colors = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316','#6366f1','#ef4444','#06b6d4'];

        let html = `
            <div class="form-row">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="emp-name" value="${emp ? emp.name : ''}" placeholder="Vor- und Nachname">
                </div>
                <div class="form-group">
                    <label>Position</label>
                    <input type="text" id="emp-position" value="${emp ? (emp.position || '') : ''}" placeholder="z.B. Front Office Agent">
                </div>
            </div>
            <div class="form-group">
                <label>Hotels</label>
                <div class="checkbox-group">
                    ${state.hotels.map(h => `
                        <label class="checkbox-label">
                            <input type="checkbox" name="emp-hotel" value="${h.id}" ${emp && emp.hotels.includes(h.id) ? 'checked' : ''}>
                            ${h.name}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Max. Arbeitstage / Woche</label>
                    <input type="number" id="emp-max-days" min="1" max="7" value="${emp ? emp.maxDays : 5}">
                </div>
                <div class="form-group">
                    <label>Feste Schicht</label>
                    <select id="emp-fixed-shift">
                        <option value="">Flexibel</option>
                        ${state.shiftTypes.map(s => `<option value="${s.id}" ${emp && emp.fixedShift === s.id ? 'selected' : ''}>${s.name} (${s.start}-${s.end})</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Standard-Freitage</label>
                <p style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Tage, an denen dieser Mitarbeiter normalerweise frei hat</p>
                <div class="checkbox-group">
                    ${DAY_NAMES.map((d, i) => `
                        <label class="checkbox-label">
                            <input type="checkbox" name="emp-free-day" value="${i}" ${emp && emp.defaultFreeDays && emp.defaultFreeDays.includes(i) ? 'checked' : ''}>
                            ${d}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="form-group">
                <label>Feste Schicht pro Wochentag</label>
                <p style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Optional: Welche Schicht an welchem Tag (leer = flexibel)</p>
                <div class="day-shift-grid">
                    ${DAY_NAMES.map((d, i) => {
                        const currentDayShift = emp && emp.dayShifts ? (emp.dayShifts[i] || '') : '';
                        return `<div class="day-shift-row">
                            <span class="day-shift-label">${d}</span>
                            <select name="emp-day-shift" data-day="${i}">
                                <option value="">— flexibel —</option>
                                ${state.shiftTypes.map(s => `<option value="${s.id}" ${currentDayShift === s.id ? 'selected' : ''}>${s.name} (${s.start}-${s.end})</option>`).join('')}
                            </select>
                        </div>`;
                    }).join('')}
                </div>
            </div>
            <div class="form-group">
                <label>Farbe</label>
                <div class="color-picker-row">
                    ${colors.map(c => `<div class="color-swatch ${emp && emp.color === c ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')}
                </div>
            </div>
        `;

        openModal(title, html, () => {
            const name = document.getElementById('emp-name').value.trim();
            if (!name) { showToast('Name ist erforderlich', 'error'); return false; }
            const position = document.getElementById('emp-position').value.trim();

            const hotels = [...document.querySelectorAll('input[name="emp-hotel"]:checked')].map(c => c.value);
            if (hotels.length === 0) { showToast('Mindestens ein Hotel wählen', 'error'); return false; }

            const maxDays = parseInt(document.getElementById('emp-max-days').value) || 5;
            const fixedShift = document.getElementById('emp-fixed-shift').value || null;
            const defaultFreeDays = [...document.querySelectorAll('input[name="emp-free-day"]:checked')].map(c => parseInt(c.value));
            const dayShifts = {};
            document.querySelectorAll('select[name="emp-day-shift"]').forEach(sel => {
                const day = parseInt(sel.dataset.day);
                if (sel.value) dayShifts[day] = sel.value;
            });
            const selectedColor = document.querySelector('.color-swatch.selected');
            const color = selectedColor ? selectedColor.dataset.color : colors[Math.floor(Math.random() * colors.length)];

            if (isEdit) {
                emp.name = name;
                emp.position = position;
                emp.hotels = hotels;
                emp.maxDays = maxDays;
                emp.fixedShift = fixedShift;
                emp.defaultFreeDays = defaultFreeDays;
                emp.dayShifts = dayShifts;
                emp.color = color;
            } else {
                state.employees.push({ id: generateId(), name, position, hotels, fixedShift, maxDays, defaultFreeDays, dayShifts, color });
            }

            saveState();
            renderEmployees();
            showToast(isEdit ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter hinzugefügt', 'success');
        });

        // Color swatch click
        setTimeout(() => {
            document.querySelectorAll('.color-swatch').forEach(sw => {
                sw.addEventListener('click', () => {
                    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                    sw.classList.add('selected');
                });
            });
        }, 50);
    }

    function deleteEmployee(id) {
        const emp = state.employees.find(e => e.id === id);
        if (!emp) return;
        openModal('Mitarbeiter löschen', `<p>Soll <strong>${emp.name}</strong> wirklich gelöscht werden?</p><p style="color:var(--text-muted);font-size:12px;margin-top:8px">Alle zugewiesenen Schichten werden ebenfalls entfernt.</p>`, () => {
            state.employees = state.employees.filter(e => e.id !== id);
            // Clean schedule
            Object.keys(state.schedule).forEach(date => {
                delete state.schedule[date][id];
            });
            state.absences = state.absences.filter(a => a.employeeId !== id);
            saveState();
            renderEmployees();
            showToast('Mitarbeiter gelöscht', 'info');
        }, { saveText: 'Löschen' });
    }

    // ========== SHIFTS VIEW ==========
    function renderShifts() {
        const container = document.getElementById('shifts-list');
        let html = '';

        state.shiftTypes.forEach(st => {
            const hours = calcShiftHours(st);
            html += `<div class="card">
                <div class="shift-type-preview" style="background:${st.color}15;border:1px solid ${st.color}30">
                    <div>
                        <div class="time" style="color:${st.color}">${st.start} - ${st.end}</div>
                        <div class="duration">${calcShiftHoursGross(st).toFixed(1)}h brutto | ${hours.toFixed(1)}h netto | ${st.breakMin || 0} Min. Pause</div>
                    </div>
                </div>
                <div class="card-header">
                    <h4 style="color:${st.color}">${st.name}</h4>
                    <div class="card-actions">
                        <button class="btn-xs" onclick="window.app.editShift('${st.id}')">Bearbeiten</button>
                        <button class="btn-xs" style="color:var(--danger)" onclick="window.app.deleteShift('${st.id}')">Löschen</button>
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    }

    function openShiftForm(shift = null) {
        const isEdit = !!shift;
        const colors = ['#3b82f6','#a855f7','#f97316','#22c55e','#ec4899','#ef4444','#14b8a6','#f59e0b'];
        const cssClasses = ['early','late','mid','custom'];

        let html = `
            <div class="form-group">
                <label>Bezeichnung</label>
                <input type="text" id="shift-name" value="${shift ? shift.name : ''}" placeholder="z.B. Frühschicht">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Beginn</label>
                    <input type="time" id="shift-start" value="${shift ? shift.start : '07:00'}">
                </div>
                <div class="form-group">
                    <label>Ende</label>
                    <input type="time" id="shift-end" value="${shift ? shift.end : '16:30'}">
                </div>
            </div>
            <div class="form-group">
                <label>Pause (Minuten)</label>
                <input type="number" id="shift-break" min="0" max="120" value="${shift ? (shift.breakMin || 0) : 60}" placeholder="z.B. 60">
            </div>
            <div class="form-group">
                <label>Farbe</label>
                <div class="color-picker-row">
                    ${colors.map(c => `<div class="color-swatch ${shift && shift.color === c ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')}
                </div>
            </div>
        `;

        openModal(isEdit ? 'Schichttyp bearbeiten' : 'Neuer Schichttyp', html, () => {
            const name = document.getElementById('shift-name').value.trim();
            if (!name) { showToast('Name ist erforderlich', 'error'); return false; }
            const start = document.getElementById('shift-start').value;
            const end = document.getElementById('shift-end').value;
            if (!start || !end) { showToast('Zeiten sind erforderlich', 'error'); return false; }
            const breakMin = parseInt(document.getElementById('shift-break').value) || 0;
            const selectedColor = document.querySelector('.color-swatch.selected');
            const color = selectedColor ? selectedColor.dataset.color : colors[0];

            if (isEdit) {
                shift.name = name;
                shift.start = start;
                shift.end = end;
                shift.breakMin = breakMin;
                shift.color = color;
            } else {
                state.shiftTypes.push({ id: generateId(), name, start, end, breakMin, color, cssClass: 'custom' });
            }

            saveState();
            renderShifts();
            showToast(isEdit ? 'Schichttyp aktualisiert' : 'Schichttyp hinzugefügt', 'success');
        });

        setTimeout(() => {
            document.querySelectorAll('.color-swatch').forEach(sw => {
                sw.addEventListener('click', () => {
                    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                    sw.classList.add('selected');
                });
            });
        }, 50);
    }

    function deleteShift(id) {
        openModal('Schichttyp löschen', '<p>Soll dieser Schichttyp wirklich gelöscht werden?</p>', () => {
            state.shiftTypes = state.shiftTypes.filter(s => s.id !== id);
            saveState();
            renderShifts();
            showToast('Schichttyp gelöscht', 'info');
        }, { saveText: 'Löschen' });
    }

    // ========== ABSENCES VIEW ==========
    function renderAbsences() {
        const container = document.getElementById('absences-list');
        if (state.absences.length === 0) {
            container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim)">Keine Abwesenheiten eingetragen</div>';
            return;
        }

        let html = `<table class="data-table">
            <thead><tr><th>Mitarbeiter</th><th>Typ</th><th>Von</th><th>Bis</th><th>Notiz</th><th></th></tr></thead><tbody>`;

        state.absences.sort((a, b) => a.startDate.localeCompare(b.startDate));
        state.absences.forEach(abs => {
            const emp = state.employees.find(e => e.id === abs.employeeId);
            const typeCls = abs.type === 'vacation' ? 'vacation' : abs.type === 'sick' ? 'sick' : 'other';
            const typeLabel = abs.type === 'vacation' ? 'Ferien' : abs.type === 'sick' ? 'Krank' : 'Sonstiges';

            html += `<tr>
                <td>${emp ? emp.name : '?'}</td>
                <td><span class="absence-type ${typeCls}">${typeLabel}</span></td>
                <td>${formatDateFull(abs.startDate)}</td>
                <td>${formatDateFull(abs.endDate)}</td>
                <td style="color:var(--text-muted)">${abs.note || '-'}</td>
                <td style="white-space:nowrap">
                    <button class="btn-xs" onclick="window.app.editAbsence('${abs.id}')">Bearbeiten</button>
                    <button class="btn-xs" style="color:var(--danger)" onclick="window.app.deleteAbsence('${abs.id}')">Löschen</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function openAbsenceForm(existing) {
        const isEdit = !!existing;
        const title = isEdit ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen';

        let html = `
            <div class="form-group">
                <label>Mitarbeiter</label>
                <select id="abs-employee" ${isEdit ? 'disabled' : ''}>
                    ${state.employees.map(e => `<option value="${e.id}" ${existing && existing.employeeId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Typ</label>
                <select id="abs-type">
                    <option value="vacation" ${existing && existing.type === 'vacation' ? 'selected' : ''}>Ferien / Urlaub</option>
                    <option value="sick" ${existing && existing.type === 'sick' ? 'selected' : ''}>Krank</option>
                    <option value="other" ${existing && existing.type === 'other' ? 'selected' : ''}>Sonstiges</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Von</label>
                    <input type="date" id="abs-start" value="${existing ? existing.startDate : ''}">
                </div>
                <div class="form-group">
                    <label>Bis</label>
                    <input type="date" id="abs-end" value="${existing ? existing.endDate : ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Notiz (optional)</label>
                <input type="text" id="abs-note" value="${existing ? (existing.note || '') : ''}" placeholder="z.B. Arzttermin">
            </div>
        `;

        openModal(title, html, () => {
            const employeeId = document.getElementById('abs-employee').value;
            const type = document.getElementById('abs-type').value;
            const startDate = document.getElementById('abs-start').value;
            const endDate = document.getElementById('abs-end').value;
            const note = document.getElementById('abs-note').value.trim();

            if (!startDate || !endDate) { showToast('Datum ist erforderlich', 'error'); return false; }
            if (startDate > endDate) { showToast('Enddatum muss nach Startdatum sein', 'error'); return false; }

            if (isEdit) {
                // Clear old schedule entries
                let od = parseDate(existing.startDate);
                const oEnd = parseDate(existing.endDate);
                while (od <= oEnd) {
                    const ds = formatDate(od);
                    if (state.schedule[ds] && state.schedule[ds][existing.employeeId]) {
                        const a = state.schedule[ds][existing.employeeId];
                        if (a.shiftTypeId === 'vacation' || a.shiftTypeId === 'absent' || a.shiftTypeId === 'sick') {
                            delete state.schedule[ds][existing.employeeId];
                        }
                    }
                    od = addDays(od, 1);
                }
                // Update record
                existing.type = type;
                existing.startDate = startDate;
                existing.endDate = endDate;
                existing.note = note;
            } else {
                state.absences.push({ id: generateId(), employeeId, type, startDate, endDate, note });
            }

            // Mark in schedule
            let d = parseDate(startDate);
            const end = parseDate(endDate);
            const shiftId = type === 'vacation' ? 'vacation' : type === 'sick' ? 'sick' : 'absent';
            while (d <= end) {
                const dateStr = formatDate(d);
                if (!state.schedule[dateStr]) state.schedule[dateStr] = {};
                const emp = state.employees.find(e => e.id === employeeId);
                const hotel = emp ? emp.hotels[0] : 'julen';
                state.schedule[dateStr][employeeId] = { hotel, shiftTypeId: shiftId };
                d = addDays(d, 1);
            }

            saveState();
            renderAbsences();
            showToast(isEdit ? 'Abwesenheit aktualisiert' : 'Abwesenheit eingetragen', 'success');
        });
    }

    function deleteAbsence(id) {
        const absence = state.absences.find(a => a.id === id);
        if (absence) {
            // Clean schedule entries for this absence period
            let d = parseDate(absence.startDate);
            const end = parseDate(absence.endDate);
            while (d <= end) {
                const ds = formatDate(d);
                if (state.schedule[ds] && state.schedule[ds][absence.employeeId]) {
                    const a = state.schedule[ds][absence.employeeId];
                    if (a.shiftTypeId === 'vacation' || a.shiftTypeId === 'sick' || a.shiftTypeId === 'absent') {
                        delete state.schedule[ds][absence.employeeId];
                    }
                }
                d = addDays(d, 1);
            }
        }
        state.absences = state.absences.filter(a => a.id !== id);
        saveState();
        renderAbsences();
        showToast('Abwesenheit gelöscht', 'info');
    }

    // ========== STATS VIEW ==========
    let statsPeriod = 'week';

    function getStatsDays() {
        const now = new Date();
        const monday = getMonday(state.currentWeekStart);
        if (statsPeriod === 'week') {
            return getWeekDays(monday);
        } else if (statsPeriod === 'prev-week') {
            return getWeekDays(addDays(monday, -7));
        } else if (statsPeriod === 'next-week') {
            return getWeekDays(addDays(monday, 7));
        } else if (statsPeriod === 'prev-month' || statsPeriod === 'next-month' || statsPeriod === 'month') {
            let year = now.getFullYear(), month = now.getMonth();
            if (statsPeriod === 'prev-month') month--;
            else if (statsPeriod === 'next-month') month++;
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0);
            const days = [];
            let d = new Date(start);
            while (d <= end) { days.push(new Date(d)); d = addDays(d, 1); }
            return days;
        } else if (statsPeriod === 'custom') {
            const from = document.getElementById('stats-date-from')?.value;
            const to = document.getElementById('stats-date-to')?.value;
            if (!from || !to) return getWeekDays(monday);
            const days = [];
            let d = parseDate(from);
            const end = parseDate(to);
            while (d <= end) { days.push(new Date(d)); d = addDays(d, 1); }
            return days;
        }
        return getWeekDays(monday);
    }

    function initStatsControls() {
        document.getElementById('stats-period-btns').addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            const period = btn.dataset.period;

            document.querySelectorAll('#stats-period-btns .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const customRange = document.getElementById('stats-custom-range');
            if (period === 'custom') {
                customRange.style.display = '';
            } else {
                customRange.style.display = 'none';
                statsPeriod = period;
                renderStats();
            }
        });

        document.getElementById('stats-apply-range').addEventListener('click', () => {
            statsPeriod = 'custom';
            renderStats();
        });
    }

    function renderStats() {
        const container = document.getElementById('stats-container');
        const days = getStatsDays();
        const numDays = days.length;
        let html = '';

        // Period label
        const periodLabels = {
            'week': 'Diese Woche', 'prev-week': 'Letzte Woche', 'next-week': 'Naechste Woche',
            'month': 'Dieser Monat', 'prev-month': 'Letzter Monat', 'next-month': 'Naechster Monat',
            'custom': `${formatDateFull(days[0])} - ${formatDateFull(days[days.length - 1])}`
        };
        const periodLabel = periodLabels[statsPeriod] || 'Diese Woche';

        // Per employee stats
        const empStats = state.employees.map(emp => {
            let hours = 0, shifts = 0, freeDays = 0;
            const shiftSet = new Set();
            days.forEach(day => {
                const a = (state.schedule[formatDate(day)] || {})[emp.id];
                if (a) {
                    if (a.shiftTypeId === 'free') freeDays++;
                    else if (a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') {
                        shifts++;
                        const st = state.shiftTypes.find(s => s.id === a.shiftTypeId);
                        if (st) { hours += calcShiftHours(st); shiftSet.add(st.name); }
                        if (a.shiftTypeId2) {
                            const st2 = state.shiftTypes.find(s => s.id === a.shiftTypeId2);
                            if (st2) hours += calcShiftHours(st2);
                        }
                    }
                }
            });
            return { emp, hours, shifts, freeDays, shiftTypes: [...shiftSet] };
        });

        // Total hours card
        const totalHours = empStats.reduce((sum, s) => sum + s.hours, 0);
        html += `<div class="stat-card">
            <h4>Gesamtstunden — ${periodLabel}</h4>
            <div class="stat-value">${totalHours.toFixed(0)}h</div>
            <div class="stat-detail">${state.employees.length} Mitarbeiter | ${numDays} Tage</div>
        </div>`;

        // Coverage card per hotel
        state.hotels.forEach(hotel => {
            const hotelEmps = state.employees.filter(e => e.hotels.includes(hotel.id));
            let coveredDays = 0;
            days.forEach(day => {
                const dateStr = formatDate(day);
                let count = 0;
                hotelEmps.forEach(emp => {
                    if (emp.excludeFromCoverage) return;
                    const a = (state.schedule[dateStr] || {})[emp.id];
                    if (a && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'vacation' && a.shiftTypeId !== 'sick' && a.shiftTypeId !== 'absent') count++;
                });
                const covObj = state.settings.minCoverage;
                const minCov = (typeof covObj === 'object') ? (covObj[hotel.id] || 2) : (covObj || 2);
                if (count >= minCov) coveredDays++;
            });
            html += `<div class="stat-card">
                <h4>${hotel.name} — Abdeckung</h4>
                <div class="stat-value" style="color:${coveredDays === numDays ? 'var(--success)' : 'var(--warning)'}">${coveredDays}/${numDays}</div>
                <div class="stat-detail">Tage mit ausreichender Besetzung</div>
            </div>`;
        });

        // Shift consistency card
        const inconsistent = empStats.filter(s => s.shiftTypes.length > 1);
        html += `<div class="stat-card">
            <h4>Schichtkonsistenz</h4>
            <div class="stat-value" style="color:${inconsistent.length === 0 ? 'var(--success)' : 'var(--warning)'}">${inconsistent.length === 0 ? 'Optimal' : inconsistent.length + ' Wechsel'}</div>
            <div class="stat-detail">${inconsistent.length > 0 ? inconsistent.map(s => s.emp.name).join(', ') : 'Alle Mitarbeiter haben konsistente Schichten'}</div>
        </div>`;

        // Hours per employee bar chart
        html += `<div class="stat-card" style="grid-column: 1 / -1">
            <h4>Stunden pro Mitarbeiter — ${periodLabel}</h4>
            <div class="stat-bar-container">
                ${empStats.map(s => {
                    const maxH = Math.max(...empStats.map(x => x.hours), 1);
                    const pct = (s.hours / (maxH * 1.2)) * 100;
                    return `<div class="stat-bar-row">
                        <span class="stat-bar-label">${s.emp.name}</span>
                        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${s.emp.color}"></div></div>
                        <span class="stat-bar-value">${s.hours.toFixed(1)}h</span>
                    </div>`;
                }).join('')}
            </div>
        </div>`;

        container.innerHTML = html;
    }

    // ========== SETTINGS VIEW ==========
    function renderSettings() {
        document.getElementById('setting-max-days').value = state.settings.maxDaysPerWeek;
        document.getElementById('setting-min-rest').value = state.settings.minRestHours;
        document.getElementById('setting-free-days').value = state.settings.freeDaysPerWeek;
        document.getElementById('setting-consistent-shift').checked = state.settings.consistentShift;
        document.getElementById('setting-warn-switch').checked = state.settings.warnShiftSwitch;
        // Render per-hotel coverage settings
        const cov = state.settings.minCoverage || {};
        const coverageDiv = document.getElementById('coverage-settings');
        coverageDiv.innerHTML = state.hotels.map(h => {
            const val = (typeof cov === 'object') ? (cov[h.id] || 2) : (cov || 2);
            return `<label class="setting-row">
                <span style="display:flex;align-items:center;gap:8px">
                    <span class="hotel-badge" style="background:${h.color};width:10px;height:10px;border-radius:50%;display:inline-block"></span>
                    ${h.name} — Min. Besetzung pro Tag
                </span>
                <input type="number" class="coverage-input" data-hotel="${h.id}" min="1" max="10" value="${val}">
            </label>`;
        }).join('');
    }

    function initSettings() {
        document.getElementById('btn-save-settings').addEventListener('click', () => {
            state.settings.maxDaysPerWeek = parseInt(document.getElementById('setting-max-days').value);
            state.settings.minRestHours = parseInt(document.getElementById('setting-min-rest').value);
            state.settings.freeDaysPerWeek = parseInt(document.getElementById('setting-free-days').value);
            state.settings.consistentShift = document.getElementById('setting-consistent-shift').checked;
            state.settings.warnShiftSwitch = document.getElementById('setting-warn-switch').checked;
            const coverageObj = {};
            document.querySelectorAll('.coverage-input').forEach(inp => {
                coverageObj[inp.dataset.hotel] = parseInt(inp.value) || 2;
            });
            state.settings.minCoverage = coverageObj;
            saveState();
            showToast('Einstellungen gespeichert', 'success');
        });

        document.getElementById('btn-export-data').addEventListener('click', () => {
            const data = JSON.stringify({
                hotels: state.hotels,
                shiftTypes: state.shiftTypes,
                employees: state.employees,
                schedule: state.schedule,
                absences: state.absences,
                settings: state.settings
            }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schichtplan_export_${formatDate(new Date())}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Daten exportiert', 'success');
        });

        document.getElementById('btn-import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    state.hotels = data.hotels || state.hotels;
                    state.shiftTypes = data.shiftTypes || state.shiftTypes;
                    state.employees = data.employees || state.employees;
                    state.schedule = data.schedule || state.schedule;
                    state.absences = data.absences || state.absences;
                    state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
                    saveState();
                    renderSettings();
                    showToast('Daten importiert', 'success');
                } catch {
                    showToast('Fehler beim Importieren', 'error');
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('btn-reset-data').addEventListener('click', () => {
            openModal('Daten zurücksetzen', '<p>Sollen wirklich ALLE Daten gelöscht werden?</p><p style="color:var(--danger);font-size:12px;margin-top:8px">Diese Aktion kann nicht rückgängig gemacht werden!</p>', () => {
                localStorage.removeItem('schichtplan_data');
                initDefaults();
                saveState();
                switchView('schedule');
                showToast('Alle Daten zurückgesetzt', 'warning');
            }, { saveText: 'Zurücksetzen' });
        });

        document.getElementById('btn-restart-tutorial').addEventListener('click', () => {
            localStorage.removeItem('schichtplan_tutorial_done');
            if (window.startTutorial) window.startTutorial();
        });
    }

    // ========== THEME TOGGLE ==========
    function initThemeToggle() {
        const saved = localStorage.getItem('schichtplan_theme');
        // Light mode is default
        if (saved === 'dark') {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }

        document.getElementById('btn-theme-toggle').addEventListener('click', () => {
            const isLight = document.body.classList.contains('light');
            applyTheme(isLight ? 'dark' : 'light');
        });
    }

    function applyTheme(theme) {
        const label = document.querySelector('.theme-label');
        if (theme === 'light') {
            document.body.classList.add('light');
            document.getElementById('icon-moon').style.display = 'none';
            document.getElementById('icon-sun').style.display = '';
            if (label) label.textContent = 'Dunkelmodus';
        } else {
            document.body.classList.remove('light');
            document.getElementById('icon-moon').style.display = '';
            document.getElementById('icon-sun').style.display = 'none';
            if (label) label.textContent = 'Hellmodus';
        }
        localStorage.setItem('schichtplan_theme', theme);
    }

    // ========== EXPORT PDF ==========
    function exportPDF() {
        // Hide employees with no actual shifts in their hotel this week
        const weekDays = getWeekDays(state.currentWeekStart);
        document.querySelectorAll('.emp-row').forEach(row => {
            const empId = row.dataset.empId;
            const hotelId = row.dataset.hotel;
            let hasShift = false;
            weekDays.forEach(day => {
                const a = (state.schedule[formatDate(day)] || {})[empId];
                if (a && a.hotel === hotelId && a.shiftTypeId !== 'free' && a.shiftTypeId !== 'absent') {
                    hasShift = true;
                }
            });
            if (!hasShift) row.classList.add('print-hidden');
        });

        window.print();

        // Restore visibility after print
        document.querySelectorAll('.emp-row.print-hidden').forEach(r => r.classList.remove('print-hidden'));
    }

    // ========== INIT ==========
    async function init() {
        await loadState();
        initNav();
        initScheduleControls();
        initSettings();
        initThemeToggle();
        initStatsControls();

        // Button listeners
        document.getElementById('btn-add-employee').addEventListener('click', () => openEmployeeForm());
        document.getElementById('btn-add-shift').addEventListener('click', () => openShiftForm());
        document.getElementById('btn-add-absence').addEventListener('click', openAbsenceForm);

        // Close modal on overlay click
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-overlay')) closeModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if (e.key === 'ArrowLeft' && e.altKey && state.currentView === 'schedule') {
                state.currentWeekStart = addDays(state.currentWeekStart, -7);
                renderSchedule();
            }
            if (e.key === 'ArrowRight' && e.altKey && state.currentView === 'schedule') {
                state.currentWeekStart = addDays(state.currentWeekStart, 7);
                renderSchedule();
            }
        });

        renderSchedule();
    }

    // Expose API for inline handlers
    window.app = {
        editEmployee: (id) => openEmployeeForm(state.employees.find(e => e.id === id)),
        deleteEmployee: deleteEmployee,
        editShift: (id) => openShiftForm(state.shiftTypes.find(s => s.id === id)),
        deleteShift: deleteShift,
        deleteAbsence: deleteAbsence,
        editAbsence: (id) => openAbsenceForm(state.absences.find(a => a.id === id))
    };

    // Expose state and helpers for features.js
    window.appState = state;
    window.saveStateExt = () => saveState();
    window.showToastExt = showToast;
    window.openModalExt = openModal;

    document.addEventListener('DOMContentLoaded', init);
})();
