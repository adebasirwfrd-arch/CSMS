/**
 * HSE Personnel Matrix — CRUD, undo/redo, profile sidebar, photo upload.
 */
(function () {
    const PROFILE_SHEET_ID = 'personnel_data_information';
    const PHOTO_COL_ID = 'col_photo';
    const AVATAR_MALE = '/static/images/matrix-avatar-male.png';
    const AVATAR_FEMALE = '/static/images/matrix-avatar-female.png';

    const MATRIX_STATE = {
        workbook: null,
        activeSheetId: null,
        search: '',
        filters: {},
        loading: false,
        selectedRowId: null,
        sidebarTab: PROFILE_SHEET_ID,
        filterClientId: 'ALL',
        filterProductLineId: '',
        filterProjectId: 'ALL',
        clients: [],
        productLines: [],
        projects: [],
    };

    const STANDARD_COLUMN_SPECS = [
        { label: 'Personnel Name*', type: 'text', match: /personnel name/i },
        { label: 'Position*', type: 'text', match: /position/i },
        { label: 'Product Line*', type: 'select', match: /product line/i },
        { label: 'Client', type: 'text', match: /^client$/i },
        { label: 'Project', type: 'text', match: /^project$/i },
    ];

    const HISTORY = { undo: [], redo: [] };
    let historyRecording = true;

    const TAB_LABELS = {
        employee_mandatory_training: 'Pelatihan Wajib',
        personnel_health: 'Kesehatan Personel',
        personnel_data_information: 'Data Personel',
        contract_information: 'Kontrak',
        emergency_contact_information: 'Kontak Darurat',
    };

    const SIDEBAR_SHEET_ORDER = [
        'employee_mandatory_training',
        'personnel_health',
        'personnel_data_information',
        'contract_information',
        'emergency_contact_information',
    ];

    const SIDEBAR_TABS = SIDEBAR_SHEET_ORDER.map(id => ({ id, label: TAB_LABELS[id] }));

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

    function getColByLabel(sheet, pattern) {
        return (sheet?.columns || []).find(c => pattern.test(c.label));
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

    function isFemale(gender) {
        return /female|wanita|perempuan|f\b/i.test(String(gender || '').trim());
    }

    function defaultAvatar(gender) {
        return isFemale(gender) ? AVATAR_FEMALE : AVATAR_MALE;
    }

    function photoViewUrl(fileId) {
        if (!fileId) return '';
        return `${apiBase()}/matrix/profile-photo/view/${encodeURIComponent(fileId)}`;
    }

    function getPersonnelNameCol(sheet) {
        return getColByLabel(sheet, /personnel name/i);
    }

    function getPositionCol(sheet) {
        return getColByLabel(sheet, /position/i);
    }

    function getProductLineCol(sheet) {
        return getColByLabel(sheet, /product line/i);
    }

    function getClientCol(sheet) {
        return getColByLabel(sheet, /^client/i);
    }

    function getProjectCol(sheet) {
        return getColByLabel(sheet, /^project/i);
    }

    function isAllClients() {
        return !MATRIX_STATE.filterClientId || MATRIX_STATE.filterClientId === 'ALL';
    }

    function getSelectedProductLineName() {
        const pl = MATRIX_STATE.productLines.find(p => String(p.id) === String(MATRIX_STATE.filterProductLineId));
        return (pl?.name || '').trim();
    }

    function getSelectedClientName() {
        const c = MATRIX_STATE.clients.find(x => String(x.id) === String(MATRIX_STATE.filterClientId));
        return (c?.name || '').trim();
    }

    function isAllProjects() {
        return !MATRIX_STATE.filterProjectId || MATRIX_STATE.filterProjectId === 'ALL';
    }

    function getSelectedProjectName() {
        const p = MATRIX_STATE.projects.find(x => String(x.id) === String(MATRIX_STATE.filterProjectId));
        return (p?.name || '').trim();
    }

    function getFilteredProjects() {
        let list = [...(MATRIX_STATE.projects || [])];
        if (!isAllClients()) {
            list = list.filter(p => String(p.client_id) === String(MATRIX_STATE.filterClientId));
        }
        if (MATRIX_STATE.filterProductLineId) {
            list = list.filter(p => String(p.product_line_id) === String(MATRIX_STATE.filterProductLineId));
        }
        return list.sort((a, b) => {
            const da = new Date(a.created_at || a.updated_at || 0).getTime();
            const db = new Date(b.created_at || b.updated_at || 0).getTime();
            return db - da;
        });
    }

    function getDisplayColumns(sheet) {
        let cols = [...(sheet.columns || [])];
        cols = cols.filter(c => {
            const label = c.label.replace(/\*/g, '').trim().toLowerCase();
            return label !== 'client' && label !== 'project';
        });

        const nameCol = getPersonnelNameCol(sheet);
        const posCol = getPositionCol(sheet);
        const plCol = getProductLineCol(sheet);
        const photoCol = sheet.id === PROFILE_SHEET_ID ? getPhotoCol(sheet) : null;
        const noCol = getColByExactLabel(sheet, 'No');

        const pinned = new Set();
        const ordered = [];
        if (noCol) { ordered.push(noCol); pinned.add(noCol.id); }
        if (nameCol) { ordered.push(nameCol); pinned.add(nameCol.id); }
        if (photoCol) { ordered.push(photoCol); pinned.add(photoCol.id); }
        if (posCol && !pinned.has(posCol.id)) { ordered.push(posCol); pinned.add(posCol.id); }
        if (plCol && !pinned.has(plCol.id)) { ordered.push(plCol); pinned.add(plCol.id); }

        cols.forEach(c => {
            if (!pinned.has(c.id)) ordered.push(c);
        });
        return ordered;
    }

    function getColByExactLabel(sheet, label) {
        const target = label.toLowerCase();
        return (sheet?.columns || []).find(c => c.label.replace(/\*/g, '').trim().toLowerCase() === target);
    }

    function getPersonnelKeys(profileRow) {
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        const ktpCol = getColByLabel(profileSheet, /ktp/i);
        const nameCol = getColByLabel(profileSheet, /personnel name/i);
        return {
            ktp: ktpCol ? (profileRow?.cells?.[ktpCol.id] || '').trim() : '',
            name: nameCol ? (profileRow?.cells?.[nameCol.id] || '').trim() : '',
        };
    }

    function findRowInSheet(targetSheet, profileRow) {
        if (!targetSheet || !profileRow) return null;
        if (targetSheet.id === PROFILE_SHEET_ID) return profileRow;

        const { ktp, name } = getPersonnelKeys(profileRow);
        const ktpCol = getColByLabel(targetSheet, /ktp/i);
        const nameCol = getColByLabel(targetSheet, /personnel name/i);

        if (ktp && ktpCol) {
            const byKtp = targetSheet.rows.find(r => (r.cells?.[ktpCol.id] || '').trim() === ktp);
            if (byKtp) return byKtp;
        }
        if (name && nameCol) {
            const nl = name.toLowerCase();
            const byName = targetSheet.rows.find(r =>
                (r.cells?.[nameCol.id] || '').trim().toLowerCase() === nl
            );
            if (byName) return byName;
        }

        if (targetSheet.id === 'contract_information') {
            const trainingSheet = sheetById('employee_mandatory_training');
            if (trainingSheet) {
                const trainingRow = findRowInSheet(trainingSheet, profileRow);
                if (trainingRow) {
                    const noCol = getColByExactLabel(trainingSheet, 'No');
                    const noVal = noCol ? (trainingRow.cells?.[noCol.id] || '').trim() : '';
                    if (noVal) {
                        const contractNoCol = getColByExactLabel(targetSheet, 'No');
                        if (contractNoCol) {
                            const byNo = targetSheet.rows.find(r =>
                                (r.cells?.[contractNoCol.id] || '').trim() === noVal
                            );
                            if (byNo) return byNo;
                        }
                    }
                    const hbCol = getColByLabel(trainingSheet, /home base/i);
                    const wlCol = getColByLabel(trainingSheet, /working location/i);
                    const hb = hbCol ? (trainingRow.cells?.[hbCol.id] || '').trim() : '';
                    const wl = wlCol ? (trainingRow.cells?.[wlCol.id] || '').trim() : '';
                    if (hb || wl) {
                        const cHb = getColByLabel(targetSheet, /home base/i);
                        const cWl = getColByLabel(targetSheet, /working location/i);
                        const byLoc = targetSheet.rows.find(r => {
                            const matchHb = !hb || !cHb || (r.cells?.[cHb.id] || '').trim() === hb;
                            const matchWl = !wl || !cWl || (r.cells?.[cWl.id] || '').trim() === wl;
                            return matchHb && matchWl;
                        });
                        if (byLoc) return byLoc;
                    }
                }
            }
        }

        return null;
    }

    function findPersonnelProfileRow(sheet, row) {
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        if (!profileSheet || !row) return row;
        if (sheet?.id === PROFILE_SHEET_ID) return row;

        const ktpCol = getColByLabel(sheet, /ktp/i);
        const nameCol = getColByLabel(sheet, /personnel name/i);
        const ktp = ktpCol ? (row.cells?.[ktpCol.id] || '').trim() : '';
        const name = nameCol ? (row.cells?.[nameCol.id] || '').trim() : '';

        const profileKtpCol = getColByLabel(profileSheet, /ktp/i);
        const profileNameCol = getColByLabel(profileSheet, /personnel name/i);

        if (ktp && profileKtpCol) {
            const match = profileSheet.rows.find(r => (r.cells?.[profileKtpCol.id] || '').trim() === ktp);
            if (match) return match;
        }
        if (name && profileNameCol) {
            const nl = name.toLowerCase();
            const match = profileSheet.rows.find(r =>
                (r.cells?.[profileNameCol.id] || '').trim().toLowerCase() === nl
            );
            if (match) return match;
        }
        return row;
    }

    function getPhotoCol(sheet) {
        return (sheet?.columns || []).find(c => c.type === 'image' || /profile photo/i.test(c.label) || c.id === PHOTO_COL_ID);
    }

    function photoColId(sheet) {
        return getPhotoCol(sheet)?.id || PHOTO_COL_ID;
    }

    function profilePhotoFileId(profileRow) {
        if (!profileRow) return '';
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        const cid = photoColId(profileSheet);
        return (profileRow.cells?.[cid] || '').trim();
    }

    function profileGender(profileRow) {
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        const genderCol = getColByLabel(profileSheet, /gender/i);
        return genderCol ? (profileRow?.cells?.[genderCol.id] || '') : '';
    }

    function profileName(profileRow) {
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        const nameCol = getColByLabel(profileSheet, /personnel name/i);
        return nameCol ? (profileRow?.cells?.[nameCol.id] || '').trim() : '';
    }

    function avatarSrcForProfile(profileRow) {
        const fileId = profilePhotoFileId(profileRow);
        if (fileId) return photoViewUrl(fileId);
        return defaultAvatar(profileGender(profileRow));
    }

    function normalizePersonnelName(name) {
        return (name || '').trim().toLowerCase();
    }

    function personnelRowKey(sheet, row) {
        const nameCol = getPersonnelNameCol(sheet);
        const plCol = getProductLineCol(sheet);
        const name = nameCol ? (row.cells?.[nameCol.id] || '').trim() : '';
        if (!name) return null;
        const pl = plCol ? (row.cells?.[plCol.id] || '').trim() : getSelectedProductLineName();
        return `${normalizePersonnelName(name)}::${(pl || '').toLowerCase()}`;
    }

    function isMasterRow(sheet, row) {
        const clientCol = getClientCol(sheet);
        if (!clientCol) return true;
        return !(row.cells?.[clientCol.id] || '').trim();
    }

    function rowDataScore(row) {
        return Object.values(row?.cells || {}).filter(v => String(v).trim()).length;
    }

    function findMasterPersonnelRow(sheet, personnelName, plName) {
        const nameCol = getPersonnelNameCol(sheet);
        if (!nameCol || !personnelName) return null;
        const nl = normalizePersonnelName(personnelName);
        const candidates = (sheet?.rows || []).filter(r => {
            const n = (r.cells?.[nameCol.id] || '').trim();
            if (normalizePersonnelName(n) !== nl) return false;
            const plCol = getProductLineCol(sheet);
            if (plCol && plName) {
                const rowPl = (r.cells?.[plCol.id] || '').trim();
                if (rowPl && rowPl !== plName) return false;
            }
            return true;
        });
        return candidates.find(r => isMasterRow(sheet, r))
            || candidates.sort((a, b) => rowDataScore(b) - rowDataScore(a))[0]
            || null;
    }

    function dedupeRowsForAllView(sheet, rows) {
        if (!isAllClients()) return rows;
        const byKey = new Map();
        const unnamed = [];
        rows.forEach(row => {
            const key = personnelRowKey(sheet, row);
            if (!key) {
                unnamed.push(row);
                return;
            }
            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, row);
                return;
            }
            const keepExisting = isMasterRow(sheet, existing) && !isMasterRow(sheet, row);
            const keepNew = isMasterRow(sheet, row) && !isMasterRow(sheet, existing);
            if (keepNew || (!keepExisting && rowDataScore(row) > rowDataScore(existing))) {
                byKey.set(key, row);
            }
        });
        return [...byKey.values(), ...unnamed];
    }

    async function dedupeSheetPersonnel(sheetId) {
        const sheet = sheetById(sheetId);
        if (!sheet) return;
        const seen = new Map();
        for (const row of [...(sheet.rows || [])]) {
            const key = personnelRowKey(sheet, row);
            if (!key) continue;
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, row);
                continue;
            }
            let keep = existing;
            let drop = row;
            if (isMasterRow(sheet, row) && !isMasterRow(sheet, existing)) {
                keep = row;
                drop = existing;
                seen.set(key, keep);
            } else if (rowDataScore(row) > rowDataScore(existing) && !isMasterRow(sheet, existing)) {
                keep = row;
                drop = existing;
                seen.set(key, keep);
            }
            try {
                await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${drop.id}`);
                sheet.rows = sheet.rows.filter(r => r.id !== drop.id);
            } catch (e) {
                console.warn('dedupeSheetPersonnel:', e.message);
            }
        }
    }

    async function dedupeAllPersonnelInWorkbook() {
        for (const sheet of MATRIX_STATE.workbook?.sheets || []) {
            await dedupeSheetPersonnel(sheet.id);
        }
    }

    async function cleanupDuplicatePersonnelRows(sheetId, personnelName) {
        const sheet = sheetById(sheetId);
        if (!sheet || !personnelName) return;
        const plName = getSelectedProductLineName();
        const master = findMasterPersonnelRow(sheet, personnelName, plName);
        if (!master) return;
        const key = personnelRowKey(sheet, master);
        const dupes = (sheet.rows || []).filter(r => r.id !== master.id && personnelRowKey(sheet, r) === key);
        for (const d of dupes) {
            await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${d.id}`);
            sheet.rows = sheet.rows.filter(r => r.id !== d.id);
        }
    }

    function computeSheetSummary(sheet) {
        const rows = filterRows(sheet);
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

    function rowMatchesFilters(sheet, row) {
        const plName = getSelectedProductLineName();
        const plCol = getProductLineCol(sheet);

        if (MATRIX_STATE.filterProductLineId && plCol) {
            const rowPl = (row.cells?.[plCol.id] || '').trim();
            if (rowPl !== plName) return false;
        }

        if (!isAllClients()) {
            const clientCol = getClientCol(sheet);
            const clientName = getSelectedClientName();
            if (!clientCol || !clientName) return false;
            if ((row.cells?.[clientCol.id] || '').trim() !== clientName) return false;
        }

        if (!isAllProjects()) {
            const projectCol = getProjectCol(sheet);
            const projectName = getSelectedProjectName();
            if (!projectCol || !projectName) return false;
            if ((row.cells?.[projectCol.id] || '').trim() !== projectName) return false;
        }

        return true;
    }

    function filterRows(sheet) {
        if (!MATRIX_STATE.filterProductLineId) return [];
        let rows = (sheet.rows || []).filter(row => rowMatchesFilters(sheet, row));
        rows = dedupeRowsForAllView(sheet, rows);
        const q = MATRIX_STATE.search.trim().toLowerCase();
        if (q) {
            rows = rows.filter(row =>
                Object.values(row.cells || {}).join(' ').toLowerCase().includes(q)
            );
        }
        return rows;
    }

    async function loadMasterFilters() {
        try {
            const [clientsRes, plRes, projectsRes] = await Promise.all([
                fetch(`${apiBase()}/clients?t=${Date.now()}`, { cache: 'no-store' }),
                fetch(`${apiBase()}/product-lines?t=${Date.now()}`, { cache: 'no-store' }),
                fetch(`${apiBase()}/projects?t=${Date.now()}`, { cache: 'no-store' }),
            ]);
            MATRIX_STATE.clients = clientsRes.ok ? await clientsRes.json() : [];
            MATRIX_STATE.productLines = plRes.ok ? await plRes.json() : [];
            MATRIX_STATE.projects = projectsRes.ok ? await projectsRes.json() : [];
            if (!Array.isArray(MATRIX_STATE.clients)) MATRIX_STATE.clients = [];
            if (!Array.isArray(MATRIX_STATE.productLines)) MATRIX_STATE.productLines = [];
            if (!Array.isArray(MATRIX_STATE.projects)) MATRIX_STATE.projects = [];
            if (!MATRIX_STATE.filterClientId) MATRIX_STATE.filterClientId = 'ALL';
            if (!MATRIX_STATE.filterProjectId) MATRIX_STATE.filterProjectId = 'ALL';
            if (!MATRIX_STATE.filterProductLineId && MATRIX_STATE.productLines.length) {
                MATRIX_STATE.filterProductLineId = String(MATRIX_STATE.productLines[0].id);
            }
            syncProjectFilterSelection();
        } catch (e) {
            console.warn('loadMasterFilters:', e.message);
        }
    }

    function syncProjectFilterSelection() {
        if (isAllProjects()) return;
        const allowed = getFilteredProjects();
        if (!allowed.some(p => String(p.id) === String(MATRIX_STATE.filterProjectId))) {
            MATRIX_STATE.filterProjectId = 'ALL';
        }
    }

    async function ensureStandardColumns() {
        if (!MATRIX_STATE.workbook) return;
        for (const sheet of MATRIX_STATE.workbook.sheets) {
            for (const spec of STANDARD_COLUMN_SPECS) {
                const exists = (sheet.columns || []).some(c => spec.match.test(c.label));
                if (exists) continue;
                try {
                    const col = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
                        label: spec.label,
                        type: spec.type,
                        filterable: spec.type !== 'text' || spec.label.includes('Product Line'),
                    });
                    sheet.columns.push(col);
                    sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                } catch (e) {
                    console.warn(`ensureStandardColumns ${sheet.id}:`, e.message);
                }
            }
        }
    }

    function getPersonnelPool(sheet) {
        const names = new Set();
        const plName = getSelectedProductLineName();

        const collectFromSheet = (srcSheet) => {
            if (!srcSheet) return;
            const nameCol = getPersonnelNameCol(srcSheet);
            const plCol = getProductLineCol(srcSheet);
            if (!nameCol) return;
            srcSheet.rows.forEach(r => {
                const rowPl = plCol ? (r.cells?.[plCol.id] || '').trim() : '';
                if (plName && plCol && rowPl && rowPl !== plName) return;
                const n = (r.cells?.[nameCol.id] || '').trim();
                if (n) names.add(n);
            });
        };

        collectFromSheet(sheetById(PROFILE_SHEET_ID));
        collectFromSheet(sheetById('employee_mandatory_training'));
        collectFromSheet(sheetById('personnel_health'));
        collectFromSheet(sheetById('emergency_contact_information'));

        if (!isAllClients()) {
            const clientName = getSelectedClientName();
            const clientCol = getClientCol(sheet);
            const nameCol = getPersonnelNameCol(sheet);
            const used = new Set(
                (sheet.rows || [])
                    .filter(r => clientCol && (r.cells?.[clientCol.id] || '').trim() === clientName)
                    .map(r => nameCol ? (r.cells?.[nameCol.id] || '').trim() : '')
                    .filter(Boolean)
            );
            // Include master rows (ALL source) not yet tagged to this client
            (sheet.rows || []).forEach(r => {
                if (!isMasterRow(sheet, r)) return;
                const n = nameCol ? (r.cells?.[nameCol.id] || '').trim() : '';
                if (n && !used.has(n)) names.add(n);
            });
            return [...names].filter(n => !used.has(n)).sort((a, b) => a.localeCompare(b));
        }

        return [...names].sort((a, b) => a.localeCompare(b));
    }

    async function applyCellsUpdate(sheetId, rowId, cells) {
        await matrixRequest('PUT', `/matrix/sheets/${sheetId}/rows/${rowId}`, { cells });
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        if (row) Object.assign(row.cells, cells);
    }

    async function fillRowFromPersonnel(sheetId, rowId, personnelName) {
        const sheet = sheetById(sheetId);
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet || !profileSheet) return rowId;

        const plName = getSelectedProductLineName();
        const master = findMasterPersonnelRow(sheet, personnelName, plName);
        let targetRowId = rowId;

        if (master && master.id !== rowId && !isAllClients()) {
            targetRowId = master.id;
        }

        const profileRow = profileSheet.rows.find(r => {
            const nc = getPersonnelNameCol(profileSheet);
            return nc && (r.cells?.[nc.id] || '').trim().toLowerCase() === personnelName.toLowerCase();
        });
        if (!profileRow) return targetRowId;

        const sourceRow = findRowInSheet(sheet, profileRow);
        const trainingSheet = sheetById('employee_mandatory_training');
        const trainingRow = trainingSheet ? findRowInSheet(trainingSheet, profileRow) : null;
        const clientName = getSelectedClientName();
        const cells = {};

        sheet.columns.forEach(col => {
            const labelKey = col.label.replace(/\*/g, '').trim().toLowerCase();
            if (getClientCol(sheet)?.id === col.id) {
                cells[col.id] = isAllClients() ? '' : clientName;
            } else if (getProjectCol(sheet)?.id === col.id) {
                cells[col.id] = isAllProjects() ? '' : getSelectedProjectName();
            } else if (getProductLineCol(sheet)?.id === col.id) {
                cells[col.id] = plName;
            } else if (getPersonnelNameCol(sheet)?.id === col.id) {
                cells[col.id] = personnelName;
            } else if (sourceRow?.cells?.[col.id] !== undefined && String(sourceRow.cells[col.id]).trim() !== '') {
                cells[col.id] = sourceRow.cells[col.id];
            } else if (getPositionCol(sheet)?.id === col.id && trainingRow) {
                const tPos = getPositionCol(trainingSheet);
                cells[col.id] = tPos ? (trainingRow.cells?.[tPos.id] || '') : '';
            } else {
                const profCol = profileSheet.columns.find(
                    pc => pc.label.replace(/\*/g, '').trim().toLowerCase() === labelKey
                );
                const targetRow = sheet.rows.find(r => r.id === targetRowId);
                if (profCol && profileRow.cells?.[profCol.id] !== undefined) {
                    cells[col.id] = profileRow.cells[profCol.id];
                } else {
                    cells[col.id] = targetRow?.cells?.[col.id] || '';
                }
            }
        });

        await applyCellsUpdate(sheetId, targetRowId, cells);

        if (master && master.id !== rowId && !isAllClients()) {
            try {
                await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${rowId}`);
                sheet.rows = sheet.rows.filter(r => r.id !== rowId);
            } catch (e) {
                console.warn('fillRowFromPersonnel delete duplicate:', e.message);
            }
        }

        await cleanupDuplicatePersonnelRows(sheetId, personnelName);
        return targetRowId;
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

    async function ensureProfilePhotoColumn() {
        const sheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet) return;
        const hasPhoto = (sheet.columns || []).some(c => c.type === 'image' || /profile photo/i.test(c.label));
        if (hasPhoto) return;
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                label: 'Profile Photo',
                type: 'image',
                filterable: false,
            });
            if (col?.id) {
                sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
            }
        } catch (e) {
            console.warn('ensureProfilePhotoColumn:', e.message);
        }
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

        const clientOptions = `<option value="ALL"${MATRIX_STATE.filterClientId === 'ALL' ? ' selected' : ''}>ALL</option>` +
            MATRIX_STATE.clients.map(c =>
                `<option value="${esc(String(c.id))}"${String(c.id) === String(MATRIX_STATE.filterClientId) ? ' selected' : ''}>${esc(c.name)}</option>`
            ).join('');

        const plOptions = `<option value="">Pilih Product Line</option>` +
            MATRIX_STATE.productLines.map(pl =>
                `<option value="${esc(String(pl.id))}"${String(pl.id) === String(MATRIX_STATE.filterProductLineId) ? ' selected' : ''}>${esc(pl.name)}</option>`
            ).join('');

        const filteredProjects = getFilteredProjects();
        const projectOptions = `<option value="ALL"${MATRIX_STATE.filterProjectId === 'ALL' ? ' selected' : ''}>ALL</option>` +
            filteredProjects.map(p =>
                `<option value="${esc(String(p.id))}"${String(p.id) === String(MATRIX_STATE.filterProjectId) ? ' selected' : ''}>${esc(p.name)}</option>`
            ).join('');

        return `
        <div class="mx-toolbar-card">
            <div class="mx-toolbar-row mx-toolbar-filters">
                <select id="mx-filter-client" class="form-input mx-select" title="Client" onchange="matrixOnClientFilterChange(this.value)">${clientOptions}</select>
                <select id="mx-filter-product-line" class="form-input mx-select" title="Product Line" onchange="matrixOnProductLineFilterChange(this.value)">${plOptions}</select>
                <select id="mx-filter-project" class="form-input mx-select" title="Project" onchange="matrixOnProjectFilterChange(this.value)"${MATRIX_STATE.filterProductLineId ? '' : ' disabled'}>${projectOptions}</select>
            </div>
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

    function renderPhotoCell(sheet, row, col) {
        const profileRow = findPersonnelProfileRow(sheet, row);
        const fileId = profilePhotoFileId(profileRow);
        const gender = profileGender(profileRow);
        const src = fileId ? photoViewUrl(fileId) : defaultAvatar(gender);
        const canUpload = sheet.id === PROFILE_SHEET_ID;
        const name = profileName(profileRow) || profileName(row) || 'Personnel';
        const uploadAttrs = canUpload
            ? `onclick="matrixTriggerPhotoUpload('${esc(sheet.id)}','${esc(row.id)}','${esc(col.id)}')" title="Upload foto profil"`
            : 'title="Foto dari Data Personel"';

        return `<td class="mx-td mx-td-photo mx-td-edit" onclick="event.stopPropagation()">
            <div class="mx-photo-cell" ${uploadAttrs}>
                <img class="mx-photo-thumb" src="${esc(src)}" alt="Profil" onerror="this.src='${defaultAvatar(gender)}'" />
                ${canUpload ? `<span class="mx-photo-upload-hint">📷 Upload</span>
                <input type="file" accept="image/*" class="mx-photo-input" id="mx-photo-${esc(row.id)}"
                    data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(col.id)}"
                    data-name="${esc(name)}" onchange="matrixOnPhotoSelected(this)" />` : ''}
            </div>
        </td>`;
    }

    function renderProductLineSelect(sheet, row, col, val) {
        const options = ['<option value="">—</option>'].concat(
            MATRIX_STATE.productLines.map(pl => {
                const sel = val === pl.name ? ' selected' : '';
                return `<option value="${esc(pl.name)}"${sel}>${esc(pl.name)}</option>`;
            })
        );
        return `<td class="mx-td mx-td-edit" onclick="event.stopPropagation()">
            <select class="mx-cell-input mx-cell-select"
                data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(col.id)}"
                onclick="event.stopPropagation()"
                onfocus="this.dataset.prev=this.value"
                onchange="matrixOnCellChange(this)">${options.join('')}</select>
        </td>`;
    }

    function renderPersonnelNameSelect(sheet, row, col, val) {
        const pool = getPersonnelPool(sheet);
        const options = ['<option value="">— Pilih Personel —</option>'].concat(
            pool.map(n => {
                const sel = val === n ? ' selected' : '';
                return `<option value="${esc(n)}"${sel}>${esc(n)}</option>`;
            })
        );
        if (val && !pool.includes(val)) {
            options.push(`<option value="${esc(val)}" selected>${esc(val)}</option>`);
        }
        return `<td class="mx-td mx-td-edit" onclick="event.stopPropagation()">
            <select class="mx-cell-input mx-cell-select"
                data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(col.id)}"
                onclick="event.stopPropagation()"
                onfocus="this.dataset.prev=this.value"
                onchange="matrixOnPersonnelSelect(this)">${options.join('')}</select>
        </td>`;
    }

    function renderCell(sheet, row, c) {
        if (c.type === 'image' || c.id === PHOTO_COL_ID) {
            return renderPhotoCell(sheet, row, c);
        }
        const val = row.cells?.[c.id] ?? '';

        if (getProductLineCol(sheet)?.id === c.id) {
            return renderProductLineSelect(sheet, row, c, val);
        }

        if (getPersonnelNameCol(sheet)?.id === c.id && !isAllClients()) {
            return renderPersonnelNameSelect(sheet, row, c, val);
        }

        const inputType = c.type === 'date' ? 'date' : (c.type === 'number' ? 'number' : 'text');
        return `<td class="mx-td mx-td-edit" onclick="event.stopPropagation()">
            <input class="mx-cell-input" type="${inputType}" value="${esc(val)}"
                data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(c.id)}"
                onclick="event.stopPropagation()"
                onfocus="this.dataset.prev=this.value"
                onchange="matrixOnCellChange(this)"
                onblur="matrixOnCellBlur(this)" />
        </td>`;
    }

    function renderTable(sheet, rows) {
        const cols = getDisplayColumns(sheet);
        const head = cols.map(c => {
            if (c.type === 'image' || c.id === PHOTO_COL_ID) {
                return `<th class="mx-th mx-th-photo"><span>${esc(c.label.replace(/\*/g, ''))}</span></th>`;
            }
            return `
            <th class="mx-th">
                <div class="mx-th-inner">
                    <span title="${esc(c.label)}">${esc(c.label.replace(/\*/g, ''))}</span>
                    <div class="mx-th-actions">
                        <button type="button" title="Edit kolom" onclick="matrixEditColumn('${esc(sheet.id)}','${esc(c.id)}')">✎</button>
                        <button type="button" title="Hapus kolom" onclick="matrixDeleteColumn('${esc(sheet.id)}','${esc(c.id)}')">×</button>
                    </div>
                </div>
            </th>`;
        }).join('') + '<th class="mx-th mx-th-sticky">Aksi</th>';

        const body = rows.map(row => {
            const selected = row.id === MATRIX_STATE.selectedRowId ? ' mx-row-selected' : '';
            const cells = cols.map(c => renderCell(sheet, row, c)).join('');
            return `<tr class="mx-data-row${selected}" data-row-id="${esc(row.id)}"
                onclick="matrixSelectRow('${esc(row.id)}')">${cells}
                <td class="mx-td mx-td-actions" onclick="event.stopPropagation()">
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

    function sidebarFieldRowsForSheet(sheetId, profileRow) {
        const sheet = sheetById(sheetId);
        if (!sheet) return { items: [], hasRow: false };
        const row = findRowInSheet(sheet, profileRow);
        if (!row) return { items: [], hasRow: false };

        const items = [];
        (sheet.columns || []).forEach(col => {
            if (col.type === 'image' || col.id === PHOTO_COL_ID) return;
            const val = (row.cells?.[col.id] || '').trim();
            items.push({ label: col.label.replace(/\*/g, ''), value: val || '—' });
        });
        return { items, hasRow: true };
    }

    function renderSidebar(sheet) {
        const activeRow = (sheet.rows || []).find(r => r.id === MATRIX_STATE.selectedRowId);
        if (!activeRow) {
            return `
            <aside class="mx-sidebar mx-sidebar-empty">
                <div class="mx-sidebar-placeholder">
                    <div class="mx-sidebar-placeholder-icon">👤</div>
                    <p>Pilih baris personel untuk melihat profil</p>
                </div>
            </aside>`;
        }

        const profileSheet = sheetById(PROFILE_SHEET_ID) || sheet;
        const profileRow = findPersonnelProfileRow(sheet, activeRow);
        const name = profileName(profileRow) || 'Personnel';
        const gender = profileGender(profileRow);
        const ktpCol = getColByLabel(profileSheet, /ktp/i);
        const cityCol = getColByLabel(profileSheet, /city/i);
        const ktp = ktpCol ? (profileRow?.cells?.[ktpCol.id] || '').trim() : '';
        const city = cityCol ? (profileRow?.cells?.[cityCol.id] || '').trim() : '';
        const avatar = avatarSrcForProfile(profileRow);
        const tabId = MATRIX_STATE.sidebarTab;
        const { items: fields, hasRow } = sidebarFieldRowsForSheet(tabId, profileRow);
        const tabLabel = TAB_LABELS[tabId] || tabId;

        const tabs = SIDEBAR_TABS.map(t =>
            `<button type="button" class="mx-sidebar-tab${t.id === tabId ? ' active' : ''}"
                onclick="matrixSetSidebarTab('${t.id}')" title="${esc(t.label)}">${esc(t.label)}</button>`
        ).join('');

        const fieldHtml = fields.map(f => `
            <div class="mx-sidebar-field">
                <span class="mx-sidebar-field-label">${esc(f.label)}</span>
                <span class="mx-sidebar-field-value">${esc(f.value)}</span>
            </div>`).join('');

        const bodyHtml = hasRow
            ? (fieldHtml || '<p class="mx-sidebar-no-data">Semua field kosong.</p>')
            : `<p class="mx-sidebar-no-data">Tidak ada data ${esc(tabLabel)} untuk personel ini.</p>`;

        return `
        <aside class="mx-sidebar">
            <div class="mx-sidebar-card">
                <div class="mx-sidebar-photo-wrap">
                    <img class="mx-sidebar-photo" src="${esc(avatar)}" alt="${esc(name)}"
                        onerror="this.src='${defaultAvatar(gender)}'" />
                </div>
                <h3 class="mx-sidebar-name">${esc(name)}</h3>
                <div class="mx-sidebar-badges">
                    ${gender ? `<span class="mx-sidebar-badge">${esc(gender)}</span>` : ''}
                    ${city ? `<span class="mx-sidebar-badge mx-sidebar-badge-muted">${esc(city)}</span>` : ''}
                    ${ktp ? `<span class="mx-sidebar-badge mx-sidebar-badge-muted">KTP</span>` : ''}
                </div>
                <div class="mx-sidebar-tabs">${tabs}</div>
                <div class="mx-sidebar-fields">${bodyHtml}</div>
            </div>
        </aside>`;
    }

    function replaceMatrixSidebar() {
        const sheet = activeSheet();
        if (!sheet) return;
        const old = document.querySelector('#matrix-content .mx-sidebar');
        if (!old) {
            paintMatrixScreen();
            return;
        }
        const wrap = document.createElement('div');
        wrap.innerHTML = renderSidebar(sheet).trim();
        const next = wrap.firstElementChild;
        if (next) old.replaceWith(next);
    }

    function highlightMatrixRow(rowId) {
        document.querySelectorAll('#matrix-content .mx-data-row').forEach(tr => {
            tr.classList.toggle('mx-row-selected', tr.dataset.rowId === rowId);
        });
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

        if (!MATRIX_STATE.filterProductLineId) {
            root.innerHTML = `<div class="mx-empty">Pilih <strong>Product Line</strong> terlebih dahulu untuk menampilkan data personel.</div>`;
            return;
        }

        const summary = computeSheetSummary(sheet);
        const rows = filterRows(sheet);
        const tabLabel = TAB_LABELS[sheet.id] || sheet.title || sheet.name;

        if (MATRIX_STATE.selectedRowId && !rows.some(r => r.id === MATRIX_STATE.selectedRowId)) {
            MATRIX_STATE.selectedRowId = rows[0]?.id || null;
        } else if (!MATRIX_STATE.selectedRowId && rows.length) {
            MATRIX_STATE.selectedRowId = rows[0].id;
        }

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
                <div class="mx-layout">
                    ${renderSidebar(sheet)}
                    <div class="mx-main">
                        ${renderToolbar(sheet)}
                        ${renderTable(sheet, rows)}
                    </div>
                </div>
            </div>`;
        updateUndoRedoUI();
    }

    window.matrixSelectRow = function (rowId) {
        if (MATRIX_STATE.selectedRowId === rowId) return;
        MATRIX_STATE.selectedRowId = rowId;
        highlightMatrixRow(rowId);
        replaceMatrixSidebar();
    };

    window.matrixSetSidebarTab = function (tabId) {
        MATRIX_STATE.sidebarTab = tabId;
        replaceMatrixSidebar();
    };

    window.matrixTriggerPhotoUpload = function (sheetId, rowId, colId) {
        const input = document.getElementById(`mx-photo-${rowId}`);
        if (input) input.click();
    };

    window.matrixOnPhotoSelected = async function (input) {
        const file = input.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast?.('Hanya file gambar yang diizinkan', 'error');
            input.value = '';
            return;
        }

        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col || PHOTO_COL_ID;
        const personnelName = input.dataset.name || 'Personnel';
        const oldVal = sheetById(sheetId)?.rows?.find(r => r.id === rowId)?.cells?.[colId] || '';

        try {
            showToast?.('Mengunggah foto...', 'info');
            const fileId = await uploadProfilePhoto(sheetId, rowId, colId, personnelName, file);
            pushHistory({
                desc: 'Upload foto profil',
                undo: async () => { await applyCellUpdate(sheetId, rowId, colId, oldVal); },
                redo: async () => { await applyCellUpdate(sheetId, rowId, colId, fileId); },
            });
            showToast?.('Foto profil berhasil diunggah ke Google Drive', 'success');
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message || 'Gagal mengunggah foto', 'error');
        } finally {
            input.value = '';
        }
    };

    async function uploadProfilePhoto(sheetId, rowId, colId, personnelName, file) {
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalSize = file.size;

        if (totalSize <= CHUNK_SIZE) {
            const form = new FormData();
            form.append('sheet_id', sheetId);
            form.append('row_id', rowId);
            form.append('col_id', colId);
            form.append('personnel_name', personnelName);
            form.append('file', file);
            const res = await fetch(`${apiBase()}/matrix/profile-photo/upload`, { method: 'POST', body: form });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            await applyCellUpdate(sheetId, rowId, colId, data.file_id);
            return data.file_id;
        }

        const initForm = new FormData();
        initForm.append('filename', file.name);
        initForm.append('mime_type', file.type || 'image/jpeg');
        initForm.append('personnel_name', personnelName);
        const initRes = await fetch(`${apiBase()}/matrix/profile-photo/initiate-upload`, { method: 'POST', body: initForm });
        if (!initRes.ok) {
            const err = await initRes.json().catch(() => ({}));
            throw new Error(err.detail || 'Gagal memulai upload');
        }
        const { upload_url } = await initRes.json();
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
        let fileId = null;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, totalSize));
            const chunkForm = new FormData();
            chunkForm.append('sheet_id', sheetId);
            chunkForm.append('row_id', rowId);
            chunkForm.append('col_id', colId);
            chunkForm.append('personnel_name', personnelName);
            chunkForm.append('filename', file.name);
            chunkForm.append('upload_url', upload_url);
            chunkForm.append('chunk_index', String(i));
            chunkForm.append('total_chunks', String(totalChunks));
            chunkForm.append('chunk_file', chunk, file.name);
            chunkForm.append('start_byte', String(start));
            chunkForm.append('total_size', String(totalSize));

            const chunkRes = await fetch(`${apiBase()}/matrix/profile-photo/upload-chunk`, { method: 'POST', body: chunkForm });
            if (!chunkRes.ok) {
                const err = await chunkRes.json().catch(() => ({}));
                throw new Error(err.detail || `Chunk ${i + 1} gagal`);
            }
            const chunkData = await chunkRes.json();
            if (chunkData.status === 'complete') fileId = chunkData.file_id;
        }

        if (!fileId) throw new Error('Upload selesai tanpa file_id');
        await applyCellUpdate(sheetId, rowId, colId, fileId);
        return fileId;
    }

    window.matrixOnClientFilterChange = async function (clientId) {
        MATRIX_STATE.filterClientId = clientId || 'ALL';
        MATRIX_STATE.filterProjectId = 'ALL';
        syncProjectFilterSelection();
        MATRIX_STATE.selectedRowId = null;
        if (isAllClients()) {
            await dedupeAllPersonnelInWorkbook();
        }
        paintMatrixScreen();
    };

    window.matrixOnProductLineFilterChange = function (plId) {
        MATRIX_STATE.filterProductLineId = plId || '';
        MATRIX_STATE.filterProjectId = 'ALL';
        syncProjectFilterSelection();
        MATRIX_STATE.selectedRowId = null;
        paintMatrixScreen();
    };

    window.matrixOnProjectFilterChange = function (projectId) {
        MATRIX_STATE.filterProjectId = projectId || 'ALL';
        MATRIX_STATE.selectedRowId = null;
        paintMatrixScreen();
    };

    window.matrixOnPersonnelSelect = async function (select) {
        const personnelName = select.value;
        const sheetId = select.dataset.sheet;
        const rowId = select.dataset.row;
        const colId = select.dataset.col;
        const oldVal = select.dataset.prev ?? '';

        if (!personnelName) return;

        try {
            const finalRowId = await fillRowFromPersonnel(sheetId, rowId, personnelName);
            MATRIX_STATE.selectedRowId = finalRowId;
            select.dataset.prev = personnelName;
            pushHistory({
                desc: 'Pilih personel',
                undo: async () => {
                    await applyCellsUpdate(sheetId, finalRowId, { [colId]: oldVal });
                    paintMatrixScreen();
                },
                redo: async () => {
                    await fillRowFromPersonnel(sheetId, finalRowId, personnelName);
                    paintMatrixScreen();
                },
            });
            paintMatrixScreen();
        } catch (e) {
            select.value = oldVal;
            showToast?.(e.message || 'Gagal memuat data personel', 'error');
        }
    };

    window.matrixOnTabChange = function (sheetId) {
        const prevSheet = activeSheet();
        const prevRow = prevSheet?.rows?.find(r => r.id === MATRIX_STATE.selectedRowId);
        const profileRow = prevRow ? findPersonnelProfileRow(prevSheet, prevRow) : null;

        MATRIX_STATE.activeSheetId = sheetId;
        MATRIX_STATE.search = '';
        if (SIDEBAR_SHEET_ORDER.includes(sheetId)) {
            MATRIX_STATE.sidebarTab = sheetId;
        }

        const newSheet = sheetById(sheetId);
        if (profileRow && newSheet) {
            const match = findRowInSheet(newSheet, profileRow);
            MATRIX_STATE.selectedRowId = match?.id || null;
        } else {
            MATRIX_STATE.selectedRowId = null;
        }

        clearHistory();
        paintMatrixScreen();
    };

    window.matrixOnSearchInput = function (val) {
        MATRIX_STATE.search = val;
        paintMatrixScreen();
    };

    window.matrixOnCellBlur = function (input) {
        if (!input || input.tagName === 'SELECT') return;
        matrixOnCellChange(input);
    };

    window.matrixOnCellChange = async function (input) {
        if (!input || input.dataset.saving === '1') return;
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const oldVal = input.dataset.prev ?? '';
        const newVal = input.value;
        if (oldVal === newVal) return;

        input.dataset.saving = '1';
        try {
            await applyCellUpdate(sheetId, rowId, colId, newVal);
            input.dataset.prev = newVal;
            pushHistory({
                desc: 'Edit sel',
                undo: async () => { await applyCellUpdate(sheetId, rowId, colId, oldVal); },
                redo: async () => { await applyCellUpdate(sheetId, rowId, colId, newVal); },
            });
            const colLabel = sheetById(sheetId)?.columns?.find(c => c.id === colId)?.label || '';
            if (/personnel name/i.test(colLabel)) {
                await cleanupDuplicatePersonnelRows(sheetId, newVal);
                replaceMatrixSidebar();
            }
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || 'Gagal menyimpan', 'error');
        } finally {
            delete input.dataset.saving;
        }
    };

    window.matrixAddRow = async function () {
        const sheet = activeSheet();
        if (!sheet) return;
        if (!MATRIX_STATE.filterProductLineId) {
            showToast?.('Pilih Product Line terlebih dahulu', 'error');
            return;
        }
        const initCells = {};
        const clientCol = getClientCol(sheet);
        const plCol = getProductLineCol(sheet);
        const projectCol = getProjectCol(sheet);
        const plName = getSelectedProductLineName();
        if (clientCol && !isAllClients()) initCells[clientCol.id] = getSelectedClientName();
        else if (clientCol && isAllClients()) initCells[clientCol.id] = '';
        if (plCol && plName) initCells[plCol.id] = plName;
        if (projectCol && !isAllProjects()) initCells[projectCol.id] = getSelectedProjectName();
        try {
            const row = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/rows`, { cells: initCells });
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
            MATRIX_STATE.selectedRowId = row.id;
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
            if (MATRIX_STATE.selectedRowId === rowId) MATRIX_STATE.selectedRowId = null;
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
                    await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
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
            await loadMasterFilters();
            MATRIX_STATE.workbook = await fetchWorkbook();
            await ensureStandardColumns();
            await ensureProfilePhotoColumn();
            if (!MATRIX_STATE.activeSheetId && MATRIX_STATE.workbook.sheets?.length) {
                MATRIX_STATE.activeSheetId = MATRIX_STATE.workbook.sheets[0].id;
            }
            if (!silent) clearHistory();
            if (isAllClients()) await dedupeAllPersonnelInWorkbook();
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
