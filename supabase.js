// ========== SUPABASE CLIENT ==========
const SUPABASE_URL = 'https://rpkdlckoupswdwttnvvt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwa2RsY2tvdXBzd2R3dHRudnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzM2NDMsImV4cCI6MjA5MTMwOTY0M30.bguDIZx_Tl9jw88Z_nVlMpSdkJyXEufLrvBUSI2Qlg0';

const db = {
    // Generic fetch helper
    async _fetch(path, opts = {}) {
        const url = `${SUPABASE_URL}/rest/v1/${path}`;
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': opts.prefer || 'return=representation'
        };
        const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
        if (!res.ok) {
            const err = await res.text();
            console.error('Supabase error:', res.status, err);
            return null;
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
    },

    // ===== HOTELS =====
    async getHotels() {
        return await this._fetch('hotels?order=id');
    },
    async upsertHotels(hotels) {
        return await this._fetch('hotels', {
            method: 'POST',
            body: JSON.stringify(hotels),
            headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
        });
    },

    // ===== SHIFT TYPES =====
    async getShiftTypes() {
        return await this._fetch('shift_types?order=sort_order');
    },
    async upsertShiftTypes(types) {
        const mapped = types.map((t, i) => ({
            id: t.id, name: t.name, start_time: t.start, end_time: t.end,
            break_min: t.breakMin || 0, color: t.color, css_class: t.cssClass || 'custom', sort_order: i
        }));
        return await this._fetch('shift_types', {
            method: 'POST',
            body: JSON.stringify(mapped),
            headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
        });
    },
    async deleteShiftType(id) {
        return await this._fetch(`shift_types?id=eq.${id}`, { method: 'DELETE' });
    },

    // ===== EMPLOYEES =====
    async getEmployees() {
        return await this._fetch('employees?order=sort_order');
    },
    async upsertEmployees(emps) {
        const mapped = emps.map((e, i) => ({
            id: e.id, name: e.name, hotels: e.hotels, fixed_shift: e.fixedShift || null,
            max_days: e.maxDays || 5, color: e.color,
            default_free_days: e.defaultFreeDays || [],
            day_shifts: { ...(e.dayShifts || {}), _excludeFromCoverage: e.excludeFromCoverage || false },
            sort_order: e.order ?? i
        }));
        return await this._fetch('employees', {
            method: 'POST',
            body: JSON.stringify(mapped),
            headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
        });
    },
    async deleteEmployee(id) {
        return await this._fetch(`employees?id=eq.${id}`, { method: 'DELETE' });
    },

    // ===== SCHEDULE =====
    async getSchedule(startDate, endDate) {
        return await this._fetch(`schedule?date=gte.${startDate}&date=lte.${endDate}&order=date`);
    },
    async getScheduleAll() {
        return await this._fetch('schedule?order=date');
    },
    async upsertScheduleEntry(date, employeeId, hotelId, shiftTypeId, shiftTypeId2) {
        const body = { date, employee_id: employeeId, hotel_id: hotelId, shift_type_id: shiftTypeId };
        if (shiftTypeId2) body.shift_type_id2 = shiftTypeId2;
        // Delete existing then insert (upsert on composite)
        await this._fetch(`schedule?date=eq.${date}&employee_id=eq.${employeeId}`, { method: 'DELETE' });
        return await this._fetch('schedule', { method: 'POST', body: JSON.stringify(body) });
    },
    async deleteScheduleEntry(date, employeeId) {
        return await this._fetch(`schedule?date=eq.${date}&employee_id=eq.${employeeId}`, { method: 'DELETE' });
    },
    async saveScheduleBulk(scheduleObj) {
        // Convert { 'YYYY-MM-DD': { empId: { hotel, shiftTypeId, shiftTypeId2? } } } to rows
        const rows = [];
        Object.entries(scheduleObj).forEach(([date, emps]) => {
            Object.entries(emps).forEach(([empId, data]) => {
                rows.push({
                    date,
                    employee_id: empId,
                    hotel_id: data.hotel,
                    shift_type_id: data.shiftTypeId,
                    shift_type_id2: data.shiftTypeId2 || null
                });
            });
        });
        if (rows.length === 0) return;
        // Get all dates involved
        const dates = [...new Set(rows.map(r => r.date))];
        const minDate = dates.sort()[0];
        const maxDate = dates.sort().reverse()[0];
        // Delete existing entries for these dates
        await this._fetch(`schedule?date=gte.${minDate}&date=lte.${maxDate}`, { method: 'DELETE' });
        // Insert all in batches of 500
        for (let i = 0; i < rows.length; i += 500) {
            await this._fetch('schedule', { method: 'POST', body: JSON.stringify(rows.slice(i, i + 500)) });
        }
    },

    // ===== ABSENCES =====
    async getAbsences() {
        return await this._fetch('absences?order=start_date');
    },
    async upsertAbsence(abs) {
        const mapped = {
            id: abs.id, employee_id: abs.employeeId, type: abs.type,
            start_date: abs.startDate, end_date: abs.endDate, note: abs.note || null
        };
        await this._fetch(`absences?id=eq.${abs.id}`, { method: 'DELETE' });
        return await this._fetch('absences', { method: 'POST', body: JSON.stringify(mapped) });
    },
    async deleteAbsence(id) {
        return await this._fetch(`absences?id=eq.${id}`, { method: 'DELETE' });
    },

    // ===== SETTINGS =====
    async getSettings() {
        const rows = await this._fetch('settings');
        const obj = {};
        if (rows) rows.forEach(r => { obj[r.key] = r.value; });
        return obj;
    },
    async saveSetting(key, value) {
        await this._fetch(`settings?key=eq.${key}`, { method: 'DELETE' });
        return await this._fetch('settings', {
            method: 'POST',
            body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
        });
    },

    // ===== FULL SYNC: Load all from Supabase into app state =====
    async loadAll() {
        const [hotels, shiftTypes, employees, scheduleRows, absences, settings] = await Promise.all([
            this.getHotels(),
            this.getShiftTypes(),
            this.getEmployees(),
            this.getScheduleAll(),
            this.getAbsences(),
            this.getSettings()
        ]);

        // Map shift types back to app format
        const mappedShifts = (shiftTypes || []).map(s => ({
            id: s.id, name: s.name, start: s.start_time, end: s.end_time,
            breakMin: s.break_min || 0, color: s.color, cssClass: s.css_class || 'custom'
        }));

        // Map employees back
        const mappedEmps = (employees || []).map(e => {
            const ds = e.day_shifts || {};
            const excludeFromCoverage = ds._excludeFromCoverage || false;
            const cleanDs = { ...ds };
            delete cleanDs._excludeFromCoverage;
            return {
                id: e.id, name: e.name, hotels: e.hotels || [], fixedShift: e.fixed_shift,
                maxDays: e.max_days || 5, color: e.color,
                defaultFreeDays: e.default_free_days || [],
                dayShifts: cleanDs,
                order: e.sort_order || 0,
                excludeFromCoverage
            };
        });

        // Map schedule rows to { date: { empId: { hotel, shiftTypeId } } }
        const schedule = {};
        (scheduleRows || []).forEach(r => {
            if (!schedule[r.date]) schedule[r.date] = {};
            schedule[r.date][r.employee_id] = {
                hotel: r.hotel_id,
                shiftTypeId: r.shift_type_id,
                shiftTypeId2: r.shift_type_id2 || undefined
            };
        });

        // Map absences back
        const mappedAbs = (absences || []).map(a => ({
            id: a.id, employeeId: a.employee_id, type: a.type,
            startDate: a.start_date, endDate: a.end_date, note: a.note
        }));

        return {
            hotels: hotels || [],
            shiftTypes: mappedShifts,
            employees: mappedEmps,
            schedule,
            absences: mappedAbs,
            settings: settings || {}
        };
    },

    // ===== FULL SYNC: Save all app state to Supabase =====
    // Must be sequential: hotels -> shifts -> employees -> schedule -> absences
    async saveAll(state) {
        await this.upsertHotels(state.hotels);
        await this.upsertShiftTypes(state.shiftTypes);
        await this.upsertEmployees(state.employees);
        await this.saveScheduleBulk(state.schedule);
        for (const abs of state.absences) {
            await this.upsertAbsence(abs);
        }
        for (const [key, value] of Object.entries(state.settings)) {
            await this.saveSetting(key, value);
        }
    }
};

window.db = db;
