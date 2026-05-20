/**
 * HSE Personnel Matrix — CRUD table with unlimited undo/redo.
 */
(function () {
    const MATRIX_STATE = {
        workbook: null,
        activeSheetId: null,
        search: '',
        filters: {},
        loading: false,
    };

    const HISTORY = { undo: [], redo: [] };
    let historyRecording = true;

    const TAB_LABELS = {
        employee_mandatory_training: 'Pelatihan Wajib',
        personnel_health: 'Kesehatan Personel',
        personnel_data_information: 'Data Personel',
        contract_information: 'Kontrak',
        emergency_contact_information: 'Kontak Darurat',
    };

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function clone(v) {
        return JSON.parse(JSON.stringify(v));
    }

    function apiBase() {
        return typeof API_BASE !== 'undefined' ? API_BASE : '';
    }

    function activeSheet() {
        if (!MATRIX_STATE.workbook) return null;
        return MATRIX_STATE.workbook.sheets.find(s => s.id === MATRIX_STATE.activeSheetId)
            || MATRIX_STATE.workbook.sheets[0]
            || null;
    }

    function sheetById(id) {
        return MATRIX_STATE.workbook?.sheets?.find(s => s.id === id);
    }

    function parseDate(val) {
        if (!val) return null;
        const s = String(val).trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function daysUntil(val) {
        const d = parseDate(val);
        if (!d) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((d - today) / (86400000));
    }

    function computeSheetSummary(sheet) {
        const rows = sheet.rows || [];
        const cols = sheet.columns || [];
        const requiredCols = cols.filter(c => c.required);
        let missingRequired = 0;
        let expiringSoon = 0;
        let expired = 0;
        const genderCol = cols.find(c => /gender/i.test(c.label));
        const gender = { Male: 0, Female: 0, Other: 0 };

        rows.forEach(row => {
            requiredCols.forEach(c => {
                if (!(row.cells?.[c.id] || '').trim()) missingRequired += 1;
            });
            cols.forEach(c => {
                if (!/expir|expired/i.test(c.label)) return;
                const du = daysUntil(row.cells?.[c.id]);
                if (du == null) return;
                if (du < 0) expired += 1;
                else if (du <= 30) expiringSoon += 1;
            });
            if (genderCol) {
                const g = (row.cells?.[genderCol.id] || '').trim();
                if (/female/i.test(g)) gender.Female += 1;
                else if (/male/i.test(g)) gender.Male += 1;
                else if (g) gender.Other += 1;
            }
        });

        const personnelCol = cols.find(c => /personnel name/i.test(c.label));
        const uniquePersonnel = personnelCol
            ? new Set(rows.map(r => (r.cells?.[personnelCol.id] || '').trim()).filter(Boolean)).size
            : rows.length;

        return { totalRows: rows.length, totalCols: cols.length, missingRequired, expiringSoon, expired, gender, uniquePersonnel };
    }

    function filterRows(sheet) {
        const q = MATRIX_STATE.search.trim().toLowerCase();
        return (sheet.rows || []).filter(row => {
            if (!q) return true;
            return Object.values(row.cells || {}).join(' ').toLowerCase().includes(q);
        });
    }

    async function fetchWorkbook() {
        const res = await fetch(`${apiBase()}/matrix/workbook?t=${Date.now()}`);
        if (!res.ok) throw new Error('Gagal memuat matrix workbook');
        return res.json();
    }

    async function matrixRequest(method, path, body) {
        const res = await fetch(`${apiBase()}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
                const err = await res.json();
                msg = err.detail || msg;
            } catch (e) { /* */ }
            throw new Error(msg);
        }
        return res.status === 204 ? null : res.json();
    }

    async function reloadActiveSheet() {
        const sheet = activeSheet();
        if (!sheet) return;
        const fresh = await matrixRequest('GET', `/matrix/sheets/${sheet.id}`);
        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === sheet.id);
        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
    }

    async function applyCellUpdate(sheetId, rowId, colId, value) {
        await matrixRequest('PUT', `/matrix/sheets/${sheetId}/rows/${rowId}`, { cells: { [colId]: value } });
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        if (row) row.cells[colId] = value;
    }

    function clearHistory() {
        HISTORY.undo = [];
        HISTORY.redo = [];
        updateUndoRedoUI();
    }

    function pushHistory(entry) {
        if (!historyRecording) return;
        HISTORY.undo.push(entry);
        HISTORY.redo = [];
        updateUndoRedoUI();
    }

    function updateUndoRedoUI() {
        const undoBtn = document.getElementById('mx-btn-undo');
        const redoBtn = document.getElementById('mx-btn-redo');
        const undoLbl = document.getElementById('mx-undo-count');
        const redoLbl = document.getElementById('mx-redo-count');
        if (undoBtn) undoBtn.disabled = HISTORY.undo.length === 0;
        if (redoBtn) redoBtn.disabled = HISTORY.redo.length === 0;
        if (undoLbl) undoLbl.textContent = HISTORY.undo.length ? String(HISTORY.undo.length) : '';
        if (redoLbl) redoLbl.textContent = HISTORY.redo.length ? String(HISTORY.redo.length) : '';
    }

    async function runHistory(entry, stackFrom, stackTo) {
        historyRecording = false;
        try {
            await entry.apply();
            stackFrom.pop();
            stackTo.push(entry);
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message || 'Operasi gagal', 'error');
            await reloadActiveSheet();
            paintMatrixScreen();
        } finally {
            historyRecording = true;
            updateUndoRedoUI();
        }
    }

    window.matrixUndo = async function () {
        const entry = HISTORY.undo[HISTORY.undo.length - 1];
        if (!entry) return;
        await runHistory({ ...entry, apply: entry.undo, label: 'Undo: ' + entry.desc }, HISTORY.undo, HISTORY.redo);
    };

    window.matrixRedo = async function () {
        const entry = HISTORY.redo[HISTORY.redo.length - 1];
        if (!entry) return;
        await runHistory({ ...entry, apply: entry.redo, label: 'Redo: ' + entry.desc }, HISTORY.redo, HISTORY.undo);
    };

    function renderDashboard(summary) {
        const cards = [
            { label: 'Total Baris', value: summary.totalRows, color: '#E50914' },
            { label: 'Kolom', value: summary.totalCols, color: '#4A90D9' },
            { label: 'Personel Unik', value: summary.uniquePersonnel, color: '#46D369' },
            { label: 'Kadaluarsa ≤30 hari', value: summary.expiringSoon, color: '#F5A623' },
            { label: 'Sudah Expired', value: summary.expired, color: '#e74c3c' },
            { label: 'Field Wajib Kosong', value: summary.missingRequired, color: '#9b59b6' },
        ];
        if (summary.gender.Male + summary.gender.Female + summary.gender.Other > 0) {
            cards.push({
                label: 'Gender (M/F/L)',
                value: `${summary.gender.Male}/${summary.gender.Female}/${summary.gender.Other}`,
                color: '#1abc9c',
            });
        }
        return `<div class="ex-kpi-strip">${cards.map(c => `
            <div class="ex-kpi" style="--kpi-color:${c.color}">
                <span>${esc(c.label)}</span>
                <strong>${esc(c.value)}</strong>
            </div>`).join('')}</div>`;
    }

    function renderToolbar(sheet) {
        const tabOptions = MATRIX_STATE.workbook.sheets.map(s => {
            const lbl = TAB_LABELS[s.id] || s.title || s.name;
            const sel = s.id === sheet.id ? 'selected' : '';
            return `<option value="${esc(s.id)}" ${sel}>${esc(lbl)}</option>`;
        }).join('');

        return `
        <div class="mx-toolbar-card">
            <div class="mx-toolbar-row">
                <select id="mx-tab-select" class="form-input mx-select" onchange="matrixOnTabChange(this.value)">${tabOptions}</select>
                <input type="search" id="mx-search" class="form-input mx-search" placeholder="Cari data..." value="${esc(MATRIX_STATE.search)}" oninput="matrixOnSearchInput(this.value)" />
            </div>
            <div class="mx-toolbar-row mx-toolbar-actions">
                <div class="mx-btn-group">
                    <button type="button" id="mx-btn-undo" class="mx-btn mx-btn-ghost" onclick="matrixUndo()" title="Undo (Ctrl+Z)" disabled>
                        ↩ Undo <span id="mx-undo-count" class="mx-badge"></span>
                    </button>
                    <button type="button" id="mx-btn-redo" class="mx-btn mx-btn-ghost" onclick="matrixRedo()" title="Redo (Ctrl+Shift+Z)" disabled>
                        ↪ Redo <span id="mx-redo-count" class="mx-badge"></span>
                    </button>
                </div>
                <div class="mx-btn-group">
                    <button type="button" class="mx-btn mx-btn-primary" onclick="matrixAddRow()">+ Baris</button>
                    <button type="button" class="mx-btn mx-btn-secondary" onclick="matrixAddColumn()">+ Kolom</button>
                    <button type="button" class="mx-btn mx-btn-secondary" onclick="matrixReload()">↻ Muat Ulang</button>
                </div>
            </div>
        </div>`;
    }

    function renderTable(sheet, rows) {
        const cols = sheet.columns || [];
        const head = cols.map(c => `
            <th class="mx-th">
                <div class="mx-th-inner">
                    <span title="${esc(c.label)}">${esc(c.label.replace(/\*/g, ''))}</span>
                    <div class="mx-th-actions">
                        <button type="button" title="Edit kolom" onclick="matrixEditColumn('${esc(sheet.id)}','${esc(c.id)}')">✎</button>
                        <button type="button" title="Hapus kolom" onclick="matrixDeleteColumn('${esc(sheet.id)}','${esc(c.id)}')">×</button>
                    </div>
                </div>
            </th>`).join('') + '<th class="mx-th mx-th-sticky">Aksi</th>';

        const body = rows.map(row => {
            const cells = cols.map(c => {
                const val = row.cells?.[c.id] ?? '';
                const inputType = c.type === 'date' ? 'date' : (c.type === 'number' ? 'number' : 'text');
                return `<td class="mx-td">
                    <input class="mx-cell-input" type="${inputType}" value="${esc(val)}"
                        data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(c.id)}"
                        onfocus="this.dataset.prev=this.value"
                        onchange="matrixOnCellChange(this)" />
                </td>`;
            }).join('');
            return `<tr data-row-id="${esc(row.id)}">${cells}
                <td class="mx-td mx-td-actions">
                    <button type="button" class="mx-btn mx-btn-danger-sm" onclick="matrixDeleteRow('${esc(sheet.id)}','${esc(row.id)}')">Hapus</button>
                </td></tr>`;
        }).join('');

        return `
        <div class="mx-table-card">
            <div class="mx-table-wrap">
                <table class="mx-data-table">
                    <thead><tr>${head}</tr></thead>
                    <tbody>${body || `<tr><td colspan="${cols.length + 1}" class="mx-empty-row">Tidak ada baris.</td></tr>`}</tbody>
                </table>
            </div>
        </div>`;
    }

    function paintMatrixScreen() {
        const root = document.getElementById('matrix-content');
        if (!root) return;

        if (!document.body.classList.contains('admin-mode')) {
            root.innerHTML = `<div class="mx-locked"><p>🔒 Matrix hanya tersedia dalam <strong>Admin Mode</strong>.</p><p class="mx-muted">Login admin dari menu drawer.</p></div>`;
            return;
        }

        const sheet = activeSheet();
        if (!sheet) {
            root.innerHTML = '<div class="mx-empty">Workbook kosong.</div>';
            return;
        }

        const summary = computeSheetSummary(sheet);
        const rows = filterRows(sheet);
        const tabLabel = TAB_LABELS[sheet.id] || sheet.title || sheet.name;

        root.innerHTML = `
            <div class="mx-page">
                <header class="ex-stats-header mx-header">
                    <div class="ex-stats-title-row">
                        <svg viewBox="0 0 24 24" fill="var(--netflix-red)" width="26" height="26" aria-hidden="true">
                            <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>
                        </svg>
                        <div>
                            <h2 class="mx-title">${esc(sheet.title || tabLabel)}</h2>
                            <p class="mx-subtitle">${esc(sheet.name)} · ${rows.length} dari ${sheet.rows.length} baris ditampilkan</p>
                        </div>
                    </div>
                </header>
                ${renderDashboard(summary)}
                ${renderToolbar(sheet)}
                ${renderTable(sheet, rows)}
            </div>`;
        updateUndoRedoUI();
    }

    window.matrixOnTabChange = function (sheetId) {
        MATRIX_STATE.activeSheetId = sheetId;
        MATRIX_STATE.search = '';
        clearHistory();
        paintMatrixScreen();
    };

    window.matrixOnSearchInput = function (val) {
        MATRIX_STATE.search = val;
        paintMatrixScreen();
    };

    window.matrixOnCellChange = async function (input) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const oldVal = input.dataset.prev ?? '';
        const newVal = input.value;
        if (oldVal === newVal) return;

        try {
            await applyCellUpdate(sheetId, rowId, colId, newVal);
            input.dataset.prev = newVal;
            pushHistory({
                desc: 'Edit sel',
                undo: async () => { await applyCellUpdate(sheetId, rowId, colId, oldVal); },
                redo: async () => { await applyCellUpdate(sheetId, rowId, colId, newVal); },
            });
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || 'Gagal menyimpan', 'error');
        }
    };

    window.matrixAddRow = async function () {
        const sheet = activeSheet();
        if (!sheet) return;
        try {
            const row = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/rows`, { cells: {} });
            sheet.rows.push(row);
            const ref = { id: row.id, cells: row.cells || {} };
            pushHistory({
                desc: 'Tambah baris',
                undo: async () => {
                    await matrixRequest('DELETE', `/matrix/sheets/${sheet.id}/rows/${ref.id}`);
                    sheet.rows = sheet.rows.filter(r => r.id !== ref.id);
                },
                redo: async () => {
                    const restored = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/rows`, { cells: ref.cells });
                    ref.id = restored.id;
                    sheet.rows.push(restored);
                },
            });
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixDeleteRow = async function (sheetId, rowId) {
        if (!confirm('Hapus baris ini?')) return;
        const sheet = sheetById(sheetId);
        const row = sheet?.rows?.find(r => r.id === rowId);
        if (!row) return;
        const snap = clone(row);
        const ref = { restoredId: null };
        try {
            await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${rowId}`);
            sheet.rows = sheet.rows.filter(r => r.id !== rowId);
            pushHistory({
                desc: 'Hapus baris',
                undo: async () => {
                    const restored = await matrixRequest('POST', `/matrix/sheets/${sheetId}/rows`, { cells: snap.cells || {} });
                    ref.restoredId = restored.id;
                    sheet.rows.push(restored);
                },
                redo: async () => {
                    if (!ref.restoredId) return;
                    await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${ref.restoredId}`);
                    sheet.rows = sheet.rows.filter(r => r.id !== ref.restoredId);
                    ref.restoredId = null;
                },
            });
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixAddColumn = async function () {
        const sheet = activeSheet();
        if (!sheet) return;
        const label = prompt('Nama kolom baru:', 'Kolom Baru');
        if (!label) return;
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
                label, type: 'text', filterable: true,
            });
            sheet.columns.push(col);
            sheet.rows.forEach(r => { r.cells[col.id] = ''; });
            const colSnap = clone(col);
            pushHistory({
                desc: 'Tambah kolom',
                undo: async () => {
                    await matrixRequest('DELETE', `/matrix/sheets/${sheet.id}/columns/${colSnap.id}`);
                    await reloadActiveSheet();
                },
                redo: async () => {
                    const c = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
                        label: colSnap.label, type: colSnap.type || 'text', filterable: colSnap.filterable !== false,
                    });
                    await reloadActiveSheet();
                },
            });
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixEditColumn = async function (sheetId, colId) {
        const sheet = sheetById(sheetId);
        const col = sheet?.columns?.find(c => c.id === colId);
        if (!col) return;
        const oldLabel = col.label;
        const label = prompt('Label kolom:', oldLabel);
        if (!label || label === oldLabel) return;
        try {
            const updated = await matrixRequest('PUT', `/matrix/sheets/${sheetId}/columns/${colId}`, { label });
            Object.assign(col, updated);
            pushHistory({
                desc: 'Edit kolom',
                undo: async () => {
                    const u = await matrixRequest('PUT', `/matrix/sheets/${sheetId}/columns/${colId}`, { label: oldLabel });
                    Object.assign(col, u);
                },
                redo: async () => {
                    const u = await matrixRequest('PUT', `/matrix/sheets/${sheetId}/columns/${colId}`, { label });
                    Object.assign(col, u);
                },
            });
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixDeleteColumn = async function (sheetId, colId) {
        if (!confirm('Hapus kolom ini dari semua baris?')) return;
        const sheet = sheetById(sheetId);
        const col = sheet?.columns?.find(c => c.id === colId);
        if (!col) return;
        const colSnap = clone(col);
        const cellsSnap = {};
        sheet.rows.forEach(r => { cellsSnap[r.id] = r.cells?.[colId] ?? ''; });
        try {
            await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/columns/${colId}`);
            await reloadActiveSheet();
            pushHistory({
                desc: 'Hapus kolom',
                undo: async () => {
                    const newCol = await matrixRequest('POST', `/matrix/sheets/${sheetId}/columns`, {
                        label: colSnap.label,
                        type: colSnap.type || 'text',
                        filterable: colSnap.filterable !== false,
                    });
                    await reloadActiveSheet();
                    const fresh = sheetById(sheetId);
                    for (const [rowId, val] of Object.entries(cellsSnap)) {
                        if (fresh?.rows?.some(r => r.id === rowId)) {
                            await applyCellUpdate(sheetId, rowId, newCol.id, val);
                        }
                    }
                    await reloadActiveSheet();
                },
                redo: async () => {
                    const fresh = sheetById(sheetId);
                    const c = fresh?.columns?.find(x => x.label === colSnap.label);
                    if (c) {
                        await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/columns/${c.id}`);
                        await reloadActiveSheet();
                    }
                },
            });
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixReload = async function () {
        clearHistory();
        await window.loadMatrixWorkbook(true);
    };

    window.loadMatrixWorkbook = async function (silent) {
        const root = document.getElementById('matrix-content');
        if (!root) return;
        if (!document.body.classList.contains('admin-mode')) {
            paintMatrixScreen();
            return;
        }
        if (!silent) root.innerHTML = '<div class="mx-loading">Memuat Matrix...</div>';
        try {
            MATRIX_STATE.loading = true;
            MATRIX_STATE.workbook = await fetchWorkbook();
            if (!MATRIX_STATE.activeSheetId && MATRIX_STATE.workbook.sheets?.length) {
                MATRIX_STATE.activeSheetId = MATRIX_STATE.workbook.sheets[0].id;
            }
            if (!silent) clearHistory();
            paintMatrixScreen();
        } catch (e) {
            root.innerHTML = `<div class="mx-empty">Gagal memuat: ${esc(e.message)}</div>`;
            showToast?.(e.message, 'error');
        } finally {
            MATRIX_STATE.loading = false;
        }
    };

    window.renderMatrixScreen = function () {
        if (MATRIX_STATE.workbook) paintMatrixScreen();
        else loadMatrixWorkbook();
    };

    document.addEventListener('keydown', (e) => {
        if (!document.getElementById('screen-matrix')?.classList.contains('active')) return;
        if (!document.body.classList.contains('admin-mode')) return;
        if (e.target?.id === 'mx-search') return;
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            matrixUndo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
            e.preventDefault();
            matrixRedo();
        }
    });
})();
