// ========== EXTENDED FEATURES MODULE ==========
// Ferienkontigent, Positionen/Regeln, Urlaubsanfragen, Gantt, Portal, Schichtentausch
(function () {
    'use strict';

    // Wait for main app to initialize
    function waitForApp(cb) {
        if (window.appState) return cb();
        setTimeout(() => waitForApp(cb), 100);
    }

    // ========== VACATION BALANCE (Ferienkontigent) ==========
    function renderVacation() {
        const container = document.getElementById('vacation-container');
        if (!container) return;
        const state = window.appState;
        const daysPerMonth = (state.settings.vacationDaysPerMonth) || 1.75; // ~21 days/year
        const currentMonth = new Date().getMonth(); // 0-11
        const monthsElapsed = currentMonth + 1;

        let html = `<div class="settings-group" style="margin-bottom:16px">
            <h3>Einstellungen</h3>
            <label class="setting-row">
                <span>Ferientage pro Monat (Standard)</span>
                <input type="number" id="vacation-days-per-month" step="0.25" min="0" max="5" value="${daysPerMonth}" style="width:80px">
            </label>
            <button class="btn-primary" id="btn-save-vacation-settings" style="margin-top:8px">Speichern</button>
        </div>`;

        html += `<div class="table-container"><table class="data-table">
            <thead><tr><th>Mitarbeiter</th><th>Position</th><th>Anspruch/Jahr</th><th>Freigeschaltet</th><th>Genommen</th><th>Saldo</th></tr></thead><tbody>`;

        state.employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
            const empDPM = emp.vacationDaysPerMonth || daysPerMonth;
            const yearEntitlement = Math.round(empDPM * 12 * 10) / 10;
            const unlocked = Math.round(empDPM * monthsElapsed * 10) / 10;

            // Count taken vacation days this year
            const yearStart = new Date().getFullYear() + '-01-01';
            const yearEnd = new Date().getFullYear() + '-12-31';
            let taken = 0;
            state.absences.forEach(a => {
                if (a.employeeId !== emp.id || a.type !== 'vacation') return;
                const s = a.startDate > yearStart ? a.startDate : yearStart;
                const e = a.endDate < yearEnd ? a.endDate : yearEnd;
                if (s > e) return;
                let d = new Date(s + 'T00:00:00');
                const end = new Date(e + 'T00:00:00');
                while (d <= end) { taken++; d.setDate(d.getDate() + 1); }
            });

            const saldo = unlocked - taken;
            const saldoColor = saldo >= 0 ? 'var(--success)' : 'var(--danger)';

            html += `<tr>
                <td><div class="employee-name-cell"><div class="avatar" style="background:${emp.color}">${emp.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>${emp.name}</div></td>
                <td style="color:var(--text-muted)">${emp.position || '—'}</td>
                <td>${yearEntitlement} Tage</td>
                <td>${unlocked} Tage</td>
                <td>${taken} Tage</td>
                <td style="color:${saldoColor};font-weight:600">${saldo >= 0 ? '+' : ''}${saldo} Tage</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        document.getElementById('btn-save-vacation-settings')?.addEventListener('click', () => {
            const val = parseFloat(document.getElementById('vacation-days-per-month').value) || 1.75;
            state.settings.vacationDaysPerMonth = val;
            window.saveStateExt();
            renderVacation();
            window.showToastExt('Ferienkontigent gespeichert', 'success');
        });
    }

    // ========== POSITIONS & RULES ==========
    function renderRules() {
        const container = document.getElementById('rules-container');
        if (!container) return;
        const state = window.appState;
        if (!state.rules) state.rules = [];

        // Positions section
        let html = `<div class="settings-group" style="margin-bottom:16px">
            <h3>Positionen</h3>
            <div class="cards-grid">`;

        state.employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
            html += `<div class="card" style="padding:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <div class="avatar" style="background:${emp.color};width:24px;height:24px;font-size:10px">${emp.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                    <strong style="font-size:13px">${emp.name}</strong>
                </div>
                <div class="form-group" style="margin-bottom:0">
                    <input type="text" class="position-input" data-emp-id="${emp.id}" value="${emp.position || ''}" placeholder="z.B. Front Office Manager" style="font-size:12px;padding:6px 8px">
                </div>
            </div>`;
        });

        html += `</div></div>`;

        // Rules section
        html += `<div class="settings-group">
            <h3>Regeln</h3>`;

        if (state.rules.length === 0) {
            html += '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">Keine Regeln definiert. Klicke "Regel hinzufuegen" um eine neue Regel zu erstellen.</p>';
        }

        state.rules.forEach((rule, idx) => {
            const emp = state.employees.find(e => e.id === rule.employeeId);
            html += `<div class="card" style="padding:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
                <div>
                    <strong style="color:var(--primary)">${emp ? emp.name : '?'}</strong>
                    <span style="color:var(--text-muted);margin:0 6px">—</span>
                    <span style="font-size:13px">${rule.description}</span>
                </div>
                <button class="btn-xs" style="color:var(--danger)" onclick="window.deleteRule(${idx})">Loeschen</button>
            </div>`;
        });

        html += `</div>`;

        // Save positions button
        html += `<button class="btn-primary" id="btn-save-positions" style="margin-top:12px">Positionen speichern</button>`;

        container.innerHTML = html;

        // Position save handler
        document.getElementById('btn-save-positions')?.addEventListener('click', () => {
            document.querySelectorAll('.position-input').forEach(inp => {
                const emp = state.employees.find(e => e.id === inp.dataset.empId);
                if (emp) emp.position = inp.value.trim();
            });
            window.saveStateExt();
            window.showToastExt('Positionen gespeichert', 'success');
        });
    }

    function openAddRule() {
        const state = window.appState;
        const html = `
            <div class="form-group">
                <label>Mitarbeiter</label>
                <select id="rule-employee">
                    ${state.employees.map(e => `<option value="${e.id}">${e.name} ${e.position ? '(' + e.position + ')' : ''}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Regel-Typ</label>
                <select id="rule-type">
                    <option value="not-alone">Darf nicht alleine auf Schicht sein</option>
                    <option value="no-late">Keine Spaetschicht</option>
                    <option value="no-early">Keine Fruehschicht</option>
                    <option value="max-hours">Max. Stunden pro Woche</option>
                    <option value="custom">Eigene Beschreibung</option>
                </select>
            </div>
            <div class="form-group" id="rule-custom-group" style="display:none">
                <label>Beschreibung</label>
                <input type="text" id="rule-custom-desc" placeholder="z.B. Nur mit Aufsicht arbeiten">
            </div>
            <div class="form-group" id="rule-hours-group" style="display:none">
                <label>Max. Stunden</label>
                <input type="number" id="rule-max-hours" value="30" min="1" max="60">
            </div>
        `;

        window.openModalExt('Regel hinzufuegen', html, () => {
            const employeeId = document.getElementById('rule-employee').value;
            const type = document.getElementById('rule-type').value;
            let description = '';
            const emp = state.employees.find(e => e.id === employeeId);
            const name = emp ? emp.name : '?';

            if (type === 'not-alone') description = `${name} darf nicht alleine auf einer Schicht sein`;
            else if (type === 'no-late') description = `${name} darf keine Spaetschicht arbeiten`;
            else if (type === 'no-early') description = `${name} darf keine Fruehschicht arbeiten`;
            else if (type === 'max-hours') description = `${name} max. ${document.getElementById('rule-max-hours').value}h pro Woche`;
            else description = document.getElementById('rule-custom-desc').value || 'Eigene Regel';

            if (!state.rules) state.rules = [];
            state.rules.push({ employeeId, type, description, maxHours: parseInt(document.getElementById('rule-max-hours')?.value) || null });
            window.saveStateExt();
            renderRules();
            window.showToastExt('Regel hinzugefuegt', 'success');
        });

        // Toggle custom/hours fields
        setTimeout(() => {
            const sel = document.getElementById('rule-type');
            if (sel) sel.addEventListener('change', () => {
                document.getElementById('rule-custom-group').style.display = sel.value === 'custom' ? '' : 'none';
                document.getElementById('rule-hours-group').style.display = sel.value === 'max-hours' ? '' : 'none';
            });
        }, 50);
    }

    // ========== VACATION REQUESTS ==========
    function renderVacationRequests() {
        const container = document.getElementById('vacation-requests-container');
        if (!container) return;
        const state = window.appState;
        if (!state.vacationRequests) state.vacationRequests = [];

        let html = '';
        const pending = state.vacationRequests.filter(r => r.status === 'pending');
        const processed = state.vacationRequests.filter(r => r.status !== 'pending');

        if (pending.length > 0) {
            html += `<div class="settings-group" style="margin-bottom:16px"><h3>Offene Anfragen (${pending.length})</h3>`;
            pending.forEach(req => {
                const emp = state.employees.find(e => e.id === req.employeeId);
                html += `<div class="card" style="padding:12px;margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <strong>${emp ? emp.name : '?'}</strong>
                            <span style="color:var(--text-muted);margin:0 8px">|</span>
                            <span>${req.startDate} — ${req.endDate}</span>
                            ${req.note ? `<span style="color:var(--text-dim);margin-left:8px;font-style:italic">"${req.note}"</span>` : ''}
                        </div>
                        <div style="display:flex;gap:6px">
                            <button class="btn-primary" style="padding:4px 12px;font-size:12px" onclick="window.approveVacation('${req.id}')">Genehmigen</button>
                            <button class="btn-danger" style="padding:4px 12px;font-size:12px" onclick="window.rejectVacation('${req.id}')">Ablehnen</button>
                        </div>
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        if (processed.length > 0) {
            html += `<div class="settings-group"><h3>Bearbeitete Anfragen</h3>`;
            processed.forEach(req => {
                const emp = state.employees.find(e => e.id === req.employeeId);
                const statusColor = req.status === 'approved' ? 'var(--success)' : 'var(--danger)';
                const statusText = req.status === 'approved' ? 'Genehmigt' : 'Abgelehnt';
                html += `<div class="card" style="padding:10px;margin-bottom:6px;opacity:.7">
                    <span style="color:${statusColor};font-weight:600;margin-right:8px">${statusText}</span>
                    <strong>${emp ? emp.name : '?'}</strong>
                    <span style="color:var(--text-muted);margin:0 6px">|</span>
                    <span>${req.startDate} — ${req.endDate}</span>
                </div>`;
            });
            html += '</div>';
        }

        if (state.vacationRequests.length === 0) {
            html = '<div style="padding:40px;text-align:center;color:var(--text-dim)">Keine Urlaubsanfragen vorhanden</div>';
        }

        container.innerHTML = html;
    }

    // ========== GANTT YEARLY VIEW ==========
    let ganttYearOffset = 0;

    function renderGantt() {
        const container = document.getElementById('gantt-container');
        if (!container) return;
        const state = window.appState;
        const year = new Date().getFullYear() + ganttYearOffset;
        const months = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

        let html = `<table class="gantt-table"><thead><tr><th class="gantt-name">Mitarbeiter</th>`;
        // Generate week headers
        const weeks = [];
        let d = new Date(year, 0, 1);
        // Find first Monday of the year
        while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
        while (d.getFullYear() <= year) {
            weeks.push(new Date(d));
            d.setDate(d.getDate() + 7);
        }
        // Month headers
        html += '</tr><tr><th></th>';
        let lastMonth = -1;
        weeks.forEach(w => {
            const m = w.getMonth();
            if (m !== lastMonth) {
                // Count weeks in this month
                const monthWeeks = weeks.filter(ww => ww.getMonth() === m).length;
                html += `<th colspan="${monthWeeks}" class="gantt-month">${months[m]}</th>`;
                lastMonth = m;
            }
        });
        html += '</tr><tr><th></th>';
        weeks.forEach(w => {
            const kw = getWeekNumberLocal(w);
            const isNow = Math.abs(w - new Date()) < 7 * 86400000;
            html += `<th class="gantt-week ${isNow ? 'gantt-now' : ''}">${kw}</th>`;
        });
        html += '</tr></thead><tbody>';

        const sorted = [...state.employees].sort((a, b) => a.name.localeCompare(b.name));
        sorted.forEach(emp => {
            html += `<tr><td class="gantt-name"><div class="employee-name-cell" style="gap:4px"><div class="avatar" style="background:${emp.color};width:20px;height:20px;font-size:9px">${emp.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div><span style="font-size:11px">${emp.name}</span></div></td>`;
            weeks.forEach(weekStart => {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                // Check what happens this week
                let status = 'work'; // default
                let hasVacation = false, hasSick = false, hasFree = true, hasWork = false;

                for (let di = 0; di < 7; di++) {
                    const dd = new Date(weekStart);
                    dd.setDate(dd.getDate() + di);
                    const ds = dd.toISOString().split('T')[0];
                    const a = (state.schedule[ds] || {})[emp.id];
                    if (a) {
                        if (a.shiftTypeId === 'vacation') hasVacation = true;
                        else if (a.shiftTypeId === 'sick') hasSick = true;
                        else if (a.shiftTypeId !== 'free' && a.shiftTypeId !== 'absent') { hasWork = true; hasFree = false; }
                    }
                    // Check absences
                    const absence = state.absences.find(ab => ab.employeeId === emp.id && ds >= ab.startDate && ds <= ab.endDate);
                    if (absence) {
                        if (absence.type === 'vacation') hasVacation = true;
                        else if (absence.type === 'sick') hasSick = true;
                    }
                }

                let cls = 'gantt-empty';
                let title = '';
                if (hasVacation) { cls = 'gantt-vacation'; title = 'Ferien'; }
                else if (hasSick) { cls = 'gantt-sick'; title = 'Krank'; }
                else if (hasWork) { cls = 'gantt-work'; title = 'Arbeitet'; }

                html += `<td class="gantt-cell ${cls}" title="${title}"></td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';

        // Legend
        html += `<div style="display:flex;gap:16px;margin-top:12px;font-size:11px;color:var(--text-muted)">
            <span><span class="gantt-cell gantt-work" style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Arbeitet</span>
            <span><span class="gantt-cell gantt-vacation" style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Ferien</span>
            <span><span class="gantt-cell gantt-sick" style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Krank</span>
            <span><span class="gantt-cell gantt-empty" style="display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px"></span>Keine Daten</span>
        </div>`;

        container.innerHTML = html;
    }

    function getWeekNumberLocal(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    // ========== EMPLOYEE PORTAL (Demo) ==========
    function renderPortal() {
        const container = document.getElementById('portal-container');
        if (!container) return;
        const state = window.appState;

        let html = `<div class="settings-group" style="margin-bottom:16px">
            <h3>Mitarbeiter auswaehlen</h3>
            <select id="portal-employee" style="width:100%;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:14px">
                ${state.employees.sort((a,b)=>a.name.localeCompare(b.name)).map(e => `<option value="${e.id}">${e.name} ${e.position ? '— ' + e.position : ''}</option>`).join('')}
            </select>
        </div>`;

        html += `<div id="portal-content"></div>`;

        // Vacation request form
        html += `<div class="settings-group" style="margin-top:16px">
            <h3>Urlaub anfragen</h3>
            <div class="form-row">
                <div class="form-group"><label>Von</label><input type="date" id="portal-vac-start"></div>
                <div class="form-group"><label>Bis</label><input type="date" id="portal-vac-end"></div>
            </div>
            <div class="form-group"><label>Notiz (optional)</label><input type="text" id="portal-vac-note" placeholder="z.B. Familienferien"></div>
            <button class="btn-primary" id="btn-portal-request">Urlaubsanfrage senden</button>
        </div>`;

        container.innerHTML = html;

        // Render selected employee's schedule
        const renderPortalSchedule = () => {
            const empId = document.getElementById('portal-employee').value;
            const emp = state.employees.find(e => e.id === empId);
            if (!emp) return;

            const weekDays = getWeekDaysLocal(getMondayLocal(new Date()));
            const DAY_NAMES = ['Mo','Di','Mi','Do','Fr','Sa','So'];

            let schedHtml = `<div class="settings-group"><h3>Mein Schichtplan — Diese Woche</h3>
                <table class="data-table"><thead><tr>`;
            DAY_NAMES.forEach((d, i) => {
                const dd = weekDays[i];
                schedHtml += `<th style="text-align:center">${d}<br><span style="font-size:10px;font-weight:400">${String(dd.getDate()).padStart(2,'0')}.${String(dd.getMonth()+1).padStart(2,'0')}</span></th>`;
            });
            schedHtml += '</tr></thead><tbody><tr>';

            weekDays.forEach(day => {
                const ds = day.toISOString().split('T')[0];
                const a = (state.schedule[ds] || {})[empId];
                let cellText = '—';
                let cellStyle = 'color:var(--text-dim)';
                if (a) {
                    if (a.shiftTypeId === 'free') { cellText = 'Frei'; cellStyle = 'color:var(--success)'; }
                    else if (a.shiftTypeId === 'vacation') { cellText = 'Ferien'; cellStyle = 'color:var(--danger)'; }
                    else if (a.shiftTypeId === 'sick') { cellText = 'Krank'; cellStyle = 'color:var(--warning)'; }
                    else if (a.shiftTypeId === 'absent') { cellText = 'Abwesend'; cellStyle = 'color:var(--text-dim)'; }
                    else {
                        const st = state.shiftTypes.find(s => s.id === a.shiftTypeId);
                        if (st) { cellText = `${st.start}-${st.end}`; cellStyle = `color:${st.color}`; }
                    }
                }
                schedHtml += `<td style="text-align:center;${cellStyle};font-weight:500">${cellText}</td>`;
            });

            schedHtml += '</tr></tbody></table></div>';

            // Employee profile
            schedHtml += `<div class="settings-group"><h3>Mein Profil</h3>
                <div class="card-info" style="padding:4px 0">Hotels: ${emp.hotels.map(h => { const ho = state.hotels.find(x=>x.id===h); return ho ? ho.name : h; }).join(', ')}</div>
                <div class="card-info" style="padding:4px 0">Position: ${emp.position || 'Nicht festgelegt'}</div>
                <div class="card-info" style="padding:4px 0">Max. Arbeitstage: ${emp.maxDays}/Woche</div>
                <div class="card-info" style="padding:4px 0">Standard-Freitage: ${(emp.defaultFreeDays||[]).map(d => DAY_NAMES[d]).join(', ') || 'Nicht festgelegt'}</div>
            </div>`;

            document.getElementById('portal-content').innerHTML = schedHtml;
        };

        document.getElementById('portal-employee')?.addEventListener('change', renderPortalSchedule);
        renderPortalSchedule();

        // Vacation request
        document.getElementById('btn-portal-request')?.addEventListener('click', () => {
            const empId = document.getElementById('portal-employee').value;
            const startDate = document.getElementById('portal-vac-start').value;
            const endDate = document.getElementById('portal-vac-end').value;
            const note = document.getElementById('portal-vac-note').value.trim();
            if (!startDate || !endDate) { window.showToastExt('Bitte Datum waehlen', 'error'); return; }
            if (startDate > endDate) { window.showToastExt('Enddatum muss nach Startdatum sein', 'error'); return; }

            if (!state.vacationRequests) state.vacationRequests = [];
            state.vacationRequests.push({
                id: '_' + Math.random().toString(36).substr(2, 9),
                employeeId: empId,
                startDate, endDate, note,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
            window.saveStateExt();
            document.getElementById('portal-vac-start').value = '';
            document.getElementById('portal-vac-end').value = '';
            document.getElementById('portal-vac-note').value = '';
            window.showToastExt('Urlaubsanfrage gesendet! Warte auf Genehmigung.', 'success');
        });
    }

    function getMondayLocal(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function getWeekDaysLocal(monday) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }

    // ========== APPROVE / REJECT VACATION ==========
    window.approveVacation = function(reqId) {
        const state = window.appState;
        const req = (state.vacationRequests || []).find(r => r.id === reqId);
        if (!req) return;
        req.status = 'approved';

        // Auto-add to absences and schedule
        const id = '_' + Math.random().toString(36).substr(2, 9);
        state.absences.push({ id, employeeId: req.employeeId, type: 'vacation', startDate: req.startDate, endDate: req.endDate, note: 'Genehmigter Urlaub' });

        // Mark in schedule
        let d = new Date(req.startDate + 'T00:00:00');
        const end = new Date(req.endDate + 'T00:00:00');
        while (d <= end) {
            const ds = d.toISOString().split('T')[0];
            if (!state.schedule[ds]) state.schedule[ds] = {};
            const emp = state.employees.find(e => e.id === req.employeeId);
            state.schedule[ds][req.employeeId] = { hotel: emp ? emp.hotels[0] : 'julen', shiftTypeId: 'vacation' };
            d.setDate(d.getDate() + 1);
        }

        window.saveStateExt();
        renderVacationRequests();
        window.showToastExt('Urlaub genehmigt und im Schichtplan eingetragen', 'success');
    };

    window.rejectVacation = function(reqId) {
        const state = window.appState;
        const req = (state.vacationRequests || []).find(r => r.id === reqId);
        if (!req) return;
        req.status = 'rejected';
        window.saveStateExt();
        renderVacationRequests();
        window.showToastExt('Urlaubsanfrage abgelehnt', 'info');
    };

    window.deleteRule = function(idx) {
        const state = window.appState;
        if (state.rules) state.rules.splice(idx, 1);
        window.saveStateExt();
        renderRules();
        window.showToastExt('Regel geloescht', 'info');
    };

    // ========== INIT ==========
    waitForApp(() => {
        // Register render functions globally so nav can call them
        window.renderVacation = renderVacation;
        window.renderRules = renderRules;
        window.renderVacationRequests = renderVacationRequests;
        window.renderGantt = renderGantt;
        window.renderPortal = renderPortal;
        window.openAddRule = openAddRule;

        // Gantt year buttons
        document.querySelectorAll('[data-gantt-year]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-gantt-year]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ganttYearOffset = parseInt(btn.dataset.ganttYear);
                renderGantt();
            });
        });

        // Add rule button
        document.getElementById('btn-add-rule')?.addEventListener('click', openAddRule);
    });
})();
