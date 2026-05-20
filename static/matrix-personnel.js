/**
 * HSE Personnel Matrix — Excel tabs with dashboard, dynamic filters, full CRUD.
 */
(function () {
    const MATRIX_STATE = {
        workbook: null,
        activeSheetId: null,
        search: '',
        filters: {},
        loading: false,
    };

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

    function apiBase() {
        return typeof API_BASE !== 'undefined' ? API_BASE : '';
    }

    function activeSheet() {
        if (!MATRIX_STATE.workbook) return null;
        return MATRIX_STATE.workbook.sheets.find(s => s.id === MATRIX_STATE.activeSheetId)
            || MATRIX_STATE.workbook.sheets[0]
            || null;
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
        const personnelCol = cols.find(c => /personnel name/i.test(c.label));

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

        const uniquePersonnel = personnelCol
            ? new Set(rows.map(r => (r.cells?.[personnelCol.id] || '').trim()).filter(Boolean)).size
            : rows.length;

        return {
            totalRows: rows.length,
            totalCols: cols.length,
            missingRequired,
            expiringSoon,
            expired,
            gender,
            uniquePersonnel,
        };
    }

    function filterRows(sheet) {
        const q = MATRIX_STATE.search.trim().toLowerCase();
        const filters = MATRIX_STATE.filters;
        return (sheet.rows || []).filter(row => {
            if (q) {
                const hay = Object.values(row.cells || {}).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            for (const [colId, val] of Object.entries(filters)) {
                if (!val) continue;
                const cell = (row.cells?.[colId] || '').trim();
                if (cell !== val) return false;
            }
            return true;
        });
    }

    function filterOptions(sheet, col) {
        const vals = new Set();
        (sheet.rows || []).forEach(row => {
            const v = (row.cells?.[col.id] || '').trim();
            if (v) vals.add(v);
        });
        return Array.from(vals).sort((a, b) => a.localeCompare(b));
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

    function syncSheetInWorkbook(sheet) {
        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === sheet.id);
        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = sheet;
    }

    async function reloadActiveSheet() {
        const sheet = activeSheet();
        if (!sheet) return;
        const fresh = await matrixRequest('GET', `/matrix/sheets/${sheet.id}`);
        syncSheetInWorkbook(fresh);
    }

    function renderDashboard(sheet, summary) {
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
        return `<div class="mx-dash-grid">${cards.map(c => `
            <div class="mx-dash-card" style="--mx-color:${c.color}">
                <span>${esc(c.label)}</span>
                <strong>${esc(c.value)}</strong>
            </div>`).join('')}</div>`;
    }

    function renderFilterBar(sheet) {
        const tabOptions = MATRIX_STATE.workbook.sheets.map(s => {
            const lbl = TAB_LABELS[s.id] || s.title || s.name;
            const sel = s.id === sheet.id ? 'selected' : '';
            return `<option value="${esc(s.id)}" ${sel}>${esc(lbl)}</option>`;
        }).join('');

        return `
        <div class="mx-toolbar">
            <select id="mx-tab-select" class="form-input" onchange="matrixOnTabChange(this.value)">${tabOptions}</select>
            <input type="search" id="mx-search" class="form-input" placeholder="Cari di tab ini..." value="${esc(MATRIX_STATE.search)}" oninput="matrixOnSearchInput(this.value)" />
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
            </th>`).join('') + '<th class="mx-th mx-th-actions-col">Aksi</th>';

        const body = rows.map(row => {
            const cells = cols.map(c => {
                const val = row.cells?.[c.id] ?? '';
                const inputType = c.type === 'date' ? 'date' : (c.type === 'number' ? 'number' : 'text');
                return `<td class="mx-td">
                    <input class="mx-cell-input" type="${inputType}" value="${esc(val)}"
                        data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(c.id)}"
                        onchange="matrixOnCellChange(this)" />
                </td>`;
            }).join('');
            return `<tr data-row-id="${esc(row.id)}">${cells}
                <td class="mx-td mx-td-actions">
                    <button type="button" class="delete-btn" onclick="matrixDeleteRow('${esc(sheet.id)}','${esc(row.id)}')">Hapus</button>
                </td></tr>`;
        }).join('');

        return `
        <div class="mx-table-wrap">
            <table class="mx-data-table">
                <thead><tr>${head}</tr></thead>
                <tbody>${body || `<tr><td colspan="${cols.length + 1}" class="mx-empty">Tidak ada baris (sesuai filter).</td></tr>`}</tbody>
            </table>
        </div>`;
    }

    function paintMatrixScreen() {
        const root = document.getElementById('matrix-content');
        if (!root) return;

        if (!document.body.classList.contains('admin-mode')) {
            root.innerHTML = `<div class="mx-locked"><p>🔒 Matrix hanya tersedia dalam <strong>Admin Mode</strong>.</p><p style="font-size:12px;color:var(--text-muted);">Login admin dari menu drawer untuk mengakses data personel PTS Wells.</p></div>`;
            return;
        }

        const sheet = activeSheet();
        if (!sheet) {
            root.innerHTML = '<div class="mx-empty">Workbook kosong. Jalankan import Excel.</div>';
            return;
        }

        const summary = computeSheetSummary(sheet);
        const rows = filterRows(sheet);

        root.innerHTML = `
            <div class="mx-page">
                <div class="mx-header-meta">
                    <h3>${esc(sheet.title || sheet.name)}</h3>
                    <p>${esc(sheet.name)} · ${rows.length} / ${sheet.rows.length} baris ditampilkan</p>
                </div>
                ${renderDashboard(sheet, summary)}
                ${renderFilterBar(sheet)}
                <div class="mx-actions">
                    <button type="button" class="btn btn-save" onclick="matrixAddRow()">+ Baris</button>
                    <button type="button" class="btn btn-cancel" onclick="matrixAddColumn()">+ Kolom</button>
                    <button type="button" class="btn btn-cancel" onclick="matrixReload()">🔄 Muat Ulang</button>
                </div>
                ${renderTable(sheet, rows)}
            </div>`;
    }

    window.matrixOnTabChange = function (sheetId) {
        MATRIX_STATE.activeSheetId = sheetId;
        MATRIX_STATE.filters = {};
        MATRIX_STATE.search = '';
        paintMatrixScreen();
    };

    window.matrixOnSearchInput = function (val) {
        MATRIX_STATE.search = val;
        paintMatrixScreen();
    };

    window.matrixOnFilterChange = function (el) {
        const colId = el.dataset.col;
        if (el.value) MATRIX_STATE.filters[colId] = el.value;
        else delete MATRIX_STATE.filters[colId];
        paintMatrixScreen();
    };

    window.matrixClearFilters = function () {
        MATRIX_STATE.filters = {};
        MATRIX_STATE.search = '';
        paintMatrixScreen();
    };

    window.matrixOnCellChange = async function (input) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        try {
            await matrixRequest('PUT', `/matrix/sheets/${sheetId}/rows/${rowId}`, {
                cells: { [colId]: input.value },
            });
            const sheet = MATRIX_STATE.workbook.sheets.find(s => s.id === sheetId);
            const row = sheet?.rows?.find(r => r.id === rowId);
            if (row) row.cells[colId] = input.value;
        } catch (e) {
            showToast?.(e.message || 'Gagal menyimpan', 'error');
            await matrixReload();
        }
    };

    window.matrixAddRow = async function () {
        const sheet = activeSheet();
        if (!sheet) return;
        try {
            const row = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/rows`, { cells: {} });
            sheet.rows.push(row);
            paintMatrixScreen();
            showToast?.('Baris ditambahkan', 'success');
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixDeleteRow = async function (sheetId, rowId) {
        if (!confirm('Hapus baris ini?')) return;
        try {
            await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${rowId}`);
            const sheet = MATRIX_STATE.workbook.sheets.find(s => s.id === sheetId);
            if (sheet) sheet.rows = sheet.rows.filter(r => r.id !== rowId);
            paintMatrixScreen();
            showToast?.('Baris dihapus', 'success');
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
                label,
                type: 'text',
                filterable: true,
            });
            sheet.columns.push(col);
            sheet.rows.forEach(r => { r.cells[col.id] = ''; });
            paintMatrixScreen();
            showToast?.('Kolom ditambahkan', 'success');
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixEditColumn = async function (sheetId, colId) {
        const sheet = MATRIX_STATE.workbook.sheets.find(s => s.id === sheetId);
        const col = sheet?.columns?.find(c => c.id === colId);
        if (!col) return;
        const label = prompt('Label kolom:', col.label);
        if (!label) return;
        try {
            const updated = await matrixRequest('PUT', `/matrix/sheets/${sheetId}/columns/${colId}`, { label });
            Object.assign(col, updated);
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixDeleteColumn = async function (sheetId, colId) {
        if (!confirm('Hapus kolom ini dari semua baris?')) return;
        try {
            await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/columns/${colId}`);
            await reloadActiveSheet();
            paintMatrixScreen();
            showToast?.('Kolom dihapus', 'success');
        } catch (e) {
            showToast?.(e.message, 'error');
        }
    };

    window.matrixReload = async function () {
        await window.loadMatrixWorkbook(true);
    };

    window.loadMatrixWorkbook = async function (silent) {
        const root = document.getElementById('matrix-content');
        if (!root) return;
        if (!document.body.classList.contains('admin-mode')) {
            paintMatrixScreen();
            return;
        }
        if (!silent) root.innerHTML = '<div class="mx-loading">Memuat Matrix PTS Wells...</div>';
        try {
            MATRIX_STATE.loading = true;
            MATRIX_STATE.workbook = await fetchWorkbook();
            if (!MATRIX_STATE.activeSheetId && MATRIX_STATE.workbook.sheets?.length) {
                MATRIX_STATE.activeSheetId = MATRIX_STATE.workbook.sheets[0].id;
            }
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
})();
