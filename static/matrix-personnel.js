/**
 * HSE Personnel Matrix — CRUD, undo/redo, profile sidebar, photo upload.
 */
(function () {
    const PROFILE_SHEET_ID = 'personnel_data_information';
    const PERSONNEL_HEALTH_SHEET_ID = 'personnel_health';
    const EMERGENCY_CONTACT_SHEET_ID = 'emergency_contact_information';
    const TRAINING_SHEET_ID = 'employee_mandatory_training';
    const PELATIHAN_SHARED_DRIVE_FOLDER = 'PELATIHAN';
    const PELATIHAN_FILE_PREFIXES = [
        ['hse 301', 'HSE 301'], ['hse 201', 'HSE 201'], ['hse 101', 'HSE 101'],
        ['hse demo room', 'HSE DEMO ROOM'], ['sea survival', 'SEA SURVIVAL'],
        ['well control', 'WELL CONTROL'], ['first aid', 'FIRST AID'], ['k3 umum', 'K3 UMUM'],
        ['t-bosiet', 'T-BOSIET'], ['one sika', 'ONE SIKA'], ['radiation', 'RADIATION'],
        ['forklift', 'FORKLIFT'], ['handak', 'HANDAK'], ['sbtc', 'SBTC'], ['h2s', 'H2S'],
        ['fire', 'FIRE'], ['tkpk', 'TKPK'], ['tkdn', 'TKDN'], ['bst', 'BST'], ['ohc', 'OHC'],
    ];
    const PELATIHAN_EXTRA_TRAININGS = [
        { filePrefix: 'T-BOSIET', dateLabel: 'T-BOSIET DATE', expiryLabel: 'T-BOSIET Expiry Date', agencyLabel: 'T-BOSIET TRAINING AGENCY', dateColId: 'col_25', expiryColId: 'col_26', agencyColId: 'col_27', slug: 't_bosiet' },
        { filePrefix: 'H2S', dateLabel: 'H2S TRAINING DATE', expiryLabel: 'H2S TRAINING Expiry Date', agencyLabel: 'H2S TRAINING AGENCY', dateColId: 'col_28', expiryColId: 'col_29', agencyColId: 'col_30', slug: 'h2s' },
        { filePrefix: 'SEA SURVIVAL', dateLabel: 'SEA SURVIVAL TRAINING DATE', expiryLabel: 'SEA SURVIVAL TRAINING Expiry Date', agencyLabel: 'SEA SURVIVAL TRAINING AGENCY', dateColId: 'col_31', expiryColId: 'col_32', agencyColId: 'col_33', slug: 'sea_survival' },
        { filePrefix: 'HSE DEMO ROOM', dateLabel: 'HSE DEMO ROOM TRAINING DATE', expiryLabel: 'HSE DEMO ROOM TRAINING Expiry Date', agencyLabel: 'HSE DEMO ROOM TRAINING AGENCY', dateColId: 'col_34', expiryColId: 'col_35', agencyColId: 'col_36', slug: 'hse_demo_room' },
        { filePrefix: 'WELL CONTROL', dateLabel: 'WELL CONTROL TRAINING DATE', expiryLabel: 'WELL CONTROL TRAINING Expiry Date', agencyLabel: 'WELL CONTROL TRAINING AGENCY', dateColId: 'col_37', expiryColId: 'col_38', agencyColId: 'col_39', slug: 'well_control' },
        { filePrefix: 'FIRST AID', dateLabel: 'FIRST AID TRAINING DATE', expiryLabel: 'FIRST AID TRAINING Expiry Date', agencyLabel: 'FIRST AID TRAINING AGENCY', dateColId: 'col_40', expiryColId: 'col_41', agencyColId: 'col_42', slug: 'first_aid' },
        { filePrefix: 'FIRE', dateLabel: 'FIRE TRAINING DATE', expiryLabel: 'FIRE TRAINING Expiry Date', agencyLabel: 'FIRE TRAINING AGENCY', dateColId: 'col_43', expiryColId: 'col_44', agencyColId: 'col_45', slug: 'fire' },
        { filePrefix: 'OHC', dateLabel: 'OHC TRAINING DATE', expiryLabel: 'OHC TRAINING Expiry Date', agencyLabel: 'OHC TRAINING AGENCY', dateColId: 'col_46', expiryColId: 'col_47', agencyColId: 'col_48', slug: 'ohc' },
        { filePrefix: 'FORKLIFT', dateLabel: 'FORKLIFT TRAINING DATE', expiryLabel: 'FORKLIFT TRAINING Expiry Date', agencyLabel: 'FORKLIFT TRAINING AGENCY', dateColId: 'col_49', expiryColId: 'col_50', agencyColId: 'col_51', slug: 'forklift' },
        { filePrefix: 'RADIATION', dateLabel: 'RADIATION TRAINING DATE', expiryLabel: 'RADIATION TRAINING Expiry Date', agencyLabel: 'RADIATION TRAINING AGENCY', dateColId: 'col_52', expiryColId: 'col_53', agencyColId: 'col_54', slug: 'radiation' },
        { filePrefix: 'HANDAK', dateLabel: 'HANDAK TRAINING DATE', expiryLabel: 'HANDAK TRAINING Expiry Date', agencyLabel: 'HANDAK TRAINING AGENCY', dateColId: 'col_55', expiryColId: 'col_56', agencyColId: 'col_57', slug: 'handak' },
        { filePrefix: 'K3 UMUM', dateLabel: 'K3 UMUM TRAINING DATE', expiryLabel: 'K3 UMUM TRAINING Expiry Date', agencyLabel: 'K3 UMUM TRAINING AGENCY', dateColId: 'col_58', expiryColId: 'col_59', agencyColId: 'col_60', slug: 'k3_umum' },
        { filePrefix: 'TKPK', dateLabel: 'TKPK TRAINING DATE', expiryLabel: 'TKPK TRAINING Expiry Date', agencyLabel: 'TKPK TRAINING AGENCY', dateColId: 'col_61', expiryColId: 'col_62', agencyColId: 'col_63', slug: 'tkpk' },
        { filePrefix: 'TKDN', dateLabel: 'TKDN TRAINING DATE', expiryLabel: 'TKDN TRAINING Expiry Date', agencyLabel: 'TKDN TRAINING AGENCY', dateColId: 'col_64', expiryColId: 'col_65', agencyColId: 'col_66', slug: 'tkdn' },
        { filePrefix: 'HSE 101', dateLabel: 'HSE 101 TRAINING DATE', expiryLabel: 'HSE 101 TRAINING Expiry Date', agencyLabel: 'HSE 101 TRAINING AGENCY', dateColId: 'col_67', expiryColId: 'col_68', agencyColId: 'col_69', slug: 'hse_101' },
        { filePrefix: 'HSE 201', dateLabel: 'HSE 201 TRAINING DATE', expiryLabel: 'HSE 201 TRAINING Expiry Date', agencyLabel: 'HSE 201 TRAINING AGENCY', dateColId: 'col_70', expiryColId: 'col_71', agencyColId: 'col_72', slug: 'hse_201' },
        { filePrefix: 'HSE 301', dateLabel: 'HSE 301 TRAINING DATE', expiryLabel: 'HSE 301 TRAINING Expiry Date', agencyLabel: 'HSE 301 TRAINING AGENCY', dateColId: 'col_73', expiryColId: 'col_74', agencyColId: 'col_75', slug: 'hse_301' },
    ];
    const MCU_AUTO_VALIDITY_MONTHS = 12;
    const SKCK_AUTO_VALIDITY_MONTHS = 6;
    const SKCK_EMAIL_REMINDER_DAYS = 30;
    const HSE_PASSPORT_AUTO_VALIDITY_MONTHS = 12;
    const SIM_AUTO_VALIDITY_MONTHS = 60;
    const MCU_RESULT_DOC_COL_ID = 'col_7_mcu_result_doc';
    const CV_DOC_COL_ID = 'col_cv_doc';
    const KTP_UPLOAD_DOC_COL_ID = 'col_ktp_upload_doc';
    const SIM_DATE_COL_ID = 'col_sim_date';
    const SIM_EXPIRY_COL_ID = 'col_sim_expiry';
    const SIM_UPLOAD_DOC_COL_ID = 'col_sim_upload_doc';
    const HSE_PASSPORT_NUMBER_COL_ID = 'col_hse_passport_number';
    const SIML_SLOT_COUNT = 5;
    const SIML_AUTO_VALIDITY_MONTHS = 12;

    function buildSimlSlotConfigs() {
        const slots = [];
        for (let n = 1; n <= SIML_SLOT_COUNT; n++) {
            const tag = n === 1 ? '' : ` ${n}`;
            const idTag = n === 1 ? '' : `${n}`;
            slots.push({
                slot: n,
                numberColId: `col_siml${idTag}_number`,
                locationColId: `col_siml${idTag}_location`,
                dateColId: `col_siml${idTag}_date`,
                expiryColId: `col_siml${idTag}_expiry`,
                uploadColId: `col_siml${idTag}_upload_doc`,
                numberKey: `siml${idTag}_number`,
                locationKey: `siml${idTag}_location`,
                dateKey: `siml${idTag}_date`,
                expiryKey: `siml${idTag}_expiry_date`,
                uploadKey: `doc_siml${idTag}_upload`,
                labels: {
                    number: `SIML${tag} Number`,
                    location: `SIML${tag} Location`,
                    date: `SIML${tag} Date`,
                    expiry: `SIML${tag} Expiry Date`,
                    upload: n === 1 ? 'Upload SIML' : `Upload SIML ${n}`,
                },
            });
        }
        return slots;
    }

    const SIML_SLOTS = buildSimlSlotConfigs();
    const BPJS_UPLOAD_DOC_COL_ID = 'col_bpjs_upload_doc';
    const INSURANCE_UPLOAD_DOC_COL_ID = 'col_insurance_upload_doc';
    const DATA_PERSONEL_SHARED_DRIVE_FOLDER = 'DATA PERSONEL';
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
        storage: null,
    };

    const SHEET_KPI_COLORS = ['#46D369', '#F5A623', '#e74c3c', '#4A90D9', '#9b59b6', '#E50914', '#1abc9c'];

    const SHEET_KPI_RULES = {
        employee_mandatory_training: [
            { type: 'personnel' },
            { label: 'BST Expired ≤3 bulan (90 hari)', shortLabel: 'BST ≤90 hari', match: /bst expiry/i, warnDays: 90, status: 'soon' },
            { label: 'SBTC Expired ≤3 bulan (90 hari)', shortLabel: 'SBTC ≤90 hari', match: /sbtc expiry/i, warnDays: 90, status: 'soon' },
            { label: 'One Sika Expired ≤3 bulan (90 hari)', shortLabel: 'One Sika ≤90 hari', match: /one sika expiry/i, warnDays: 90, status: 'soon' },
            {
                label: 'Pelatihan Tambahan ≤3 bulan (90 hari)',
                shortLabel: 'Pelatihan+ ≤90 hari',
                match: /t-bosiet.*expir|h2s.*expir|sea survival.*expir|hse demo room.*expir|well control.*expir|first aid.*expir|fire.*expir|ohc.*expir|forklift.*expir|radiation.*expir|handak.*expir|k3 umum.*expir|tkpk.*expir|tkdn.*expir|hse 101.*expir|hse 201.*expir|hse 301.*expir/i,
                warnDays: 90,
                status: 'soon',
            },
            { label: 'Training Sudah Expired', shortLabel: 'Training Expired', match: /(?:expir|expired)/i, status: 'expired', perRow: true },
            { type: 'missing' },
        ],
        personnel_health: [
            { type: 'personnel' },
            { label: 'MCU Expired ≤3 bulan (90 hari)', shortLabel: 'MCU ≤90 hari', match: /mcu expired/i, warnDays: 90, status: 'soon' },
            { label: 'MCU Sudah Expired', shortLabel: 'MCU Expired', match: /mcu expired/i, status: 'expired' },
            { type: 'missing' },
        ],
        personnel_data_information: [
            { type: 'personnel' },
            { label: 'SKCK Expired ≤30 hari', shortLabel: 'SKCK ≤30 hari', match: /skck expiry/i, warnDays: 30, status: 'soon' },
            { label: 'HSE Passport Expired ≤3 bulan (90 hari)', shortLabel: 'HSE Pass ≤90 hari', match: /hse passport expired/i, warnDays: 90, status: 'soon' },
            { label: 'SIM Expiry Date ≤3 bulan (90 hari)', shortLabel: 'SIM ≤90 hari', match: /^sim expiry date$/i, warnDays: 90, status: 'soon' },
            { label: 'SIML Expiry ≤3 bulan (90 hari)', shortLabel: 'SIML ≤90 hari', match: /siml(?:\s+\d+)?\s*expiry date/i, warnDays: 90, status: 'soon' },
            { label: 'Dokumen Sudah Expired', shortLabel: 'Dok Expired', match: /(?:expir|expired)/i, status: 'expired', perRow: true },
            { type: 'missing' },
        ],
        contract_information: [
            { type: 'personnel' },
            { label: 'Kontrak Berakhir ≤30 hari', shortLabel: 'Kontrak ≤30 hari', match: /contract end date/i, warnDays: 30, status: 'soon' },
            { label: 'Kontrak Sudah Expired', shortLabel: 'Kontrak Expired', match: /contract end date/i, status: 'expired' },
            { type: 'missing' },
        ],
        emergency_contact_information: [
            { type: 'personnel' },
            { type: 'missing' },
        ],
    };

    const DEFAULT_KPI_RULES = [
        { type: 'personnel' },
        { label: 'Kadaluarsa ≤30 hari', shortLabel: '≤30 hari', match: /(?:expir|expired)/i, warnDays: 30, status: 'soon' },
        { label: 'Sudah Expired', shortLabel: 'Expired', match: /(?:expir|expired)/i, status: 'expired', perRow: true },
        { type: 'missing' },
    ];

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

    let REMINDER_PENDING = null;

    function isExpiryDateColumn(col) {
        const label = (col?.label || '').replace(/\*/g, '').trim().toLowerCase();
        return /expir|expired|end date|berakhir|kadaluarsa/i.test(label);
    }

    function normColLabel(label) {
        return (label || '').replace(/\*/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function docColumnIdFor(expiryCol) {
        return `${expiryCol.id}_doc`;
    }

    function docColumnLabelFor(expiryCol) {
        return `Doc: ${expiryCol.label.replace(/\*/g, '').trim()}`;
    }

    function isDocUploadColumn(col) {
        if (!col) return false;
        if (col._virtual) return true;
        const label = (col.label || '').replace(/\*/g, '').trim();
        if (/^doc:\s/i.test(label)) return true;
        if (/mcu\s*result\s*doc/i.test(label)) return true;
        if (/^cv$/i.test(label)) return true;
        if (/upload\s*ktp/i.test(label)) return true;
        if (/^upload\s*siml(\s+\d+)?$/i.test(label)) return true;
        if (/^upload\s*sim$/i.test(label)) return true;
        if (/upload\s*bpjs/i.test(label)) return true;
        if (/upload\s*insurance/i.test(label)) return true;
        if ((col.id || '').endsWith('_doc')) return true;
        if ((col.key || '').toLowerCase().startsWith('doc_')) return true;
        return false;
    }

    function isMcuReviewResultsColumn(col) {
        return /mcu\s*review\s*results/i.test((col?.label || '').replace(/\*/g, '').trim());
    }

    function isFinalMcuReviewStatusColumn(col) {
        return /final\s*mcu\s*review\s*status\s*by\s*client/i.test((col?.label || '').replace(/\*/g, '').trim());
    }

    function reorderMcuResultDocColumn(sheet) {
        if (!sheet || sheet.id !== PERSONNEL_HEALTH_SHEET_ID) return;
        const docCol = findMcuResultDocColumn(sheet);
        const anchorIdx = (sheet.columns || []).findIndex(c => isFinalMcuReviewStatusColumn(c));
        if (!docCol || anchorIdx < 0) return;
        const cols = sheet.columns;
        const docIdx = cols.findIndex(c => c.id === docCol.id);
        if (docIdx < 0 || docIdx === anchorIdx + 1) return;
        cols.splice(docIdx, 1);
        const newAnchor = cols.findIndex(c => isFinalMcuReviewStatusColumn(c));
        cols.splice(newAnchor + 1, 0, docCol);
    }

    function isMcuResultDocColumn(sheet, col) {
        if (!sheet || sheet.id !== PERSONNEL_HEALTH_SHEET_ID || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /mcu\s*result\s*doc/i.test(label) || col.id === MCU_RESULT_DOC_COL_ID || key.includes('mcu_result_doc');
    }

    function findMcuResultDocColumn(sheet) {
        return (sheet?.columns || []).find(c => isMcuResultDocColumn(sheet, c)) || null;
    }

    function virtualMcuResultDocColumn() {
        return {
            id: MCU_RESULT_DOC_COL_ID,
            key: 'doc_mcu_result_doc_7',
            label: 'MCU Result Doc',
            type: 'file',
            filterable: false,
            _virtual: true,
        };
    }

    function isCvDocColumn(sheet, col) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /^cv$/i.test(label) || col.id === CV_DOC_COL_ID || key.includes('doc_cv');
    }

    function findCvDocColumn(sheet) {
        return (sheet?.columns || []).find(c => isCvDocColumn(sheet, c)) || null;
    }

    function virtualCvDocColumn() {
        return {
            id: CV_DOC_COL_ID,
            key: 'doc_cv',
            label: 'CV',
            type: 'file',
            filterable: false,
            _virtual: true,
        };
    }

    function getKtpIdCol(sheet) {
        return getColByLabel(sheet, /ktp\s*id/i);
    }

    function isKtpUploadDocColumn(sheet, col) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /upload\s*ktp/i.test(label) || col.id === KTP_UPLOAD_DOC_COL_ID || key.includes('doc_ktp');
    }

    function findKtpUploadDocColumn(sheet) {
        return (sheet?.columns || []).find(c => isKtpUploadDocColumn(sheet, c)) || null;
    }

    function virtualKtpUploadDocColumn() {
        return {
            id: KTP_UPLOAD_DOC_COL_ID,
            key: 'doc_ktp_upload',
            label: 'Upload KTP',
            type: 'file',
            filterable: false,
            _virtual: true,
        };
    }

    function getBpjsNumberCol(sheet) {
        return getColByLabel(sheet, /bpjs\s*number/i);
    }

    function isBpjsNumberColumn(col) {
        if (!col) return false;
        return /bpjs\s*number/i.test((col.label || '').replace(/\*/g, '').trim());
    }

    function isBpjsUploadDocColumn(sheet, col) {
        if (!sheet || sheet.id !== EMERGENCY_CONTACT_SHEET_ID || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /upload\s*bpjs/i.test(label) || col.id === BPJS_UPLOAD_DOC_COL_ID || key.includes('doc_bpjs');
    }

    function findBpjsUploadDocColumn(sheet) {
        return (sheet?.columns || []).find(c => isBpjsUploadDocColumn(sheet, c)) || null;
    }

    function virtualBpjsUploadDocColumn() {
        return {
            id: BPJS_UPLOAD_DOC_COL_ID,
            key: 'doc_bpjs_upload',
            label: 'Upload BPJS',
            type: 'file',
            filterable: false,
            _virtual: true,
        };
    }

    function sanitizeBpjsNumber(val) {
        const s = String(val || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
        return s || 'UNKNOWN';
    }

    function reorderBpjsUploadDocColumn(sheet) {
        if (!sheet || sheet.id !== EMERGENCY_CONTACT_SHEET_ID) return;
        const docCol = findBpjsUploadDocColumn(sheet);
        const bpjsCol = getBpjsNumberCol(sheet);
        if (!docCol || !bpjsCol) return;
        const cols = sheet.columns;
        const docIdx = cols.findIndex(c => c.id === docCol.id);
        const bpjsIdx = cols.findIndex(c => c.id === bpjsCol.id);
        if (docIdx < 0 || bpjsIdx < 0 || docIdx === bpjsIdx + 1) return;
        cols.splice(docIdx, 1);
        const newBpjsIdx = cols.findIndex(c => c.id === bpjsCol.id);
        cols.splice(newBpjsIdx + 1, 0, docCol);
    }

    function getOtherInsuranceNumberCol(sheet) {
        return getColByLabel(sheet, /other\s*insurance\s*number/i);
    }

    function isOtherInsuranceNumberColumn(col) {
        if (!col) return false;
        return /other\s*insurance\s*number/i.test((col.label || '').replace(/\*/g, '').trim());
    }

    function isInsuranceUploadDocColumn(sheet, col) {
        if (!sheet || sheet.id !== EMERGENCY_CONTACT_SHEET_ID || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /upload\s*insurance/i.test(label) || col.id === INSURANCE_UPLOAD_DOC_COL_ID || key.includes('doc_insurance');
    }

    function findInsuranceUploadDocColumn(sheet) {
        return (sheet?.columns || []).find(c => isInsuranceUploadDocColumn(sheet, c)) || null;
    }

    function virtualInsuranceUploadDocColumn() {
        return {
            id: INSURANCE_UPLOAD_DOC_COL_ID,
            key: 'doc_insurance_upload',
            label: 'Upload Insurance',
            type: 'file',
            filterable: false,
            _virtual: true,
        };
    }

    function sanitizeInsuranceNumber(val) {
        const s = String(val || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
        return s || 'UNKNOWN';
    }

    function reorderInsuranceUploadDocColumn(sheet) {
        if (!sheet || sheet.id !== EMERGENCY_CONTACT_SHEET_ID) return;
        const docCol = findInsuranceUploadDocColumn(sheet);
        const insCol = getOtherInsuranceNumberCol(sheet);
        if (!docCol || !insCol) return;
        const cols = sheet.columns;
        const docIdx = cols.findIndex(c => c.id === docCol.id);
        const insIdx = cols.findIndex(c => c.id === insCol.id);
        if (docIdx < 0 || insIdx < 0 || docIdx === insIdx + 1) return;
        cols.splice(docIdx, 1);
        const newInsIdx = cols.findIndex(c => c.id === insCol.id);
        cols.splice(newInsIdx + 1, 0, docCol);
    }

    function reorderKtpUploadDocColumn(sheet) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return;
        const docCol = findKtpUploadDocColumn(sheet);
        const ktpCol = getKtpIdCol(sheet);
        if (!docCol || !ktpCol) return;
        const cols = sheet.columns;
        const docIdx = cols.findIndex(c => c.id === docCol.id);
        const ktpIdx = cols.findIndex(c => c.id === ktpCol.id);
        if (docIdx < 0 || ktpIdx < 0 || docIdx === ktpIdx + 1) return;
        cols.splice(docIdx, 1);
        const newKtpIdx = cols.findIndex(c => c.id === ktpCol.id);
        cols.splice(newKtpIdx + 1, 0, docCol);
        reorderSimColumns(sheet);
    }

    function getSimDateCol(sheet) {
        return (sheet?.columns || []).find(c => {
            const label = (c.label || '').replace(/\*/g, '').trim().toLowerCase();
            return c.type === 'date' && label === 'sim date';
        }) || null;
    }

    function getSimExpiryCol(sheet) {
        return (sheet?.columns || []).find(c => {
            const label = (c.label || '').replace(/\*/g, '').trim().toLowerCase();
            return c.type === 'date' && /sim\s*expir/i.test(label);
        }) || null;
    }

    function isSimExpiryColumn(col) {
        if (!col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim().toLowerCase();
        if (/siml/i.test(label)) return false;
        return label === 'sim expiry date';
    }

    function isSimUploadDocColumn(sheet, col) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /^upload\s*sim$/i.test(label) || col.id === SIM_UPLOAD_DOC_COL_ID || key === 'doc_sim_upload';
    }

    function getSimlSlot(slot) {
        return SIML_SLOTS.find(s => s.slot === slot) || null;
    }

    function parseSimlSlotFromCol(col) {
        if (!col) return null;
        for (const s of SIML_SLOTS) {
            const ids = [s.numberColId, s.locationColId, s.dateColId, s.expiryColId, s.uploadColId];
            if (ids.includes(col.id)) return s.slot;
            const label = normColLabel(col.label);
            if ([s.labels.number, s.labels.location, s.labels.date, s.labels.expiry, s.labels.upload]
                .some(l => normColLabel(l) === label)) {
                return s.slot;
            }
        }
        return null;
    }

    function isSimlProfileColumn(col) {
        return parseSimlSlotFromCol(col) !== null;
    }

    function isSimlExpiryColumn(col) {
        if (!col) return false;
        const slot = parseSimlSlotFromCol(col);
        if (!slot) return /siml(?:\s+\d+)?\s*expir/i.test((col.label || '').replace(/\*/g, '').trim());
        const s = getSimlSlot(slot);
        return col.id === s.expiryColId || normColLabel(col.label) === normColLabel(s.labels.expiry);
    }

    function isSimlDateColumn(sheet, col) {
        if (!sheet || !col || sheet.id !== PROFILE_SHEET_ID) return false;
        const slot = parseSimlSlotFromCol(col);
        if (!slot) return false;
        const s = getSimlSlot(slot);
        return col.id === s.dateColId || normColLabel(col.label) === normColLabel(s.labels.date);
    }

    function getSimlColBySlot(sheet, slot, field) {
        const s = getSimlSlot(slot);
        if (!s || !sheet) return null;
        const colId = s[`${field}ColId`];
        return (sheet.columns || []).find(c =>
            c.id === colId || normColLabel(c.label) === normColLabel(s.labels[field])
        ) || null;
    }

    function isSimlUploadDocColumn(sheet, col) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID || !col) return false;
        const slot = parseSimlSlotFromCol(col);
        if (!slot) return false;
        const s = getSimlSlot(slot);
        const label = (col.label || '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return col.id === s.uploadColId
            || normColLabel(label) === normColLabel(s.labels.upload)
            || key === s.uploadKey;
    }

    function virtualSimlColumn(slot, field) {
        const s = getSimlSlot(slot);
        const types = { number: 'text', location: 'text', date: 'date', expiry: 'date', upload: 'file' };
        return {
            id: s[`${field}ColId`],
            key: s[`${field}Key`],
            label: s.labels[field],
            type: types[field],
            filterable: field !== 'upload',
            _virtual: true,
        };
    }

    function sanitizeSimlSegment(val) {
        return String(val || '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'UNKNOWN';
    }

    function findHsePassportDocColumn(sheet, usedDocIds) {
        const expCol = findHsePassportExpiredColumn(sheet);
        if (!expCol) return null;
        return findDocColumnForExpiry(sheet, expCol, usedDocIds || new Set());
    }

    function simlPackageColumnsForSlot(sheet, slot) {
        const s = getSimlSlot(slot);
        return [
            getSimlColBySlot(sheet, slot, 'number') || virtualSimlColumn(slot, 'number'),
            getSimlColBySlot(sheet, slot, 'location') || virtualSimlColumn(slot, 'location'),
            getSimlColBySlot(sheet, slot, 'date') || virtualSimlColumn(slot, 'date'),
            getSimlColBySlot(sheet, slot, 'expiry') || virtualSimlColumn(slot, 'expiry'),
            getSimlColBySlot(sheet, slot, 'upload') || virtualSimlColumn(slot, 'upload'),
        ];
    }

    function appendSimlColumnsToOrder(sheet, orderedRest, placed) {
        if (sheet.id !== PROFILE_SHEET_ID) return;
        for (const s of SIML_SLOTS) {
            simlPackageColumnsForSlot(sheet, s.slot).forEach(c => {
                if (!placed.has(c.id)) {
                    orderedRest.push(c);
                    placed.add(c.id);
                }
            });
        }
    }

    function reorderSimlColumns(sheet) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return;
        const anchor = findHsePassportDocColumn(sheet) || getHsePassportNumberCol(sheet) || findHsePassportExpiredColumn(sheet);
        if (!anchor) return;
        const toInsert = SIML_SLOTS.flatMap(s => [
            getSimlColBySlot(sheet, s.slot, 'number'),
            getSimlColBySlot(sheet, s.slot, 'location'),
            getSimlColBySlot(sheet, s.slot, 'date'),
            getSimlColBySlot(sheet, s.slot, 'expiry'),
            getSimlColBySlot(sheet, s.slot, 'upload'),
        ]).filter(Boolean);
        if (!toInsert.length) return;
        const cols = sheet.columns;
        toInsert.forEach(c => {
            const idx = cols.findIndex(x => x.id === c.id);
            if (idx >= 0) cols.splice(idx, 1);
        });
        const anchorIdx = cols.findIndex(c => c.id === anchor.id);
        if (anchorIdx < 0) return;
        cols.splice(anchorIdx + 1, 0, ...toInsert);
    }

    function buildSimlDocFilename(sheet, row, file, personnelName, slotOrCol) {
        const slot = typeof slotOrCol === 'number' ? slotOrCol : parseSimlSlotFromCol(slotOrCol);
        const s = getSimlSlot(slot || 1);
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = sanitizeSimlSegment(pname);
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const locCol = getSimlColBySlot(sheet, s.slot, 'location');
        const location = sanitizeSimlSegment(locCol ? (row?.cells?.[locCol.id] || '') : '');
        const expiryCol = getSimlColBySlot(sheet, s.slot, 'expiry');
        const expiryRaw = expiryCol ? (row?.cells?.[expiryCol.id] || '') : '';
        const suffix = formatMcuExpirySuffix(expiryRaw);
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `SIML_${location}_${plCode}_${safeName}_${suffix}`;
        return ext ? `${base}.${ext}` : base;
    }

    function findSimUploadDocColumn(sheet) {
        return (sheet?.columns || []).find(c => isSimUploadDocColumn(sheet, c)) || null;
    }

    function virtualSimDateColumn() {
        return {
            id: SIM_DATE_COL_ID,
            key: 'sim_date',
            label: 'SIM Date',
            type: 'date',
            filterable: true,
            _virtual: true,
        };
    }

    function virtualSimExpiryColumn() {
        return {
            id: SIM_EXPIRY_COL_ID,
            key: 'sim_expiry_date',
            label: 'SIM Expiry Date',
            type: 'date',
            filterable: true,
            _virtual: true,
        };
    }

    function virtualSimUploadDocColumn() {
        return {
            id: SIM_UPLOAD_DOC_COL_ID,
            key: 'doc_sim_upload',
            label: 'Upload SIM',
            type: 'file',
            filterable: false,
            _virtual: true,
        };
    }

    function reorderSimColumns(sheet) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return;
        const ktpUpload = findKtpUploadDocColumn(sheet);
        const simDate = getSimDateCol(sheet);
        const simExpiry = getSimExpiryCol(sheet);
        const simUpload = findSimUploadDocColumn(sheet);
        if (!ktpUpload || !simDate || !simExpiry || !simUpload) return;
        const cols = sheet.columns;
        const simCols = [simDate, simExpiry, simUpload];
        simCols.forEach(c => {
            const idx = cols.findIndex(x => x.id === c.id);
            if (idx >= 0) cols.splice(idx, 1);
        });
        const anchorIdx = cols.findIndex(c => c.id === ktpUpload.id);
        if (anchorIdx < 0) return;
        cols.splice(anchorIdx + 1, 0, ...simCols);
    }

    function reorderCvDocColumn(sheet) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return;
        const docCol = findCvDocColumn(sheet);
        const plCol = getProductLineCol(sheet);
        if (!docCol || !plCol) return;
        const cols = sheet.columns;
        const docIdx = cols.findIndex(c => c.id === docCol.id);
        const plIdx = cols.findIndex(c => c.id === plCol.id);
        if (docIdx < 0 || plIdx < 0 || docIdx === plIdx + 1) return;
        cols.splice(docIdx, 1);
        const newPlIdx = cols.findIndex(c => c.id === plCol.id);
        cols.splice(newPlIdx + 1, 0, docCol);
    }

    function isSkckDateColumn(sheet, col) {
        if (!sheet || !col || sheet.id !== PROFILE_SHEET_ID) return false;
        const label = (col.label || '').replace(/\*/g, '').trim().toLowerCase();
        return label === 'skck date';
    }

    function isSkckDocUpload(sheet, col, columnName) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return false;
        const folder = (columnName || docColumnFolderName(col) || '').trim();
        if (/skck.*expir/i.test(folder)) return true;
        if (!col) return false;
        if (col.id && String(col.id).endsWith('_doc')) {
            const expId = col.id.replace(/_doc$/, '');
            const expCol = (sheet.columns || []).find(c => c.id === expId);
            if (expCol && /skck.*expir/i.test((expCol.label || '').replace(/\*/g, ''))) return true;
        }
        const label = (col.label || '').replace(/^Doc:\s/i, '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /skck.*expir/i.test(label) || /doc_.*skck.*expir|skck.*expir.*doc/i.test(key);
    }

    function findSkckExpiredColumn(sheet) {
        return (sheet?.columns || []).find(c =>
            c.type === 'date' && /skck.*expir/i.test((c.label || '').replace(/\*/g, '').trim())
        ) || null;
    }

    function buildSkckDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const expiryCol = findSkckExpiredColumn(sheet);
        const expiryRaw = expiryCol ? (row?.cells?.[expiryCol.id] || '') : '';
        const suffix = formatMcuExpirySuffix(expiryRaw);
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `SKCK_${plCode}_${safeName}_${suffix}`;
        return ext ? `${base}.${ext}` : base;
    }

    function isHsePassportDateColumn(sheet, col) {
        if (!sheet || !col) return false;
        const label = (col.label || '').replace(/\*/g, '').trim().toLowerCase();
        return /^hse passport date$/i.test(label);
    }

    function isSimDateColumn(sheet, col) {
        if (!sheet || !col || sheet.id !== PROFILE_SHEET_ID) return false;
        const label = (col.label || '').replace(/\*/g, '').trim().toLowerCase();
        return label === 'sim date';
    }

    function isSimDocUpload(sheet, col, columnName) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return false;
        const folder = (columnName || docColumnFolderName(col) || '').trim();
        if (/^upload\s*sim$/i.test(folder)) return true;
        if (!col) return false;
        return isSimUploadDocColumn(sheet, col);
    }

    function isSimlDocUpload(sheet, col, columnName) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return false;
        const folder = (columnName || docColumnFolderName(col) || '').trim();
        if (/^upload\s*siml(\s+\d+)?$/i.test(folder)) return true;
        if (!col) return false;
        return isSimlUploadDocColumn(sheet, col);
    }

    function buildSimDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const expiryCol = getSimExpiryCol(sheet);
        const expiryRaw = expiryCol ? (row?.cells?.[expiryCol.id] || '') : '';
        const suffix = formatMcuExpirySuffix(expiryRaw);
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `SIM_${plCode}_${safeName}_${suffix}`;
        return ext ? `${base}.${ext}` : base;
    }

    function isHsePassportDocUpload(sheet, col, columnName) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return false;
        const folder = (columnName || docColumnFolderName(col) || '').trim();
        if (/hse passport.*expir/i.test(folder)) return true;
        if (!col) return false;
        if (col.id && String(col.id).endsWith('_doc')) {
            const expId = col.id.replace(/_doc$/, '');
            const expCol = (sheet.columns || []).find(c => c.id === expId);
            if (expCol && /hse passport.*expir/i.test((expCol.label || '').replace(/\*/g, ''))) return true;
        }
        const label = (col.label || '').replace(/^Doc:\s/i, '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /hse passport.*expir/i.test(label) || /doc_.*hse passport.*expir|hse passport.*expir.*doc/i.test(key);
    }

    function findHsePassportExpiredColumn(sheet) {
        return (sheet?.columns || []).find(c =>
            c.type === 'date' && /hse passport.*expir/i.test((c.label || '').replace(/\*/g, '').trim())
        ) || null;
    }

    function isHsePassportExpiredColumn(col) {
        if (!col) return false;
        return /hse passport.*expir/i.test((col.label || '').replace(/\*/g, '').trim());
    }

    function isHsePassportNumberColumn(col) {
        if (!col) return false;
        return /hse passport.*number/i.test((col.label || '').replace(/\*/g, '').trim())
            || col.id === HSE_PASSPORT_NUMBER_COL_ID;
    }

    function getHsePassportNumberCol(sheet) {
        return (sheet?.columns || []).find(c => isHsePassportNumberColumn(c)) || null;
    }

    function virtualHsePassportNumberColumn() {
        return {
            id: HSE_PASSPORT_NUMBER_COL_ID,
            key: 'hse_passport_number',
            label: 'HSE Passport Number',
            type: 'text',
            filterable: true,
            _virtual: true,
        };
    }

    function reorderHsePassportNumberColumn(sheet) {
        if (!sheet || sheet.id !== PROFILE_SHEET_ID) return;
        const numCol = getHsePassportNumberCol(sheet);
        const expCol = findHsePassportExpiredColumn(sheet);
        if (!numCol || !expCol) return;
        const cols = sheet.columns;
        const numIdx = cols.findIndex(c => c.id === numCol.id);
        const expIdx = cols.findIndex(c => c.id === expCol.id);
        if (numIdx < 0 || expIdx < 0 || numIdx === expIdx + 1) return;
        cols.splice(numIdx, 1);
        const newExpIdx = cols.findIndex(c => c.id === expCol.id);
        cols.splice(newExpIdx + 1, 0, numCol);
    }

    function buildHsePassportDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const expiryCol = findHsePassportExpiredColumn(sheet);
        const expiryRaw = expiryCol ? (row?.cells?.[expiryCol.id] || '') : '';
        const suffix = formatMcuExpirySuffix(expiryRaw);
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `HSE PASSPORT_${plCode}_${safeName}_${suffix}`;
        return ext ? `${base}.${ext}` : base;
    }

    function buildKtpUploadDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `KTP_${plCode}_${safeName}`;
        return ext ? `${base}.${ext}` : base;
    }

    function buildInsuranceDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const insCol = getOtherInsuranceNumberCol(sheet);
        const insNum = sanitizeInsuranceNumber(insCol ? (row?.cells?.[insCol.id] || '') : '');
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `INSURANCE_${plCode}_${safeName}_${insNum}`;
        return ext ? `${base}.${ext}` : base;
    }

    function buildBpjsDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const bpjsCol = getBpjsNumberCol(sheet);
        const bpjsNum = sanitizeBpjsNumber(bpjsCol ? (row?.cells?.[bpjsCol.id] || '') : '');
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `BPJS_${plCode}_${safeName}_${bpjsNum}`;
        return ext ? `${base}.${ext}` : base;
    }

    function pelatihanFilePrefixFromLabel(label) {
        const l = (label || '').replace(/\*/g, '').trim().toLowerCase();
        if (!/expir/i.test(l)) return null;
        for (const [token, prefix] of PELATIHAN_FILE_PREFIXES) {
            if (l.includes(token)) return prefix;
        }
        return null;
    }

    function getPelatihanDocPrefix(sheet, col, columnName) {
        const folder = (columnName || docColumnFolderName(col) || '').trim();
        const fromFolder = pelatihanFilePrefixFromLabel(folder);
        if (fromFolder) return fromFolder;
        if (!sheet || !col) return null;
        const label = (col.label || '').replace(/^Doc:\s/i, '').replace(/\*/g, '').trim();
        const fromLabel = pelatihanFilePrefixFromLabel(label);
        if (fromLabel) return fromLabel;
        if (col.id && String(col.id).endsWith('_doc')) {
            const expId = col.id.replace(/_doc$/, '');
            const expCol = (sheet.columns || []).find(c => c.id === expId);
            if (expCol) return pelatihanFilePrefixFromLabel(expCol.label);
        }
        return null;
    }

    function isPelatihanTrainingDocUpload(sheet, col, columnName) {
        if (!sheet || sheet.id !== TRAINING_SHEET_ID) return false;
        return getPelatihanDocPrefix(sheet, col, columnName) !== null;
    }

    function findTrainingExpiryColumn(sheet, prefix) {
        return (sheet?.columns || []).find(c =>
            c.type === 'date' && pelatihanFilePrefixFromLabel(c.label) === prefix
        ) || null;
    }

    function sortPelatihanDisplayColumns(cols, sheet) {
        if (!sheet || sheet.id !== TRAINING_SHEET_ID || !cols.length) return cols;
        const packageLabelSet = new Set();
        PELATIHAN_EXTRA_TRAININGS.forEach(t => {
            packageLabelSet.add(normColLabel(t.dateLabel));
            packageLabelSet.add(normColLabel(t.expiryLabel));
            packageLabelSet.add(normColLabel(t.agencyLabel));
        });
        const isPackageDataCol = c => packageLabelSet.has(normColLabel(c.label));
        const isPackageDocCol = c =>
            isDocUploadColumn(c) && getPelatihanDocPrefix(sheet, c, docColumnFolderName(c));
        const anchorIdx = cols.findIndex(c => normColLabel(c.label) === 'one sika training location');
        if (anchorIdx < 0) return cols;
        const before = cols.slice(0, anchorIdx + 1);
        const after = cols.slice(anchorIdx + 1).filter(c => !isPackageDataCol(c) && !isPackageDocCol(c));
        const packages = [];
        PELATIHAN_EXTRA_TRAININGS.forEach(spec => {
            const dateCol = cols.find(c => normColLabel(c.label) === normColLabel(spec.dateLabel));
            const expCol = cols.find(c => normColLabel(c.label) === normColLabel(spec.expiryLabel));
            const agencyCol = cols.find(c => normColLabel(c.label) === normColLabel(spec.agencyLabel));
            if (dateCol) packages.push(dateCol);
            if (expCol) packages.push(expCol);
            if (agencyCol) packages.push(agencyCol);
            if (expCol) {
                const docCol = cols.find(c =>
                    (c.id === docColumnIdFor(expCol) || docColumnMatchesExpiry(c, expCol)) && isDocUploadColumn(c)
                );
                if (docCol) packages.push(docCol);
            }
        });
        return before.concat(packages, after);
    }

    function buildPelatihanDocFilename(sheet, row, file, personnelName, col, columnName) {
        const prefix = getPelatihanDocPrefix(sheet, col, columnName) || 'DOC';
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const expiryCol = findTrainingExpiryColumn(sheet, prefix);
        const expiryRaw = expiryCol ? (row?.cells?.[expiryCol.id] || '') : '';
        const suffix = formatMcuExpirySuffix(expiryRaw);
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `${prefix}_${plCode}_${safeName}_${suffix}`;
        return ext ? `${base}.${ext}` : base;
    }

    function docUploadFolderName(sheet, col) {
        if (isPelatihanTrainingDocUpload(sheet, col, docColumnFolderName(col))) return PELATIHAN_SHARED_DRIVE_FOLDER;
        if (sheet?.id === PROFILE_SHEET_ID && (
            isSimlUploadDocColumn(sheet, col) ||
            isKtpUploadDocColumn(sheet, col) ||
            isSimDocUpload(sheet, col, docColumnFolderName(col)) ||
            isHsePassportDocUpload(sheet, col, docColumnFolderName(col)) ||
            isCvDocColumn(sheet, col) ||
            isSkckDocUpload(sheet, col, docColumnFolderName(col))
        )) {
            return DATA_PERSONEL_SHARED_DRIVE_FOLDER;
        }
        if (sheet?.id === PERSONNEL_HEALTH_SHEET_ID && (
            isMcuResultDocColumn(sheet, col) ||
            isMcuDocUpload(sheet, col, docColumnFolderName(col))
        )) {
            return DATA_PERSONEL_SHARED_DRIVE_FOLDER;
        }
        if (sheet?.id === EMERGENCY_CONTACT_SHEET_ID && (
            isInsuranceUploadDocColumn(sheet, col) ||
            isBpjsUploadDocColumn(sheet, col)
        )) {
            return DATA_PERSONEL_SHARED_DRIVE_FOLDER;
        }
        return docColumnFolderName(col);
    }

    function resolvePositionForRow(sheet, row) {
        const posCol = getPositionCol(sheet);
        const fromRow = posCol ? (row?.cells?.[posCol.id] || '').trim() : '';
        if (fromRow) return fromRow;
        const trainingSheet = sheetById('employee_mandatory_training');
        const profileRow = sheet?.id === PROFILE_SHEET_ID ? row : findPersonnelProfileRow(sheet, row);
        if (trainingSheet && profileRow) {
            const tr = findRowInSheet(trainingSheet, profileRow);
            const tPos = getPositionCol(trainingSheet);
            if (tr && tPos) return (tr.cells?.[tPos.id] || '').trim();
        }
        return '';
    }

    function docColumnMatchesExpiry(docCol, expiryCol) {
        if (!docCol || !expiryCol || !isDocUploadColumn(docCol)) return false;
        if (docCol.id === docColumnIdFor(expiryCol)) return true;
        const target = normColLabel(docColumnLabelFor(expiryCol));
        const docNorm = normColLabel(docCol.label);
        const expNorm = normColLabel(expiryCol.label);
        if (docNorm === target || docNorm === expNorm) return true;
        const key = (docCol.key || '').toLowerCase();
        if (key === `doc_${(expiryCol.key || expiryCol.id).toLowerCase()}`) return true;
        return false;
    }

    function findDocColumnForExpiry(sheet, expiryCol, usedDocIds) {
        const used = usedDocIds || new Set();
        const matches = (sheet?.columns || []).filter(
            c => isDocUploadColumn(c) && docColumnMatchesExpiry(c, expiryCol) && !used.has(c.id)
        );
        if (!matches.length) return null;
        const preferredId = docColumnIdFor(expiryCol);
        return (
            matches.find(c => c.id === preferredId) ||
            matches.find(c => /^doc:\s/i.test((c.label || '').replace(/\*/g, '').trim())) ||
            matches[0]
        );
    }

    function docColumnFolderName(col) {
        return (col?.label || '').replace(/^Doc:\s/i, '').replace(/\*/g, '').trim() || 'Documents';
    }

    const MCU_MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    function parseMatrixDate(val) {
        if (!val) return null;
        const s = String(val).trim();
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
        const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function formatMcuExpirySuffix(val) {
        const d = parseMatrixDate(val);
        if (!d) return 'UNKNOWN';
        return `${MCU_MONTH_ABBR[d.getMonth()]}${String(d.getFullYear() % 100).padStart(2, '0')}`;
    }

    function abbreviateProductLine(name) {
        const s = String(name || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
        if (!s) return 'UNKNOWN';
        if (s.length <= 6 && !/\s/.test(s)) return s.toUpperCase();
        const words = s.match(/[A-Za-z0-9]+/g);
        if (!words?.length) return 'UNKNOWN';
        return words.map(w => w[0].toUpperCase()).join('').slice(0, 12);
    }

    function resolveProductLineForRow(sheet, row, personnelName) {
        const plCol = getProductLineCol(sheet);
        const fromRow = plCol ? (row?.cells?.[plCol.id] || '').trim() : '';
        if (fromRow) return fromRow;
        const profileSheet = sheetById(PROFILE_SHEET_ID);
        const profileRow = findPersonnelProfileRow(sheet, row);
        const fromProfile = personnelFieldFromRows(/product line/i, profileSheet, profileRow, sheet, row);
        if (fromProfile) return fromProfile;
        return getSelectedProductLineName();
    }

    function isMcuDocUpload(sheet, col, columnName) {
        if (!sheet || sheet.id !== PERSONNEL_HEALTH_SHEET_ID) return false;
        const folder = (columnName || docColumnFolderName(col) || '').trim();
        if (/mcu\s*expired/i.test(folder)) return true;
        if (!col) return false;
        if (col.id && String(col.id).endsWith('_doc')) {
            const expId = col.id.replace(/_doc$/, '');
            const expCol = (sheet.columns || []).find(c => c.id === expId);
            if (expCol && /mcu\s*expired/i.test((expCol.label || '').replace(/\*/g, ''))) return true;
        }
        const label = (col.label || '').replace(/^Doc:\s/i, '').replace(/\*/g, '').trim();
        const key = (col.key || '').toLowerCase();
        return /mcu\s*expired/i.test(label) || /doc_.*mcu.*expired|mcu.*expired.*doc/i.test(key);
    }

    function findMcuExpiredColumn(sheet) {
        return (sheet?.columns || []).find(c =>
            c.type === 'date' && /mcu\s*expired/i.test((c.label || '').replace(/\*/g, '').trim())
        ) || null;
    }

    function findMcuReviewResultsColumn(sheet) {
        return (sheet?.columns || []).find(c => isMcuReviewResultsColumn(c)) || null;
    }

    function findMcuReviewClientDateColumn(sheet) {
        return (sheet?.columns || []).find(c =>
            /mcu\s*review\s*\(client\)\s*date/i.test((c.label || '').replace(/\*/g, '').trim())
        ) || null;
    }

    function buildMcuReviewDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const dateCol = findMcuReviewClientDateColumn(sheet);
        const dateRaw = dateCol ? (row?.cells?.[dateCol.id] || '') : '';
        const dateSuffix = formatMcuExpirySuffix(dateRaw);
        const resultCol = findMcuReviewResultsColumn(sheet);
        const resultRaw = resultCol ? (row?.cells?.[resultCol.id] || '') : '';
        const resultCode = String(resultRaw).replace(/[\\/:*?"<>|]+/g, '-').trim().toUpperCase() || 'UNKNOWN';
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `MCU REVIEW_${plCode}_${safeName}_${dateSuffix}_${resultCode}`;
        return ext ? `${base}.${ext}` : base;
    }

    function buildCvDocFilename(sheet, row, file, personnelName) {
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const position = String(resolvePositionForRow(sheet, row))
            .replace(/[\\/:*?"<>|]+/g, '-').trim().toUpperCase() || 'UNKNOWN';
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `CV_${plCode}_${safeName}_${position}`;
        return ext ? `${base}.${ext}` : base;
    }

    function buildMatrixDocFilename(sheet, row, col, file, personnelName, columnName) {
        if (isPelatihanTrainingDocUpload(sheet, col, columnName)) {
            return buildPelatihanDocFilename(sheet, row, file, personnelName, col, columnName);
        }
        if (isSimlUploadDocColumn(sheet, col) || isSimlDocUpload(sheet, col, columnName)) {
            return buildSimlDocFilename(sheet, row, file, personnelName, col);
        }
        if (isInsuranceUploadDocColumn(sheet, col)) {
            return buildInsuranceDocFilename(sheet, row, file, personnelName);
        }
        if (isBpjsUploadDocColumn(sheet, col)) {
            return buildBpjsDocFilename(sheet, row, file, personnelName);
        }
        if (isKtpUploadDocColumn(sheet, col)) {
            return buildKtpUploadDocFilename(sheet, row, file, personnelName);
        }
        if (isSimDocUpload(sheet, col, columnName)) {
            return buildSimDocFilename(sheet, row, file, personnelName);
        }
        if (isHsePassportDocUpload(sheet, col, columnName)) {
            return buildHsePassportDocFilename(sheet, row, file, personnelName);
        }
        if (isCvDocColumn(sheet, col)) {
            return buildCvDocFilename(sheet, row, file, personnelName);
        }
        if (isSkckDocUpload(sheet, col, columnName)) {
            return buildSkckDocFilename(sheet, row, file, personnelName);
        }
        if (isMcuResultDocColumn(sheet, col)) {
            return buildMcuReviewDocFilename(sheet, row, file, personnelName);
        }
        if (!isMcuDocUpload(sheet, col, columnName)) return file.name;
        const nameCol = (sheet.columns || []).find(c => /personnel\s*name/i.test(c.label || ''));
        const pname = (nameCol && row?.cells?.[nameCol.id]) || personnelName || 'Unknown Personnel';
        const safeName = String(pname).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Unknown Personnel';
        const plCode = abbreviateProductLine(resolveProductLineForRow(sheet, row, safeName));
        const expiryCol = findMcuExpiredColumn(sheet);
        const expiryRaw = expiryCol ? (row?.cells?.[expiryCol.id] || '') : '';
        const suffix = formatMcuExpirySuffix(expiryRaw);
        const parts = (file.name || 'document').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const base = `MCU_${plCode}_${safeName}_${suffix}`;
        return ext ? `${base}.${ext}` : base;
    }

    function parseDocCellValue(val) {
        if (!val) return { fileId: '', fileName: '' };
        const s = String(val).trim();
        const sep = s.indexOf('::');
        if (sep > 0) {
            return { fileId: s.slice(0, sep), fileName: s.slice(sep + 2) };
        }
        if (/^[a-zA-Z0-9_-]{12,}$/.test(s)) return { fileId: s, fileName: '' };
        return { fileId: '', fileName: s };
    }

    function docViewUrl(fileId) {
        return `${apiBase()}/matrix/document/view/${encodeURIComponent(fileId)}`;
    }

    function rowPersonnelName(sheet, row) {
        const profileRow = findPersonnelProfileRow(sheet, row);
        return profileName(profileRow) || profileName(row) || 'Unknown Personnel';
    }

    function findPairedExpiryColumn(sheet, sourceCol) {
        if (!sheet || !sourceCol) return null;
        const cols = sheet.columns || [];
        const srcLabel = sourceCol.label.replace(/\*/g, '').trim().toLowerCase();

        for (const s of SIML_SLOTS) {
            if (normColLabel(sourceCol.label) === normColLabel(s.labels.date)) {
                const found = cols.find(c => normColLabel(c.label) === normColLabel(s.labels.expiry));
                if (found) return found;
            }
        }

        const labelPairs = [
            [/bst training/i, /bst expiry/i],
            [/sbtc date/i, /sbtc expiry/i],
            [/one sika.*(train|traiin)/i, /one sika expiry/i],
            [/^mcu date$/i, /mcu expired/i],
            [/skck date/i, /skck expiry/i],
            [/hse passport date/i, /hse passport expired/i],
            [/^sim date$/i, /^sim expiry date$/i],
            [/contract start/i, /contract end/i],
            ...PELATIHAN_EXTRA_TRAININGS.map(t => [
                new RegExp(`^${t.dateLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                new RegExp(t.expiryLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
            ]),
        ];

        for (const [srcRe, expRe] of labelPairs) {
            if (srcRe.test(srcLabel)) {
                const found = cols.find(c => expRe.test((c.label || '').replace(/\*/g, '').trim()));
                if (found) return found;
            }
        }

        const prefix = srcLabel.replace(/\s*date\s*$/, '').trim();
        if (prefix) {
            const found = cols.find(c => {
                const l = (c.label || '').replace(/\*/g, '').trim().toLowerCase();
                return l.includes(prefix) && isExpiryDateColumn(c);
            });
            if (found) return found;
        }

        const srcIdx = cols.findIndex(c => c.id === sourceCol.id);
        for (let i = srcIdx + 1; i < cols.length; i++) {
            if (isExpiryDateColumn(cols[i])) return cols[i];
        }
        return null;
    }

    function isMcuDateColumn(sheet, col) {
        if (!sheet || !col || sheet.id !== PERSONNEL_HEALTH_SHEET_ID) return false;
        const label = (col.label || '').replace(/\*/g, '').trim().toLowerCase();
        return label === 'mcu date';
    }

    function shouldPromptReminder(sheet, col) {
        if (!col || col.type !== 'date' || !sheet) return false;
        if (isExpiryDateColumn(col)) return false;
        if (isMcuDateColumn(sheet, col)) return false;
        if (isSkckDateColumn(sheet, col)) return false;
        if (isHsePassportDateColumn(sheet, col)) return false;
        if (isSimDateColumn(sheet, col)) return false;
        if (isSimlDateColumn(sheet, col)) return false;
        const label = col.label.replace(/\*/g, '').trim().toLowerCase();
        if (/birth date|booster.*date|review \(client\) date|follow up date/i.test(label)) return false;
        return !!findPairedExpiryColumn(sheet, col);
    }

    async function applySkckDateWithAutoExpiry(input, sheet, col) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const newVal = input.value;
        const oldVal = input.dataset.prev ?? '';
        if (oldVal === newVal) return;

        if (!newVal) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryCol = findPairedExpiryColumn(sheet, col);
        if (!expiryCol) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryVal = addMonthsToIsoDate(newVal, SKCK_AUTO_VALIDITY_MONTHS);
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        const oldExpiry = row?.cells?.[expiryCol.id] ?? '';

        input.dataset.saving = '1';
        try {
            await applyCellsUpdate(sheetId, rowId, {
                [colId]: newVal,
                [expiryCol.id]: expiryVal,
            });
            input.dataset.prev = newVal;
            pushHistory({
                desc: 'SKCK Date + auto SKCK Expiry (+6 bulan)',
                undo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: oldVal, [expiryCol.id]: oldExpiry });
                    paintMatrixScreen();
                },
                redo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: newVal, [expiryCol.id]: expiryVal });
                    paintMatrixScreen();
                },
            });
            const fmt = (v) => {
                const d = parseDate(v);
                if (!d) return v;
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };
            showToast?.(
                `SKCK Expiry otomatis ${fmt(expiryVal)} (+6 bulan). Email reminder ~1 bulan sebelum expired.`,
                'success'
            );
            paintMatrixScreen();
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || 'Gagal menyimpan SKCK Date', 'error');
        } finally {
            delete input.dataset.saving;
        }
    }

    async function applySimDateWithAutoExpiry(input, sheet, col) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const newVal = input.value;
        const oldVal = input.dataset.prev ?? '';
        if (oldVal === newVal) return;

        if (!newVal) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryCol = findPairedExpiryColumn(sheet, col);
        if (!expiryCol) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryVal = addMonthsToIsoDate(newVal, SIM_AUTO_VALIDITY_MONTHS);
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        const oldExpiry = row?.cells?.[expiryCol.id] ?? '';

        input.dataset.saving = '1';
        try {
            await applyCellsUpdate(sheetId, rowId, {
                [colId]: newVal,
                [expiryCol.id]: expiryVal,
            });
            input.dataset.prev = newVal;
            pushHistory({
                desc: 'SIM Date + auto SIM Expiry Date (+5 tahun)',
                undo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: oldVal, [expiryCol.id]: oldExpiry });
                    paintMatrixScreen();
                },
                redo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: newVal, [expiryCol.id]: expiryVal });
                    paintMatrixScreen();
                },
            });
            const fmt = (v) => {
                const d = parseDate(v);
                if (!d) return v;
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };
            showToast?.(
                `SIM Expiry Date otomatis ${fmt(expiryVal)} (+5 tahun). Email reminder ~3 bulan sebelum expired.`,
                'success'
            );
            paintMatrixScreen();
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || 'Gagal menyimpan SIM Date', 'error');
        } finally {
            delete input.dataset.saving;
        }
    }

    async function applySimlDateWithAutoExpiry(input, sheet, col) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const newVal = input.value;
        const oldVal = input.dataset.prev ?? '';
        if (oldVal === newVal) return;

        if (!newVal) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryCol = findPairedExpiryColumn(sheet, col);
        if (!expiryCol) {
            await matrixOnCellChange(input);
            return;
        }

        const slot = parseSimlSlotFromCol(col) || 1;
        const slotCfg = getSimlSlot(slot);
        const expiryVal = addMonthsToIsoDate(newVal, SIML_AUTO_VALIDITY_MONTHS);
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        const oldExpiry = row?.cells?.[expiryCol.id] ?? '';

        input.dataset.saving = '1';
        try {
            await applyCellsUpdate(sheetId, rowId, {
                [colId]: newVal,
                [expiryCol.id]: expiryVal,
            });
            input.dataset.prev = newVal;
            pushHistory({
                desc: `${slotCfg.labels.date} + auto ${slotCfg.labels.expiry} (+1 tahun)`,
                undo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: oldVal, [expiryCol.id]: oldExpiry });
                    paintMatrixScreen();
                },
                redo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: newVal, [expiryCol.id]: expiryVal });
                    paintMatrixScreen();
                },
            });
            const fmt = (v) => {
                const d = parseDate(v);
                if (!d) return v;
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };
            showToast?.(
                `${slotCfg.labels.expiry} otomatis ${fmt(expiryVal)} (+1 tahun). Email reminder ~3 bulan sebelum expired.`,
                'success'
            );
            paintMatrixScreen();
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || `Gagal menyimpan ${slotCfg.labels.date}`, 'error');
        } finally {
            delete input.dataset.saving;
        }
    }

    async function applyHsePassportDateWithAutoExpiry(input, sheet, col) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const newVal = input.value;
        const oldVal = input.dataset.prev ?? '';
        if (oldVal === newVal) return;

        if (!newVal) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryCol = findPairedExpiryColumn(sheet, col);
        if (!expiryCol) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryVal = addMonthsToIsoDate(newVal, HSE_PASSPORT_AUTO_VALIDITY_MONTHS);
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        const oldExpiry = row?.cells?.[expiryCol.id] ?? '';

        input.dataset.saving = '1';
        try {
            await applyCellsUpdate(sheetId, rowId, {
                [colId]: newVal,
                [expiryCol.id]: expiryVal,
            });
            input.dataset.prev = newVal;
            pushHistory({
                desc: 'HSE Passport Date + auto HSE Passport Expired (+12 bulan)',
                undo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: oldVal, [expiryCol.id]: oldExpiry });
                    paintMatrixScreen();
                },
                redo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: newVal, [expiryCol.id]: expiryVal });
                    paintMatrixScreen();
                },
            });
            const fmt = (v) => {
                const d = parseDate(v);
                if (!d) return v;
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };
            showToast?.(
                `HSE Passport Expired otomatis ${fmt(expiryVal)} (+12 bulan). Email reminder ~3 bulan sebelum expired.`,
                'success'
            );
            paintMatrixScreen();
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || 'Gagal menyimpan HSE Passport Date', 'error');
        } finally {
            delete input.dataset.saving;
        }
    }

    async function applyMcuDateWithAutoExpiry(input, sheet, col) {
        const sheetId = input.dataset.sheet;
        const rowId = input.dataset.row;
        const colId = input.dataset.col;
        const newVal = input.value;
        const oldVal = input.dataset.prev ?? '';
        if (oldVal === newVal) return;

        if (!newVal) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryCol = findPairedExpiryColumn(sheet, col);
        if (!expiryCol) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryVal = addMonthsToIsoDate(newVal, MCU_AUTO_VALIDITY_MONTHS);
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        const oldExpiry = row?.cells?.[expiryCol.id] ?? '';

        input.dataset.saving = '1';
        try {
            await applyCellsUpdate(sheetId, rowId, {
                [colId]: newVal,
                [expiryCol.id]: expiryVal,
            });
            input.dataset.prev = newVal;
            pushHistory({
                desc: 'MCU Date + auto MCU Expired (+12 bulan)',
                undo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: oldVal, [expiryCol.id]: oldExpiry });
                    paintMatrixScreen();
                },
                redo: async () => {
                    await applyCellsUpdate(sheetId, rowId, { [colId]: newVal, [expiryCol.id]: expiryVal });
                    paintMatrixScreen();
                },
            });
            const fmt = (v) => {
                const d = parseDate(v);
                if (!d) return v;
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };
            showToast?.(
                `MCU Expired otomatis ${fmt(expiryVal)} (+12 bulan). Email reminder ~3 bulan sebelum expired.`,
                'success'
            );
            paintMatrixScreen();
        } catch (e) {
            input.value = oldVal;
            showToast?.(e.message || 'Gagal menyimpan MCU Date', 'error');
        } finally {
            delete input.dataset.saving;
        }
    }

    function addMonthsToIsoDate(isoDate, months) {
        const d = parseDate(isoDate);
        if (!d || !months) return '';
        const out = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
        const y = out.getFullYear();
        const m = String(out.getMonth() + 1).padStart(2, '0');
        const day = String(out.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function showReminderModal(step) {
        const modal = document.getElementById('mx-reminder-modal');
        const step1 = document.getElementById('mx-reminder-step1');
        const step2 = document.getElementById('mx-reminder-step2');
        if (!modal) return;
        modal.classList.add('active');
        modal.hidden = false;
        if (step1) step1.hidden = step !== 1;
        if (step2) step2.hidden = step !== 2;
        if (step === 2) {
            const inp = document.getElementById('mx-reminder-months');
            if (inp) {
                inp.value = '12';
                setTimeout(() => inp.focus(), 50);
            }
        }
    }

    function hideReminderModal() {
        const modal = document.getElementById('mx-reminder-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.hidden = true;
        }
        REMINDER_PENDING = null;
    }

    async function saveSourceDateOnly(pending) {
        const { sheetId, rowId, colId, newVal, input } = pending;
        await applyCellUpdate(sheetId, rowId, colId, newVal);
        if (input) {
            input.value = newVal;
            input.dataset.prev = newVal;
        }
    }

    async function saveSourceAndExpiry(pending, months) {
        const { sheetId, rowId, colId, expiryColId, newVal, oldVal, input } = pending;
        const expiryVal = addMonthsToIsoDate(newVal, months);
        const row = sheetById(sheetId)?.rows?.find(r => r.id === rowId);
        const oldExpiry = row?.cells?.[expiryColId] ?? '';

        await applyCellsUpdate(sheetId, rowId, {
            [colId]: newVal,
            [expiryColId]: expiryVal,
        });

        if (input) {
            input.value = newVal;
            input.dataset.prev = newVal;
        }

        pushHistory({
            desc: 'Tanggal + validity',
            undo: async () => {
                await applyCellsUpdate(sheetId, rowId, { [colId]: oldVal, [expiryColId]: oldExpiry });
                paintMatrixScreen();
            },
            redo: async () => {
                await applyCellsUpdate(sheetId, rowId, { [colId]: newVal, [expiryColId]: expiryVal });
                paintMatrixScreen();
            },
        });

        return expiryVal;
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

    function isStickyPinColumn(col) {
        if (!col) return false;
        const label = normColLabel(col.label);
        return label === 'no' || /personnel\s*name/.test(label);
    }

    function stickyThClass(col) {
        if (!isStickyPinColumn(col)) return '';
        const label = normColLabel(col.label);
        if (label === 'no') return ' mx-sticky-no';
        if (/personnel\s*name/.test(label)) return ' mx-sticky-name';
        return '';
    }

    function stickyTdClass(col) {
        return stickyThClass(col);
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

    function virtualDocColumnFor(expiryCol) {
        const docId = docColumnIdFor(expiryCol);
        return {
            id: docId,
            key: `doc_${expiryCol.key || expiryCol.id}`,
            label: docColumnLabelFor(expiryCol),
            type: 'file',
            filterable: false,
            _virtual: true,
        };
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
        const ktpCol = sheet.id === PROFILE_SHEET_ID ? getKtpIdCol(sheet) : null;
        if (ktpCol) {
            ordered.push(ktpCol);
            pinned.add(ktpCol.id);
            let ktpUpload = findKtpUploadDocColumn(sheet);
            if (!ktpUpload) ktpUpload = virtualKtpUploadDocColumn();
            if (!pinned.has(ktpUpload.id)) {
                ordered.push(ktpUpload);
                pinned.add(ktpUpload.id);
            }
            let simDate = getSimDateCol(sheet);
            if (!simDate) simDate = virtualSimDateColumn();
            if (!pinned.has(simDate.id)) {
                ordered.push(simDate);
                pinned.add(simDate.id);
            }
            let simExpiry = getSimExpiryCol(sheet);
            if (!simExpiry) simExpiry = virtualSimExpiryColumn();
            if (!pinned.has(simExpiry.id)) {
                ordered.push(simExpiry);
                pinned.add(simExpiry.id);
            }
            let simUpload = findSimUploadDocColumn(sheet);
            if (!simUpload) simUpload = virtualSimUploadDocColumn();
            if (!pinned.has(simUpload.id)) {
                ordered.push(simUpload);
                pinned.add(simUpload.id);
            }
        }
        if (photoCol) { ordered.push(photoCol); pinned.add(photoCol.id); }
        if (posCol && !pinned.has(posCol.id)) { ordered.push(posCol); pinned.add(posCol.id); }
        if (plCol && !pinned.has(plCol.id)) { ordered.push(plCol); pinned.add(plCol.id); }
        if (sheet.id === PROFILE_SHEET_ID) {
            let cvCol = findCvDocColumn(sheet);
            if (!cvCol) cvCol = virtualCvDocColumn();
            if (!pinned.has(cvCol.id)) {
                ordered.push(cvCol);
                pinned.add(cvCol.id);
            }
        }

        const rest = cols.filter(c => !pinned.has(c.id));
        const orderedRest = [];
        const placed = new Set();
        const usedDocIds = new Set();

        rest.forEach(c => {
            if (placed.has(c.id) || isDocUploadColumn(c)) return;
            if (isHsePassportNumberColumn(c) || isSimlProfileColumn(c)) return;
            orderedRest.push(c);
            placed.add(c.id);
            if (isExpiryDateColumn(c) && !isSimExpiryColumn(c) && !isSimlExpiryColumn(c)) {
                if (sheet.id === PROFILE_SHEET_ID && isHsePassportExpiredColumn(c)) {
                    let hseNum = getHsePassportNumberCol(sheet);
                    if (!hseNum) hseNum = virtualHsePassportNumberColumn();
                    if (!placed.has(hseNum.id)) {
                        orderedRest.push(hseNum);
                        placed.add(hseNum.id);
                    }
                }
                let docCol = findDocColumnForExpiry(sheet, c, usedDocIds);
                if (!docCol) docCol = virtualDocColumnFor(c);
                if (docCol && !placed.has(docCol.id)) {
                    orderedRest.push(docCol);
                    placed.add(docCol.id);
                    if (!docCol._virtual) usedDocIds.add(docCol.id);
                    if (sheet.id === PROFILE_SHEET_ID && isHsePassportExpiredColumn(c)) {
                        appendSimlColumnsToOrder(sheet, orderedRest, placed);
                    }
                }
            }
            if (sheet.id === EMERGENCY_CONTACT_SHEET_ID && isBpjsNumberColumn(c)) {
                let bpjsUpload = findBpjsUploadDocColumn(sheet);
                if (!bpjsUpload) bpjsUpload = virtualBpjsUploadDocColumn();
                if (!placed.has(bpjsUpload.id)) {
                    orderedRest.push(bpjsUpload);
                    placed.add(bpjsUpload.id);
                }
            }
            if (sheet.id === EMERGENCY_CONTACT_SHEET_ID && isOtherInsuranceNumberColumn(c)) {
                let insUpload = findInsuranceUploadDocColumn(sheet);
                if (!insUpload) insUpload = virtualInsuranceUploadDocColumn();
                if (!placed.has(insUpload.id)) {
                    orderedRest.push(insUpload);
                    placed.add(insUpload.id);
                }
            }
            if (sheet.id === PERSONNEL_HEALTH_SHEET_ID && isFinalMcuReviewStatusColumn(c)) {
                let mcuDoc = findMcuResultDocColumn(sheet);
                if (!mcuDoc) mcuDoc = virtualMcuResultDocColumn();
                if (!placed.has(mcuDoc.id)) {
                    orderedRest.push(mcuDoc);
                    placed.add(mcuDoc.id);
                }
            }
        });

        const merged = ordered.concat(orderedRest);
        return sheet.id === TRAINING_SHEET_ID ? sortPelatihanDisplayColumns(merged, sheet) : merged;
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

    function findRowInSheetAtCurrentLevel(targetSheet, profileRow) {
        if (!targetSheet || !profileRow) return null;
        if (targetSheet.id === PROFILE_SHEET_ID) return profileRow;

        const profileSheet = sheetById(PROFILE_SHEET_ID);
        const profileNameCol = getPersonnelNameCol(profileSheet);
        const name = profileNameCol ? (profileRow.cells?.[profileNameCol.id] || '').trim() : '';
        if (name) {
            const atLevel = findPersonnelRowAtLevel(
                targetSheet, name, getSelectedProductLineName(), getCurrentFilterLevel()
            );
            if (atLevel) return atLevel;
        }
        return findRowInSheet(targetSheet, profileRow);
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

    function personnelFieldFromRows(fieldPattern, profileSheet, profileRow, activeSheet, activeRow) {
        const sources = [
            [profileSheet, profileRow],
            [activeSheet, activeRow],
        ];
        for (const [s, r] of sources) {
            if (!s || !r) continue;
            const col = getColByLabel(s, fieldPattern);
            const val = col ? (r.cells?.[col.id] || '').trim() : '';
            if (val) return val;
        }
        return '';
    }

    function avatarSrcForProfile(profileRow) {
        const fileId = profilePhotoFileId(profileRow);
        if (fileId) return photoViewUrl(fileId);
        return defaultAvatar(profileGender(profileRow));
    }

    function normalizePersonnelName(name) {
        return (name || '').trim().toLowerCase();
    }

    function getCurrentFilterLevel() {
        if (isAllClients()) return 'master';
        if (isAllProjects()) return 'client';
        return 'project';
    }

    function rowHasProject(sheet, row) {
        const projectCol = getProjectCol(sheet);
        return !!(projectCol && (row.cells?.[projectCol.id] || '').trim());
    }

    function isMasterRow(sheet, row) {
        const clientCol = getClientCol(sheet);
        if (!clientCol) return !rowHasProject(sheet, row);
        return !(row.cells?.[clientCol.id] || '').trim() && !rowHasProject(sheet, row);
    }

    function isClientLevelRow(sheet, row, clientName) {
        const clientCol = getClientCol(sheet);
        if (!clientCol) return false;
        const c = (row.cells?.[clientCol.id] || '').trim();
        if (!c) return false;
        if (clientName && c !== clientName) return false;
        return !rowHasProject(sheet, row);
    }

    function isProjectLevelRow(sheet, row, clientName, projectName) {
        const clientCol = getClientCol(sheet);
        const projectCol = getProjectCol(sheet);
        if (!clientCol || !projectCol) return false;
        const c = (row.cells?.[clientCol.id] || '').trim();
        const p = (row.cells?.[projectCol.id] || '').trim();
        if (!c || !p) return false;
        if (clientName && c !== clientName) return false;
        if (projectName && p !== projectName) return false;
        return true;
    }

    function getRowLevel(sheet, row) {
        if (isMasterRow(sheet, row)) return 'master';
        if (isProjectLevelRow(sheet, row)) return 'project';
        if (isClientLevelRow(sheet, row)) return 'client';
        return 'unknown';
    }

    function rowMatchesProductLine(sheet, row, plName) {
        const plCol = getProductLineCol(sheet);
        const pl = plName || getSelectedProductLineName();
        if (!plCol || !pl) return true;
        return (row.cells?.[plCol.id] || '').trim() === pl;
    }

    function personnelRowKey(sheet, row) {
        const nameCol = getPersonnelNameCol(sheet);
        const plCol = getProductLineCol(sheet);
        const name = nameCol ? (row.cells?.[nameCol.id] || '').trim() : '';
        if (!name) return null;
        const pl = plCol ? (row.cells?.[plCol.id] || '').trim() : getSelectedProductLineName();
        const level = getRowLevel(sheet, row);
        const base = `${normalizePersonnelName(name)}::${(pl || '').toLowerCase()}`;
        if (level === 'master') return `${base}::master`;
        const clientCol = getClientCol(sheet);
        const projectCol = getProjectCol(sheet);
        const c = clientCol ? (row.cells?.[clientCol.id] || '').trim().toLowerCase() : '';
        if (level === 'client') return `${base}::client::${c}`;
        const p = projectCol ? (row.cells?.[projectCol.id] || '').trim().toLowerCase() : '';
        return `${base}::project::${c}::${p}`;
    }

    function rowDataScore(row) {
        return Object.values(row?.cells || {}).filter(v => String(v).trim()).length;
    }

    function findPersonnelRowAtLevel(sheet, personnelName, plName, level) {
        const nameCol = getPersonnelNameCol(sheet);
        if (!nameCol || !personnelName || !sheet) return null;
        const nl = normalizePersonnelName(personnelName);
        const clientName = getSelectedClientName();
        const projectName = getSelectedProjectName();
        const targetLevel = level || getCurrentFilterLevel();

        const candidates = (sheet.rows || []).filter(r => {
            const n = (r.cells?.[nameCol.id] || '').trim();
            if (normalizePersonnelName(n) !== nl) return false;
            if (!rowMatchesProductLine(sheet, r, plName)) return false;
            if (targetLevel === 'master') return isMasterRow(sheet, r);
            if (targetLevel === 'client') return isClientLevelRow(sheet, r, clientName);
            if (targetLevel === 'project') return isProjectLevelRow(sheet, r, clientName, projectName);
            return false;
        });
        return candidates.sort((a, b) => rowDataScore(b) - rowDataScore(a))[0] || null;
    }

    function findMasterPersonnelRow(sheet, personnelName, plName) {
        return findPersonnelRowAtLevel(sheet, personnelName, plName, 'master');
    }

    function findMasterPersonnelRowAnySheet(personnelName, plName) {
        for (const s of MATRIX_STATE.workbook?.sheets || []) {
            const row = findPersonnelRowAtLevel(s, personnelName, plName, 'master');
            if (row) return { sheet: s, row };
        }
        return null;
    }

    function collectMasterRosterNames() {
        const names = new Set();
        const plName = getSelectedProductLineName();
        for (const s of MATRIX_STATE.workbook?.sheets || []) {
            const nameCol = getPersonnelNameCol(s);
            if (!nameCol) continue;
            (s.rows || []).forEach(r => {
                if (!isMasterRow(s, r)) return;
                if (!rowMatchesProductLine(s, r, plName)) return;
                const n = (r.cells?.[nameCol.id] || '').trim();
                if (n) names.add(n);
            });
        }
        return names;
    }

    function collectClientLevelNames(sheet) {
        const names = new Set();
        const clientName = getSelectedClientName();
        const plName = getSelectedProductLineName();
        const nameCol = getPersonnelNameCol(sheet);
        if (!nameCol) return names;
        (sheet.rows || []).forEach(r => {
            if (!isClientLevelRow(s, r, clientName)) return;
            if (!rowMatchesProductLine(s, r, plName)) return;
            const n = (r.cells?.[nameCol.id] || '').trim();
            if (n) names.add(n);
        });
        return names;
    }

    function getAssignedNamesAtLevel(sheet, level) {
        const names = new Set();
        const nameCol = getPersonnelNameCol(sheet);
        if (!nameCol) return names;
        const clientName = getSelectedClientName();
        const projectName = getSelectedProjectName();
        const plName = getSelectedProductLineName();
        (sheet.rows || []).forEach(r => {
            if (!rowMatchesProductLine(s, r, plName)) return;
            if (level === 'client' && !isClientLevelRow(s, r, clientName)) return;
            if (level === 'project' && !isProjectLevelRow(s, r, clientName, projectName)) return;
            const n = (r.cells?.[nameCol.id] || '').trim();
            if (n) names.add(n);
        });
        return names;
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
            if (rowDataScore(row) > rowDataScore(existing)) {
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
            const keep = rowDataScore(row) > rowDataScore(existing) ? row : existing;
            const drop = keep.id === row.id ? existing : row;
            seen.set(key, keep);
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
        const level = getCurrentFilterLevel();
        const keep = findPersonnelRowAtLevel(sheet, personnelName, plName, level);
        if (!keep) return;
        const key = personnelRowKey(sheet, keep);
        const dupes = (sheet.rows || []).filter(r => r.id !== keep.id && personnelRowKey(sheet, r) === key);
        for (const d of dupes) {
            await matrixRequest('DELETE', `/matrix/sheets/${sheetId}/rows/${d.id}`);
            sheet.rows = sheet.rows.filter(r => r.id !== d.id);
        }
    }

    function countDateMetric(rows, cols, rule) {
        const matchingCols = cols.filter(c => {
            if (!rule.match.test(c.label)) return false;
            return c.type === 'date' || /expir|end date|expired/i.test(c.label);
        });
        if (!matchingCols.length) return 0;

        if (rule.status === 'expired' && rule.perRow) {
            let count = 0;
            rows.forEach(row => {
                for (const c of matchingCols) {
                    const du = daysUntil(row.cells?.[c.id]);
                    if (du != null && du < 0) {
                        count += 1;
                        break;
                    }
                }
            });
            return count;
        }

        let count = 0;
        rows.forEach(row => {
            for (const c of matchingCols) {
                const du = daysUntil(row.cells?.[c.id]);
                if (du == null) continue;
                if (rule.status === 'soon' && du >= 0 && du <= (rule.warnDays || 30)) count += 1;
                else if (rule.status === 'expired' && du < 0) count += 1;
            }
        });
        return count;
    }

    function computeSheetSummary(sheet) {
        const rows = filterRows(sheet);
        const cols = sheet.columns || [];
        const requiredCols = cols.filter(c => c.required);
        let missingRequired = 0;
        const genderCol = cols.find(c => /gender/i.test(c.label));
        const gender = { Male: 0, Female: 0, Other: 0 };

        rows.forEach(row => {
            requiredCols.forEach(c => {
                if (!(row.cells?.[c.id] || '').trim()) missingRequired += 1;
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

        const rules = SHEET_KPI_RULES[sheet.id] || DEFAULT_KPI_RULES;
        const kpis = rules.map((rule, idx) => {
            const color = SHEET_KPI_COLORS[idx % SHEET_KPI_COLORS.length];
            if (rule.type === 'personnel') {
                return {
                    label: 'Personel Aktif',
                    shortLabel: 'Personel Aktif',
                    value: uniquePersonnel,
                    color,
                };
            }
            if (rule.type === 'missing') {
                return {
                    label: 'Field Wajib Kosong',
                    shortLabel: 'Field Wajib',
                    value: missingRequired,
                    color,
                };
            }
            return {
                label: rule.label,
                shortLabel: rule.shortLabel || rule.label,
                value: countDateMetric(rows, cols, rule),
                color,
            };
        });

        if (genderCol && gender.Male + gender.Female + gender.Other > 0
            && (sheet.id === PROFILE_SHEET_ID || sheet.id === 'personnel_health')) {
            kpis.push({
                label: 'Gender (M/F/L)',
                shortLabel: 'Gender M/F/L',
                value: `${gender.Male}/${gender.Female}/${gender.Other}`,
                color: '#1abc9c',
            });
        }

        return { uniquePersonnel, missingRequired, kpis, gender };
    }

    function rowMatchesFilters(sheet, row) {
        const plName = getSelectedProductLineName();
        const plCol = getProductLineCol(sheet);

        if (MATRIX_STATE.filterProductLineId && plCol) {
            const rowPl = (row.cells?.[plCol.id] || '').trim();
            if (rowPl !== plName) return false;
        }

        if (isAllClients()) {
            return isMasterRow(sheet, row);
        }

        const clientCol = getClientCol(sheet);
        const clientName = getSelectedClientName();
        if (!clientCol || !clientName) return false;
        if ((row.cells?.[clientCol.id] || '').trim() !== clientName) return false;

        if (isAllProjects()) {
            return isClientLevelRow(sheet, row, clientName);
        }

        const projectCol = getProjectCol(sheet);
        const projectName = getSelectedProjectName();
        if (!projectCol || !projectName) return false;
        return isProjectLevelRow(sheet, row, clientName, projectName);
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
        if (isAllClients()) return [];

        const nameCol = getPersonnelNameCol(sheet);
        if (!nameCol) return [];

        let pool;
        let assigned;

        if (isAllProjects()) {
            pool = collectMasterRosterNames();
            assigned = getAssignedNamesAtLevel(sheet, 'client');
        } else {
            pool = collectClientLevelNames(sheet);
            assigned = getAssignedNamesAtLevel(sheet, 'project');
        }

        return [...pool].filter(n => !assigned.has(n)).sort((a, b) => a.localeCompare(b));
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
        const clientName = getSelectedClientName();
        const level = getCurrentFilterLevel();
        const existingAtLevel = findPersonnelRowAtLevel(sheet, personnelName, plName, level);
        let targetRowId = rowId;

        if (existingAtLevel && existingAtLevel.id !== rowId) {
            targetRowId = existingAtLevel.id;
        }

        const profileRow = profileSheet.rows.find(r => {
            const nc = getPersonnelNameCol(profileSheet);
            return nc && (r.cells?.[nc.id] || '').trim().toLowerCase() === personnelName.toLowerCase();
        });

        let sourceRow = null;
        if (level === 'project') {
            sourceRow = findPersonnelRowAtLevel(sheet, personnelName, plName, 'client');
        } else if (level === 'client') {
            sourceRow = findPersonnelRowAtLevel(sheet, personnelName, plName, 'master')
                || findMasterPersonnelRowAnySheet(personnelName, plName)?.row
                || null;
        }

        if (!sourceRow && profileRow) {
            sourceRow = findRowInSheet(sheet, profileRow);
            if (sourceRow && !isMasterRow(sheet, sourceRow) && level === 'client') {
                sourceRow = findPersonnelRowAtLevel(sheet, personnelName, plName, 'master')
                    || findMasterPersonnelRowAnySheet(personnelName, plName)?.row
                    || null;
            }
            if (sourceRow && level === 'project' && !isClientLevelRow(sheet, sourceRow, clientName)) {
                sourceRow = findPersonnelRowAtLevel(sheet, personnelName, plName, 'client');
            }
        }

        const trainingSheet = sheetById('employee_mandatory_training');
        const trainingRow = trainingSheet ? findRowInSheet(trainingSheet, profileRow) : null;
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
            } else if (profileRow) {
                const profCol = profileSheet.columns.find(
                    pc => pc.label.replace(/\*/g, '').trim().toLowerCase() === labelKey
                );
                const targetRow = sheet.rows.find(r => r.id === targetRowId);
                if (profCol && profileRow.cells?.[profCol.id] !== undefined) {
                    cells[col.id] = profileRow.cells[profCol.id];
                } else {
                    cells[col.id] = targetRow?.cells?.[col.id] || '';
                }
            } else {
                cells[col.id] = sheet.rows.find(r => r.id === targetRowId)?.cells?.[col.id] || '';
            }
        });

        await applyCellsUpdate(sheetId, targetRowId, cells);

        if (targetRowId !== rowId) {
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

    const MATRIX_FETCH_TIMEOUT_MS = 120000;

    async function fetchWorkbook(attempt = 0) {
        const maxAttempts = 3;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), MATRIX_FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(`${apiBase()}/matrix/workbook?t=${Date.now()}`, {
                cache: 'no-store',
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            if (attempt + 1 < maxAttempts) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                return fetchWorkbook(attempt + 1);
            }
            if (e.name === 'AbortError') {
                throw new Error('Timeout — koneksi lambat. Coba lagi atau gunakan WiFi yang stabil.');
            }
            throw new Error('Gagal memuat matrix workbook');
        } finally {
            clearTimeout(timer);
        }
    }

    async function ensurePelatihanExtraColumns() {
        const sheet = sheetById(TRAINING_SHEET_ID);
        if (!sheet) return;
        let needsReload = false;
        for (const spec of PELATIHAN_EXTRA_TRAININGS) {
            for (const entry of [
                { label: spec.dateLabel, type: 'date', colId: spec.dateColId, key: `${spec.slug}_date` },
                { label: spec.expiryLabel, type: 'date', colId: spec.expiryColId, key: `${spec.slug}_expiry` },
                { label: spec.agencyLabel, type: 'text', colId: spec.agencyColId, key: `${spec.slug}_agency` },
            ]) {
                const exists = (sheet.columns || []).some(c =>
                    normColLabel(c.label) === normColLabel(entry.label) || c.id === entry.colId
                );
                if (exists) continue;
                try {
                    const col = await matrixRequest('POST', `/matrix/sheets/${TRAINING_SHEET_ID}/columns`, {
                        label: entry.label,
                        type: entry.type,
                        filterable: entry.type === 'date',
                        col_id: entry.colId,
                        col_key: entry.key,
                    });
                    if (col?.id) {
                        if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                        sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                        needsReload = true;
                    }
                } catch (e) {
                    console.warn(`ensurePelatihanExtraColumns ${entry.label}:`, e.message);
                }
            }
        }
        if (needsReload) {
            try {
                const fresh = await fetchWorkbook();
                MATRIX_STATE.workbook = fresh;
            } catch (e) {
                console.warn('ensurePelatihanExtraColumns reload:', e.message);
            }
        }
    }

    function runMatrixBackgroundSetup() {
        const tasks = [
            ensureStandardColumns(),
            ensureProfilePhotoColumn(),
            ensurePelatihanExtraColumns(),
            ensureExpiryDocColumns(),
            ensureMcuResultDocColumn(),
            ensureCvDocColumn(),
            ensureKtpUploadDocColumn(),
            ensureSimColumns(),
            ensureHsePassportNumberColumn(),
            ensureSimlColumns(),
            ensureBpjsUploadDocColumn(),
            ensureInsuranceUploadDocColumn(),
        ];
        Promise.allSettled(tasks).then(() => {
            if (MATRIX_STATE.workbook) paintMatrixScreen();
        });
        fetch(`${apiBase()}/matrix/ensure-doc-columns`, { method: 'POST', cache: 'no-store' })
            .catch(e => console.warn('ensure-doc-columns:', e.message || e));
    }

    async function matrixRequest(method, path, body) {
        const res = await fetch(`${apiBase()}${path}`, {
            method,
            cache: 'no-store',
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
        const hasPhoto = (sheet.columns || []).some(c =>
            c.id === PHOTO_COL_ID || c.type === 'image' || /profile photo/i.test(c.label)
        );
        if (hasPhoto) return;
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                label: 'Profile Photo',
                type: 'image',
                filterable: false,
                col_id: PHOTO_COL_ID,
                col_key: 'profile_photo',
            });
            if (col?.id) {
                if (!sheet.columns.some(c => c.id === col.id)) {
                    sheet.columns.push(col);
                }
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${PROFILE_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PROFILE_SHEET_ID);
                        if (idx >= 0) {
                            MATRIX_STATE.workbook.sheets[idx] = fresh;
                        }
                    }
                } catch (reloadErr) {
                    console.warn('ensureProfilePhotoColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureProfilePhotoColumn:', msg);
        }
    }

    async function ensureCvDocColumn() {
        const sheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet) return;
        if (findCvDocColumn(sheet)) {
            reorderCvDocColumn(sheet);
            return;
        }
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                label: 'CV',
                type: 'file',
                filterable: false,
                col_id: CV_DOC_COL_ID,
                col_key: 'doc_cv',
            });
            if (col?.id) {
                const plCol = getProductLineCol(sheet);
                const plIdx = plCol ? (sheet.columns || []).findIndex(c => c.id === plCol.id) : -1;
                if (plIdx >= 0) sheet.columns.splice(plIdx + 1, 0, col);
                else if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                reorderCvDocColumn(sheet);
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505|already exists/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${PROFILE_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PROFILE_SHEET_ID);
                        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        reorderCvDocColumn(fresh);
                    }
                } catch (reloadErr) {
                    console.warn('ensureCvDocColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureCvDocColumn:', msg);
        }
    }

    async function ensureKtpUploadDocColumn() {
        const sheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet) return;
        if (findKtpUploadDocColumn(sheet)) {
            reorderKtpUploadDocColumn(sheet);
            return;
        }
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                label: 'Upload KTP',
                type: 'file',
                filterable: false,
                col_id: KTP_UPLOAD_DOC_COL_ID,
                col_key: 'doc_ktp_upload',
            });
            if (col?.id) {
                const ktpCol = getKtpIdCol(sheet);
                const ktpIdx = ktpCol ? (sheet.columns || []).findIndex(c => c.id === ktpCol.id) : -1;
                if (ktpIdx >= 0) sheet.columns.splice(ktpIdx + 1, 0, col);
                else if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                reorderKtpUploadDocColumn(sheet);
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505|already exists/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${PROFILE_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PROFILE_SHEET_ID);
                        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        reorderKtpUploadDocColumn(fresh);
                    }
                } catch (reloadErr) {
                    console.warn('ensureKtpUploadDocColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureKtpUploadDocColumn:', msg);
        }
    }

    async function ensureSimColumns() {
        const sheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet) return;

        const specs = [
            { col_id: SIM_DATE_COL_ID, col_key: 'sim_date', label: 'SIM Date', type: 'date', filterable: true },
            { col_id: SIM_EXPIRY_COL_ID, col_key: 'sim_expiry_date', label: 'SIM Expiry Date', type: 'date', filterable: true },
            { col_id: SIM_UPLOAD_DOC_COL_ID, col_key: 'doc_sim_upload', label: 'Upload SIM', type: 'file', filterable: false },
        ];

        let changed = false;
        for (const spec of specs) {
            const exists = (sheet.columns || []).some(c =>
                c.id === spec.col_id || normColLabel(c.label) === normColLabel(spec.label)
            );
            if (exists) continue;
            try {
                const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                    label: spec.label,
                    type: spec.type,
                    filterable: spec.filterable,
                    col_id: spec.col_id,
                    col_key: spec.col_key,
                });
                if (col?.id) {
                    if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                    sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                    changed = true;
                }
            } catch (e) {
                const msg = e.message || String(e);
                if (/duplicate|23505|already exists/i.test(msg)) {
                    try {
                        const fresh = await matrixRequest('GET', `/matrix/sheets/${PROFILE_SHEET_ID}`);
                        if (fresh?.columns) {
                            const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PROFILE_SHEET_ID);
                            if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        }
                    } catch (reloadErr) {
                        console.warn('ensureSimColumns reload:', reloadErr.message);
                    }
                    continue;
                }
                console.warn(`ensureSimColumns ${spec.label}:`, msg);
            }
        }

        const active = sheetById(PROFILE_SHEET_ID) || sheet;
        if (findKtpUploadDocColumn(active)) {
            reorderSimColumns(active);
        }
    }

    async function ensureHsePassportNumberColumn() {
        const sheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet) return;
        if (getHsePassportNumberCol(sheet)) {
            reorderHsePassportNumberColumn(sheet);
            return;
        }
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                label: 'HSE Passport Number',
                type: 'text',
                filterable: true,
                col_id: HSE_PASSPORT_NUMBER_COL_ID,
                col_key: 'hse_passport_number',
            });
            if (col?.id) {
                const expCol = findHsePassportExpiredColumn(sheet);
                const expIdx = expCol ? (sheet.columns || []).findIndex(c => c.id === expCol.id) : -1;
                if (expIdx >= 0) sheet.columns.splice(expIdx + 1, 0, col);
                else if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                reorderHsePassportNumberColumn(sheet);
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505|already exists/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${PROFILE_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PROFILE_SHEET_ID);
                        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        reorderHsePassportNumberColumn(fresh);
                    }
                } catch (reloadErr) {
                    console.warn('ensureHsePassportNumberColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureHsePassportNumberColumn:', msg);
        }
    }

    async function ensureSimlColumns() {
        const sheet = sheetById(PROFILE_SHEET_ID);
        if (!sheet) return;

        const specs = SIML_SLOTS.flatMap(s => ([
            { col_id: s.numberColId, col_key: s.numberKey, label: s.labels.number, type: 'text', filterable: true },
            { col_id: s.locationColId, col_key: s.locationKey, label: s.labels.location, type: 'text', filterable: true },
            { col_id: s.dateColId, col_key: s.dateKey, label: s.labels.date, type: 'date', filterable: true },
            { col_id: s.expiryColId, col_key: s.expiryKey, label: s.labels.expiry, type: 'date', filterable: true },
            { col_id: s.uploadColId, col_key: s.uploadKey, label: s.labels.upload, type: 'file', filterable: false },
        ]));

        for (const spec of specs) {
            const exists = (sheet.columns || []).some(c =>
                c.id === spec.col_id || normColLabel(c.label) === normColLabel(spec.label)
            );
            if (exists) continue;
            try {
                const col = await matrixRequest('POST', `/matrix/sheets/${PROFILE_SHEET_ID}/columns`, {
                    label: spec.label,
                    type: spec.type,
                    filterable: spec.filterable,
                    col_id: spec.col_id,
                    col_key: spec.col_key,
                });
                if (col?.id) {
                    if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                    sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                }
            } catch (e) {
                const msg = e.message || String(e);
                if (/duplicate|23505|already exists/i.test(msg)) {
                    try {
                        const fresh = await matrixRequest('GET', `/matrix/sheets/${PROFILE_SHEET_ID}`);
                        if (fresh?.columns) {
                            const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PROFILE_SHEET_ID);
                            if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        }
                    } catch (reloadErr) {
                        console.warn('ensureSimlColumns reload:', reloadErr.message);
                    }
                    continue;
                }
                console.warn(`ensureSimlColumns ${spec.label}:`, msg);
            }
        }

        const active = sheetById(PROFILE_SHEET_ID) || sheet;
        reorderSimlColumns(active);
    }

    async function ensureBpjsUploadDocColumn() {
        const sheet = sheetById(EMERGENCY_CONTACT_SHEET_ID);
        if (!sheet) return;
        if (findBpjsUploadDocColumn(sheet)) {
            reorderBpjsUploadDocColumn(sheet);
            return;
        }
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${EMERGENCY_CONTACT_SHEET_ID}/columns`, {
                label: 'Upload BPJS',
                type: 'file',
                filterable: false,
                col_id: BPJS_UPLOAD_DOC_COL_ID,
                col_key: 'doc_bpjs_upload',
            });
            if (col?.id) {
                const bpjsCol = getBpjsNumberCol(sheet);
                const bpjsIdx = bpjsCol ? (sheet.columns || []).findIndex(c => c.id === bpjsCol.id) : -1;
                if (bpjsIdx >= 0) sheet.columns.splice(bpjsIdx + 1, 0, col);
                else if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                reorderBpjsUploadDocColumn(sheet);
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505|already exists/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${EMERGENCY_CONTACT_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === EMERGENCY_CONTACT_SHEET_ID);
                        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        reorderBpjsUploadDocColumn(fresh);
                    }
                } catch (reloadErr) {
                    console.warn('ensureBpjsUploadDocColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureBpjsUploadDocColumn:', msg);
        }
    }

    async function ensureInsuranceUploadDocColumn() {
        const sheet = sheetById(EMERGENCY_CONTACT_SHEET_ID);
        if (!sheet) return;
        if (findInsuranceUploadDocColumn(sheet)) {
            reorderInsuranceUploadDocColumn(sheet);
            return;
        }
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${EMERGENCY_CONTACT_SHEET_ID}/columns`, {
                label: 'Upload Insurance',
                type: 'file',
                filterable: false,
                col_id: INSURANCE_UPLOAD_DOC_COL_ID,
                col_key: 'doc_insurance_upload',
            });
            if (col?.id) {
                const insCol = getOtherInsuranceNumberCol(sheet);
                const insIdx = insCol ? (sheet.columns || []).findIndex(c => c.id === insCol.id) : -1;
                if (insIdx >= 0) sheet.columns.splice(insIdx + 1, 0, col);
                else if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                reorderInsuranceUploadDocColumn(sheet);
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505|already exists/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${EMERGENCY_CONTACT_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === EMERGENCY_CONTACT_SHEET_ID);
                        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        reorderInsuranceUploadDocColumn(fresh);
                    }
                } catch (reloadErr) {
                    console.warn('ensureInsuranceUploadDocColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureInsuranceUploadDocColumn:', msg);
        }
    }

    async function ensureMcuResultDocColumn() {
        const sheet = sheetById(PERSONNEL_HEALTH_SHEET_ID);
        if (!sheet) return;
        if (findMcuResultDocColumn(sheet)) {
            reorderMcuResultDocColumn(sheet);
            return;
        }
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${PERSONNEL_HEALTH_SHEET_ID}/columns`, {
                label: 'MCU Result Doc',
                type: 'file',
                filterable: false,
                col_id: MCU_RESULT_DOC_COL_ID,
                col_key: 'doc_mcu_result_doc_7',
            });
            if (col?.id) {
                const anchorIdx = (sheet.columns || []).findIndex(c => isFinalMcuReviewStatusColumn(c));
                if (anchorIdx >= 0) sheet.columns.splice(anchorIdx + 1, 0, col);
                else if (!sheet.columns.some(c => c.id === col.id)) sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                reorderMcuResultDocColumn(sheet);
            }
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505|already exists/i.test(msg)) {
                try {
                    const fresh = await matrixRequest('GET', `/matrix/sheets/${PERSONNEL_HEALTH_SHEET_ID}`);
                    if (fresh?.columns) {
                        const idx = MATRIX_STATE.workbook.sheets.findIndex(s => s.id === PERSONNEL_HEALTH_SHEET_ID);
                        if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = fresh;
                        reorderMcuResultDocColumn(fresh);
                    }
                } catch (reloadErr) {
                    console.warn('ensureMcuResultDocColumn reload:', reloadErr.message);
                }
                return;
            }
            console.warn('ensureMcuResultDocColumn:', msg);
        }
    }

    let ensuringDocColumns = false;

    async function ensureExpiryDocColumns() {
        if (!MATRIX_STATE.workbook || ensuringDocColumns) return;
        ensuringDocColumns = true;
        let needsReload = false;
        try {
            for (const sheet of MATRIX_STATE.workbook.sheets) {
                const usedDocIds = new Set();
                for (const expCol of (sheet.columns || []).filter(c =>
                    isExpiryDateColumn(c) && !isSimExpiryColumn(c) && !isSimlExpiryColumn(c)
                )) {
                    const existing = findDocColumnForExpiry(sheet, expCol, usedDocIds);
                    if (existing) {
                        usedDocIds.add(existing.id);
                        continue;
                    }
                    const docId = docColumnIdFor(expCol);
                    const docKey = `doc_${expCol.key || expCol.id}`;
                    try {
                        const col = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
                            label: docColumnLabelFor(expCol),
                            type: 'file',
                            filterable: false,
                            col_id: docId,
                            col_key: docKey,
                        });
                        if (col?.id) {
                            if (!sheet.columns.some(c => c.id === col.id)) {
                                sheet.columns.push(col);
                            }
                            sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
                            needsReload = true;
                        }
                    } catch (e) {
                        const msg = e.message || String(e);
                        if (/duplicate|23505|already exists/i.test(msg)) {
                            try {
                                const fresh = await matrixRequest('GET', `/matrix/sheets/${sheet.id}`);
                                if (fresh?.columns) {
                                    sheet.columns = fresh.columns;
                                    sheet.rows = fresh.rows || sheet.rows;
                                    needsReload = true;
                                }
                            } catch (reloadErr) {
                                console.warn('ensureExpiryDocColumns reload:', reloadErr.message);
                            }
                            continue;
                        }
                        console.warn(`ensureExpiryDocColumns ${sheet.id}:`, msg);
                    }
                }
            }
            if (needsReload) {
                const freshWb = await fetchWorkbook();
                MATRIX_STATE.workbook = freshWb;
                if (MATRIX_STATE.activeSheetId) {
                    const sid = MATRIX_STATE.activeSheetId;
                    const idx = freshWb.sheets.findIndex(s => s.id === sid);
                    if (idx >= 0) MATRIX_STATE.workbook.sheets[idx] = freshWb.sheets[idx];
                }
            }
        } finally {
            ensuringDocColumns = false;
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
        const cards = summary.kpis || [];
        return `<div class="ex-kpi-strip mx-kpi-strip">${cards.map(c => {
            const short = c.shortLabel || c.label;
            const full = c.label || short;
            const tip = full !== short ? ` title="${esc(full)}"` : '';
            return `
            <div class="ex-kpi mx-kpi-card" style="--kpi-color:${c.color}"${tip}>
                <span class="mx-kpi-label">${esc(short)}</span>
                <strong>${esc(c.value)}</strong>
            </div>`;
        }).join('')}</div>`;
    }

    function scheduleMatrixChartsRefresh() {
        const sheet = activeSheet();
        if (!sheet || typeof window.renderMatrixSheetCharts !== 'function') return;
        const rows = filterRows(sheet);
        const summary = computeSheetSummary(sheet);
        const row = rows.find(r => r.id === MATRIX_STATE.selectedRowId);
        const profileRow = row ? findPersonnelProfileRow(sheet, row) : null;
        const name = profileName(profileRow) || rowPersonnelName(sheet, row) || '';
        requestAnimationFrame(() => {
            window.renderMatrixSheetCharts(sheet, rows, summary, row, name);
        });
    }

    function renderStorageBadge() {
        const s = MATRIX_STATE.storage;
        if (!s) return '';
        if (s.persisted) {
            return '<span class="mx-storage-badge mx-storage-ok" title="Data tersimpan di Supabase">● Supabase</span>';
        }
        return '<span class="mx-storage-badge mx-storage-warn" title="Supabase tidak aktif — data hanya lokal">⚠ Penyimpanan Lokal</span>';
    }

    async function checkMatrixStorage() {
        try {
            const res = await fetch(`${apiBase()}/matrix/status?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                MATRIX_STATE.storage = await res.json();
                if (!MATRIX_STATE.storage.persisted) {
                    showToast?.('Matrix menggunakan penyimpanan lokal. Set SUPABASE_URL & SUPABASE_KEY agar data tersimpan di Supabase.', 'error');
                }
            }
        } catch (e) {
            console.warn('checkMatrixStorage:', e.message);
        }
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
                    <button type="button" class="mx-btn mx-btn-secondary mx-btn-pdf" onclick="matrixDownloadPdf()" title="Download laporan PDF personel terpilih">
                        <span class="mx-btn-pdf-icon" aria-hidden="true">↓</span> PDF
                    </button>
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
        const uploadBtn = canUpload
            ? `<button type="button" class="mx-doc-btn mx-photo-btn"
                onclick="matrixTriggerPhotoUpload('${esc(row.id)}', event)">📷 Upload</button>`
            : '';
        return `<td class="mx-td mx-td-photo mx-td-edit">
            <div class="mx-photo-cell" title="Foto profil">
                <img class="mx-photo-thumb" src="${esc(src)}" alt="Profil" onerror="this.src='${defaultAvatar(gender)}'" />
                ${uploadBtn}
                ${canUpload ? `<input type="file" accept="image/*" class="mx-photo-input" id="mx-photo-${esc(row.id)}"
                    data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(col.id)}"
                    data-name="${esc(name)}" onchange="matrixOnPhotoSelected(this)" />` : ''}
            </div>
        </td>`;
    }

    function renderDocCell(sheet, row, col) {
        const val = row.cells?.[col.id] ?? '';
        const { fileId, fileName } = parseDocCellValue(val);
        const displayName = fileName || '';
        const personnelName = rowPersonnelName(sheet, row);
        const columnName = docUploadFolderName(sheet, col);
        const inputId = `mx-doc-${row.id}-${col.id}`;

        const acceptAttr = ' accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,image/*,application/pdf"';
        const fileLink = fileId
            ? `<a class="mx-doc-name" href="${docViewUrl(fileId)}" target="_blank" rel="noopener"
                onclick="event.stopPropagation()">${esc(displayName || 'Document')}</a>`
            : '';
        const uploadBtn = `<button type="button" class="mx-doc-btn"
            onclick="matrixTriggerDocUpload('${esc(inputId)}', event)">${fileId ? 'Ganti' : '📄 Upload'}</button>`;
        return `<td class="mx-td mx-td-doc mx-td-edit">
            <div class="mx-doc-cell" title="Upload dokumen">
                ${fileLink}
                ${uploadBtn}
                <input type="file" class="mx-doc-input" id="${esc(inputId)}"${acceptAttr}
                    data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(col.id)}"
                    data-name="${esc(personnelName)}" data-column-name="${esc(columnName)}"
                    data-virtual="${col._virtual ? '1' : '0'}"
                    onchange="matrixOnDocSelected(this)" />
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
        return `<td class="mx-td mx-td-edit${stickyTdClass(col)}" onclick="event.stopPropagation()">
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
        if (isDocUploadColumn(c)) {
            return renderDocCell(sheet, row, c);
        }
        const val = row.cells?.[c.id] ?? '';

        if (getProductLineCol(sheet)?.id === c.id) {
            return renderProductLineSelect(sheet, row, c, val);
        }

        if (getPersonnelNameCol(sheet)?.id === c.id && !isAllClients()) {
            return renderPersonnelNameSelect(sheet, row, c, val);
        }

        const inputType = c.type === 'date' ? 'date' : (c.type === 'number' ? 'number' : 'text');
        const changeHandler = inputType === 'date'
            ? 'onchange="matrixOnDateCellChange(this)"'
            : 'onchange="matrixOnCellChange(this)"';
        const blurHandler = inputType === 'date' ? '' : 'onblur="matrixOnCellBlur(this)"';
        return `<td class="mx-td mx-td-edit${stickyTdClass(c)}" onclick="event.stopPropagation()">
            <input class="mx-cell-input" type="${inputType}" value="${esc(val)}"
                data-sheet="${esc(sheet.id)}" data-row="${esc(row.id)}" data-col="${esc(c.id)}"
                onclick="event.stopPropagation()"
                onfocus="this.dataset.prev=this.value"
                ${changeHandler}
                ${blurHandler} />
        </td>`;
    }

    function renderTable(sheet, rows) {
        const cols = getDisplayColumns(sheet);
        const head = cols.map(c => {
            const sticky = stickyThClass(c);
            if (c.type === 'image' || c.id === PHOTO_COL_ID) {
                return `<th class="mx-th mx-th-photo${sticky}"><span>${esc(c.label.replace(/\*/g, ''))}</span></th>`;
            }
            if (isDocUploadColumn(c)) {
                const shortLabel = (c.label || '').replace(/^Doc:\s/i, '').trim();
                return `<th class="mx-th mx-th-doc${sticky}"><span title="${esc(c.label.replace(/\*/g, ''))}">Upload Doc</span><span class="mx-th-doc-sub">${esc(shortLabel)}</span></th>`;
            }
            return `
            <th class="mx-th${sticky}">
                <div class="mx-th-inner">
                    <span title="${esc(c.label)}">${esc(c.label.replace(/\*/g, ''))}</span>
                    <div class="mx-th-actions">
                        <button type="button" title="Edit kolom" onclick="matrixEditColumn('${esc(sheet.id)}','${esc(c.id)}')">✎</button>
                        <button type="button" title="Hapus kolom" onclick="matrixDeleteColumn('${esc(sheet.id)}','${esc(c.id)}')">×</button>
                    </div>
                </div>
            </th>`;
        }).join('') + '<th class="mx-th">Aksi</th>';

        const body = rows.map(row => {
            const selected = row.id === MATRIX_STATE.selectedRowId ? ' mx-row-selected' : '';
            const cells = cols.map(c => renderCell(sheet, row, c)).join('');
            return `<tr class="mx-data-row${selected}" data-row-id="${esc(row.id)}"
                onclick="matrixOnRowClick(event, '${esc(row.id)}')">${cells}
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
        const row = findRowInSheetAtCurrentLevel(sheet, profileRow);
        if (!row) return { items: [], hasRow: false };

        const items = [];
        (sheet.columns || []).forEach(col => {
            if (col.type === 'image' || col.type === 'file' || col.id === PHOTO_COL_ID || isDocUploadColumn(col)) return;
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
        const productLine = personnelFieldFromRows(/product line/i, profileSheet, profileRow, sheet, activeRow)
            || getSelectedProductLineName();
        const position = personnelFieldFromRows(/^position/i, profileSheet, profileRow, sheet, activeRow);
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
                    ${productLine ? `<span class="mx-sidebar-badge">${esc(productLine)}</span>` : ''}
                    ${position ? `<span class="mx-sidebar-badge mx-sidebar-badge-muted">${esc(position)}</span>` : ''}
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

        if (typeof window.destroyMatrixSheetCharts === 'function') {
            window.destroyMatrixSheetCharts();
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
                            <p class="mx-subtitle">${esc(sheet.name)} · ${rows.length} baris ditampilkan ${renderStorageBadge()}</p>
                        </div>
                    </div>
                </header>
                ${renderDashboard(summary)}
                ${typeof window.renderMatrixChartsPanelHtml === 'function' ? window.renderMatrixChartsPanelHtml() : ''}
                <div class="mx-layout">
                    ${renderSidebar(sheet)}
                    <div class="mx-main">
                        ${renderToolbar(sheet)}
                        ${renderTable(sheet, rows)}
                    </div>
                </div>
            </div>`;
        updateUndoRedoUI();
        bindMatrixTouchGuards();
        scheduleMatrixChartsRefresh();
    }

    window.matrixSelectRow = function (rowId) {
        if (MATRIX_STATE.selectedRowId === rowId) return;
        MATRIX_STATE.selectedRowId = rowId;
        highlightMatrixRow(rowId);
        replaceMatrixSidebar();
        scheduleMatrixChartsRefresh();
    };

    window.matrixOnRowClick = function (event, rowId) {
        const t = event?.target;
        if (t && t.closest(
            '.mx-td-edit, .mx-doc-cell, .mx-doc-btn, .mx-doc-name, .mx-td-actions, .mx-td-photo, ' +
            'button, a, input, select, textarea, label'
        )) {
            return;
        }
        matrixSelectRow(rowId);
    };

    function bindMatrixTouchGuards() {
        const root = document.getElementById('matrix-content');
        if (!root || root.dataset.touchBound === '1') return;
        root.dataset.touchBound = '1';
        const stopRowSelect = (e) => {
            if (e.target.closest('.mx-doc-cell, .mx-doc-btn, .mx-td-doc, .mx-td-edit, .mx-td-photo, .mx-td-actions')) {
                e.stopPropagation();
            }
        };
        root.addEventListener('touchstart', stopRowSelect, { capture: true, passive: true });
        root.addEventListener('touchend', stopRowSelect, { capture: true, passive: true });
    }

    window.matrixSetSidebarTab = function (tabId) {
        MATRIX_STATE.sidebarTab = tabId;
        replaceMatrixSidebar();
    };

    window.matrixTriggerPhotoUpload = function (rowId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const input = document.getElementById(`mx-photo-${rowId}`);
        if (!input) return;
        if (window.ReactNativeWebView) {
            window.__matrixPendingPhotoInputId = `mx-photo-${rowId}`;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pickImage', context: 'matrixPhoto' }));
            return;
        }
        input.click();
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

    window.matrixTriggerDocUpload = function (inputId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const input = document.getElementById(inputId);
        if (!input) return;
        if (window.ReactNativeWebView) {
            window.__matrixPendingDocInputId = inputId;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pickFile', context: 'matrixDoc' }));
            return;
        }
        try {
            input.click();
        } catch (e) {
            showToast?.('Tidak dapat membuka pemilih file di perangkat ini', 'error');
        }
    };

    async function ensureDocColumnBeforeUpload(sheetId, colId, colLabel, colKey) {
        const sheet = sheetById(sheetId);
        if (!sheet) return colId;
        const existing = (sheet.columns || []).find(c => c.id === colId);
        if (existing && !existing._virtual) return colId;
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${sheetId}/columns`, {
                label: colLabel,
                type: 'file',
                filterable: false,
                col_id: colId,
                col_key: colKey,
            });
            if (col?.id) {
                const idx = (sheet.columns || []).findIndex(c => c.id === col.id);
                if (idx >= 0) sheet.columns[idx] = col;
                else sheet.columns.push(col);
                sheet.rows.forEach(r => { r.cells[col.id] = r.cells[col.id] || ''; });
            }
            return col?.id || colId;
        } catch (e) {
            const msg = e.message || String(e);
            if (/duplicate|23505/i.test(msg)) {
                const fresh = await matrixRequest('GET', `/matrix/sheets/${sheetId}`);
                if (fresh?.columns) {
                    const wbIdx = MATRIX_STATE.workbook?.sheets?.findIndex(s => s.id === sheetId);
                    if (wbIdx >= 0) MATRIX_STATE.workbook.sheets[wbIdx] = fresh;
                    const found = fresh.columns.find(c => c.id === colId);
                    if (found) return found.id;
                }
            }
            throw e;
        }
    }

    window.matrixOnDocSelected = async function (input) {
        const file = input.files?.[0];
        if (!file) return;

        let sheetId = input.dataset.sheet;
        let rowId = input.dataset.row;
        let colId = input.dataset.col;
        const personnelName = input.dataset.name || 'Personnel';
        const columnName = input.dataset.columnName || 'Documents';
        const oldVal = sheetById(sheetId)?.rows?.find(r => r.id === rowId)?.cells?.[colId] || '';

        try {
            if (input.dataset.virtual === '1') {
                const sheet = sheetById(sheetId);
                if (colId === KTP_UPLOAD_DOC_COL_ID || isKtpUploadDocColumn(sheet, { id: colId, label: 'Upload KTP' })) {
                    colId = await ensureDocColumnBeforeUpload(
                        sheetId, KTP_UPLOAD_DOC_COL_ID, 'Upload KTP', 'doc_ktp_upload'
                    );
                } else if (colId === SIM_UPLOAD_DOC_COL_ID || isSimUploadDocColumn(sheet, { id: colId, label: 'Upload SIM' })) {
                    colId = await ensureDocColumnBeforeUpload(
                        sheetId, SIM_UPLOAD_DOC_COL_ID, 'Upload SIM', 'doc_sim_upload'
                    );
                } else if (colId === BPJS_UPLOAD_DOC_COL_ID || isBpjsUploadDocColumn(sheet, { id: colId, label: 'Upload BPJS' })) {
                    colId = await ensureDocColumnBeforeUpload(
                        sheetId, BPJS_UPLOAD_DOC_COL_ID, 'Upload BPJS', 'doc_bpjs_upload'
                    );
                } else if (colId === INSURANCE_UPLOAD_DOC_COL_ID || isInsuranceUploadDocColumn(sheet, { id: colId, label: 'Upload Insurance' })) {
                    colId = await ensureDocColumnBeforeUpload(
                        sheetId, INSURANCE_UPLOAD_DOC_COL_ID, 'Upload Insurance', 'doc_insurance_upload'
                    );
                } else {
                    const simlSlot = SIML_SLOTS.find(s =>
                        colId === s.uploadColId || isSimlUploadDocColumn(sheet, { id: colId, label: s.labels.upload })
                    );
                    if (simlSlot) {
                        colId = await ensureDocColumnBeforeUpload(
                            sheetId, simlSlot.uploadColId, simlSlot.labels.upload, simlSlot.uploadKey
                        );
                    } else if (colId === CV_DOC_COL_ID || isCvDocColumn(sheet, { id: colId, label: 'CV' })) {
                        colId = await ensureDocColumnBeforeUpload(sheetId, CV_DOC_COL_ID, 'CV', 'doc_cv');
                    } else if (colId === MCU_RESULT_DOC_COL_ID || isMcuResultDocColumn(sheet, { id: colId, label: 'MCU Result Doc' })) {
                        colId = await ensureDocColumnBeforeUpload(
                            sheetId, MCU_RESULT_DOC_COL_ID, 'MCU Result Doc', 'doc_mcu_result_doc_7'
                        );
                    } else {
                        const expId = colId.replace(/_doc$/, '');
                        const expCol = (sheet?.columns || []).find(c => c.id === expId);
                        const docKey = `doc_${expCol?.key || expId}`;
                        const docLabel = expCol ? docColumnLabelFor(expCol) : `Doc: ${columnName}`;
                        colId = await ensureDocColumnBeforeUpload(sheetId, colId, docLabel, docKey);
                    }
                }
                input.dataset.col = colId;
                input.dataset.virtual = '0';
            }
            showToast?.('Mengunggah dokumen...', 'info');
            const stored = await uploadMatrixDocument(sheetId, rowId, colId, personnelName, columnName, file);
            pushHistory({
                desc: 'Upload dokumen',
                undo: async () => { await applyCellUpdate(sheetId, rowId, colId, oldVal); },
                redo: async () => { await applyCellUpdate(sheetId, rowId, colId, stored); },
            });
            showToast?.('Dokumen berhasil diunggah ke Google Drive', 'success');
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message || 'Gagal mengunggah dokumen', 'error');
        } finally {
            input.value = '';
        }
    };

    async function uploadMatrixDocument(sheetId, rowId, colId, personnelName, columnName, file) {
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalSize = file.size;
        const sheet = sheetById(sheetId);
        const row = sheet?.rows?.find(r => r.id === rowId);
        const col = (sheet?.columns || []).find(c => c.id === colId);
        const productLine = resolveProductLineForRow(sheet, row, personnelName);
        const uploadFilename = buildMatrixDocFilename(sheet, row, col, file, personnelName, columnName);
        const uploadFile = uploadFilename !== file.name
            ? new File([file], uploadFilename, { type: file.type || 'application/octet-stream' })
            : file;

        if (totalSize <= CHUNK_SIZE) {
            const form = new FormData();
            form.append('sheet_id', sheetId);
            form.append('row_id', rowId);
            form.append('col_id', colId);
            form.append('personnel_name', personnelName);
            form.append('column_name', columnName);
            form.append('product_line', productLine);
            form.append('file', uploadFile);
            const res = await fetch(`${apiBase()}/matrix/document/upload`, { method: 'POST', body: form });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            const stored = data.stored || `${data.file_id}::${uploadFilename}`;
            await applyCellUpdate(sheetId, rowId, colId, stored);
            return stored;
        }

        const initForm = new FormData();
        initForm.append('filename', uploadFilename);
        initForm.append('mime_type', uploadFile.type || 'application/octet-stream');
        initForm.append('personnel_name', personnelName);
        initForm.append('column_name', columnName);
        initForm.append('sheet_id', sheetId);
        initForm.append('row_id', rowId);
        initForm.append('col_id', colId);
        initForm.append('product_line', productLine);
        const initRes = await fetch(`${apiBase()}/matrix/document/initiate-upload`, { method: 'POST', body: initForm });
        if (!initRes.ok) {
            const err = await initRes.json().catch(() => ({}));
            throw new Error(err.detail || 'Gagal memulai upload');
        }
        const { upload_url } = await initRes.json();
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
        let stored = null;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, totalSize));
            const chunkForm = new FormData();
            chunkForm.append('sheet_id', sheetId);
            chunkForm.append('row_id', rowId);
            chunkForm.append('col_id', colId);
            chunkForm.append('personnel_name', personnelName);
            chunkForm.append('column_name', columnName);
            chunkForm.append('product_line', productLine);
            chunkForm.append('filename', uploadFilename);
            chunkForm.append('upload_url', upload_url);
            chunkForm.append('chunk_index', String(i));
            chunkForm.append('total_chunks', String(totalChunks));
            chunkForm.append('chunk_file', chunk, uploadFilename);
            chunkForm.append('start_byte', String(start));
            chunkForm.append('total_size', String(totalSize));

            const chunkRes = await fetch(`${apiBase()}/matrix/document/upload-chunk`, { method: 'POST', body: chunkForm });
            if (!chunkRes.ok) {
                const err = await chunkRes.json().catch(() => ({}));
                throw new Error(err.detail || `Chunk ${i + 1} gagal`);
            }
            const chunkData = await chunkRes.json();
            if (chunkData.status === 'complete') stored = chunkData.stored;
        }

        if (!stored) throw new Error('Upload selesai tanpa data dokumen');
        await applyCellUpdate(sheetId, rowId, colId, stored);
        return stored;
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
            const match = findRowInSheetAtCurrentLevel(newSheet, profileRow);
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
        if (!input || input.tagName === 'SELECT' || input.type === 'date') return;
        matrixOnCellChange(input);
    };

    window.matrixOnDateCellChange = async function (input) {
        if (!input || input.dataset.saving === '1' || input.dataset.reminderFlow === '1') return;
        const oldVal = input.dataset.prev ?? '';
        const newVal = input.value;
        if (oldVal === newVal) return;

        const sheetId = input.dataset.sheet;
        const sheet = sheetById(sheetId);
        const col = sheet?.columns?.find(c => c.id === input.dataset.col);

        if (isMcuDateColumn(sheet, col)) {
            await applyMcuDateWithAutoExpiry(input, sheet, col);
            return;
        }

        if (isSkckDateColumn(sheet, col)) {
            await applySkckDateWithAutoExpiry(input, sheet, col);
            return;
        }

        if (isHsePassportDateColumn(sheet, col)) {
            await applyHsePassportDateWithAutoExpiry(input, sheet, col);
            return;
        }

        if (isSimDateColumn(sheet, col)) {
            await applySimDateWithAutoExpiry(input, sheet, col);
            return;
        }

        if (isSimlDateColumn(sheet, col)) {
            await applySimlDateWithAutoExpiry(input, sheet, col);
            return;
        }

        if (!newVal || !shouldPromptReminder(sheet, col)) {
            await matrixOnCellChange(input);
            return;
        }

        const expiryCol = findPairedExpiryColumn(sheet, col);
        REMINDER_PENDING = {
            input,
            sheetId,
            rowId: input.dataset.row,
            colId: input.dataset.col,
            expiryColId: expiryCol.id,
            oldVal,
            newVal,
        };

        input.dataset.reminderFlow = '1';
        input.value = oldVal;
        delete input.dataset.reminderFlow;
        showReminderModal(1);
    };

    window.matrixReminderNo = async function () {
        const pending = REMINDER_PENDING;
        if (!pending) return hideReminderModal();
        try {
            pending.input.dataset.saving = '1';
            await saveSourceDateOnly(pending);
            pushHistory({
                desc: 'Edit tanggal',
                undo: async () => {
                    await applyCellUpdate(pending.sheetId, pending.rowId, pending.colId, pending.oldVal);
                    paintMatrixScreen();
                },
                redo: async () => {
                    await applyCellUpdate(pending.sheetId, pending.rowId, pending.colId, pending.newVal);
                    paintMatrixScreen();
                },
            });
            hideReminderModal();
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message || 'Gagal menyimpan', 'error');
        } finally {
            if (pending.input) delete pending.input.dataset.saving;
        }
    };

    window.matrixReminderYes = function () {
        if (!REMINDER_PENDING) return;
        showReminderModal(2);
    };

    window.matrixReminderCancel = function () {
        hideReminderModal();
    };

    window.matrixReminderSave = async function () {
        const pending = REMINDER_PENDING;
        if (!pending) return;
        const monthsInp = document.getElementById('mx-reminder-months');
        const months = parseInt(monthsInp?.value, 10);
        if (!months || months < 1) {
            showToast?.('Masukkan masa validity minimal 1 bulan', 'error');
            return;
        }
        try {
            pending.input.dataset.saving = '1';
            const expiryVal = await saveSourceAndExpiry(pending, months);
            hideReminderModal();
            showToast?.(`Expiry date diisi: ${expiryVal} (+${months} bulan)`, 'success');
            paintMatrixScreen();
        } catch (e) {
            showToast?.(e.message || 'Gagal menyimpan', 'error');
        } finally {
            if (pending.input) delete pending.input.dataset.saving;
        }
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
        if (projectCol) initCells[projectCol.id] = isAllProjects() ? '' : getSelectedProjectName();
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
        const label = prompt('Nama kolom baru (berlaku untuk semua filter Client/Project):', 'Kolom Baru');
        if (!label) return;
        const colType = /expir|expired|date|tanggal/i.test(label) ? 'date' : 'text';
        try {
            const col = await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
                label, type: colType, filterable: true,
            });
            await reloadActiveSheet();
            const colSnap = clone(col);
            pushHistory({
                desc: 'Tambah kolom',
                undo: async () => {
                    if (colSnap.id) {
                        await matrixRequest('DELETE', `/matrix/sheets/${sheet.id}/columns/${colSnap.id}`);
                    }
                    await reloadActiveSheet();
                },
                redo: async () => {
                    await matrixRequest('POST', `/matrix/sheets/${sheet.id}/columns`, {
                        label: colSnap.label, type: colSnap.type || 'text', filterable: colSnap.filterable !== false,
                    });
                    await reloadActiveSheet();
                },
            });
            showToast?.('Kolom ditambahkan — tampil di semua filter termasuk Client ALL', 'success');
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

    function getExpiryWarnDaysForCol(col) {
        const l = (col?.label || '').replace(/\*/g, '').trim().toLowerCase();
        if (/mcu/i.test(l)) return 90;
        if (/hse passport.*expir/i.test(l)) return 90;
        if (/siml\s*expir/i.test(l)) return 90;
        if (/^sim\s*expir/i.test(l)) return 90;
        if (/bst.*expir|sbtc.*expir|one\s*sika.*expir|t-bosiet.*expir|h2s.*expir|sea survival.*expir|hse demo room.*expir|well control.*expir|first aid.*expir|fire.*expir|ohc.*expir|forklift.*expir|radiation.*expir|handak.*expir|k3 umum.*expir|tkpk.*expir|tkdn.*expir|hse 101.*expir|hse 201.*expir|hse 301.*expir/i.test(l)) return 90;
        if (/skck.*expir/i.test(l)) return 30;
        if (/contract end|kontrak/i.test(l)) return 30;
        return 30;
    }

    function formatCellForPdf(sheet, col, raw) {
        const val = (raw ?? '').toString().trim();
        if (!val) return '—';
        if (isDocUploadColumn(col)) {
            const { fileName } = parseDocCellValue(val);
            return fileName || 'Document';
        }
        if (col.type === 'date') {
            const d = parseMatrixDate(val);
            if (d) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                return `${dd}/${mm}/${d.getFullYear()}`;
            }
        }
        return val;
    }

    function buildMatrixPdfPayload() {
        const sheet = activeSheet();
        if (!sheet) throw new Error('Sheet tidak ditemukan');
        const rows = filterRows(sheet);
        const row = rows.find(r => r.id === MATRIX_STATE.selectedRowId);
        if (!row) throw new Error('Pilih baris personel di tabel terlebih dahulu');

        const summary = computeSheetSummary(sheet);
        const profileRow = findPersonnelProfileRow(sheet, row);
        const profileSheet = sheetById(PROFILE_SHEET_ID) || sheet;
        const tabLabel = TAB_LABELS[sheet.id] || sheet.title || sheet.name;
        const { items: sidebarFields } = sidebarFieldRowsForSheet(MATRIX_STATE.sidebarTab, profileRow);
        const fields = sidebarFields
            .filter(f => f.value && f.value !== '—')
            .map(f => ({ label: f.label, value: f.value }));

        const seenLabels = new Set();
        const tableCols = getDisplayColumns(sheet).filter(c => {
            if (c.type === 'image' || c.type === 'file' || c.id === PHOTO_COL_ID) return false;
            if (isDocUploadColumn(c)) return false;
            const raw = (row.cells?.[c.id] ?? '').toString().trim();
            if (!raw) return false;
            const norm = (c.label || '').replace(/\*/g, '').replace(/^Doc:\s*/i, '').trim().toLowerCase();
            if (seenLabels.has(norm)) return false;
            seenLabels.add(norm);
            return true;
        });

        const compliance = { ok: 0, soon: 0, expired: 0, noData: 0 };
        const expiryDays = [];
        (sheet.columns || []).forEach(col => {
            if (!isExpiryDateColumn(col)) return;
            const raw = (row.cells?.[col.id] ?? '').toString().trim();
            if (!raw) return;
            const du = daysUntil(raw);
            const warn = getExpiryWarnDaysForCol(col);
            if (du != null && du < 0) compliance.expired += 1;
            else if (du != null && du <= warn) compliance.soon += 1;
            else if (du != null) compliance.ok += 1;
            else compliance.noData += 1;
            expiryDays.push({
                label: (col.label || '').replace(/\*/g, '').trim(),
                days_until: du != null ? Math.max(du, 0) : 0,
            });
        });
        if (!expiryDays.length && !compliance.ok && !compliance.soon && !compliance.expired) {
            compliance.noData = 1;
        }

        return {
            title: (sheet.title || 'CERTIFICATION AND TRAINING').toUpperCase(),
            subtitle: `${tabLabel} · ${rows.length} baris ditampilkan · laporan personel terpilih`,
            tab_label: tabLabel,
            sheet_id: sheet.id,
            filters: {
                client: isAllClients() ? 'ALL' : (getSelectedClientName() || '—'),
                product_line: getSelectedProductLineName() || '—',
                project: isAllProjects() ? 'ALL' : (getSelectedProjectName() || '—'),
                sheet: tabLabel,
            },
            kpis: (summary.kpis || []).map(k => ({
                label: k.label,
                short_label: k.shortLabel || k.label,
                value: String(k.value),
                color: k.color || '#C41E3A',
            })),
            personnel: {
                name: profileName(profileRow) || rowPersonnelName(sheet, row) || 'Personnel',
                product_line: personnelFieldFromRows(/product line/i, profileSheet, profileRow, sheet, row)
                    || getSelectedProductLineName() || '',
                position: personnelFieldFromRows(/^position/i, profileSheet, profileRow, sheet, row)
                    || resolvePositionForRow(sheet, row) || '',
                photo_file_id: profilePhotoFileId(profileRow) || '',
                fields,
            },
            table: {
                title: tabLabel,
                columns: tableCols.map(c => ({
                    label: (c.label || '').replace(/\*/g, '').replace(/^Doc:\s/i, '').trim() || c.id,
                })),
                values: tableCols.map(c => formatCellForPdf(sheet, c, row.cells?.[c.id])),
            },
            charts: { compliance, expiry_days: expiryDays },
            chart_data: (() => {
                const profileRow = findPersonnelProfileRow(sheet, row);
                const name = profileName(profileRow) || rowPersonnelName(sheet, row) || '';
                return typeof window.buildMatrixChartDataForPdf === 'function'
                    ? window.buildMatrixChartDataForPdf(sheet, rows, summary, row, name)
                    : {};
            })(),
            chart_images: typeof window.captureMatrixChartImagesForPdf === 'function'
                ? window.captureMatrixChartImagesForPdf()
                : {},
        };
    }

    window.matrixDownloadPdf = async function () {
        const btn = document.querySelector('.mx-btn-pdf');
        try {
            const payload = buildMatrixPdfPayload();
            if (btn) btn.disabled = true;
            showToast?.('Membuat PDF…', 'info');
            const res = await fetch(`${apiBase()}/matrix/personnel-report/pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            const blob = await res.blob();
            const disp = res.headers.get('Content-Disposition') || '';
            const m = disp.match(/filename="?([^";]+)"?/i);
            const filename = m ? m[1] : `CSMS_${payload.personnel.name.replace(/\s+/g, '_')}.pdf`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast?.('PDF berhasil diunduh', 'success');
        } catch (e) {
            showToast?.(e.message || 'Gagal mengunduh PDF', 'error');
        } finally {
            if (btn) btn.disabled = false;
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
            await checkMatrixStorage();
            await loadMasterFilters();
            MATRIX_STATE.workbook = await fetchWorkbook();
            if (!MATRIX_STATE.activeSheetId && MATRIX_STATE.workbook.sheets?.length) {
                MATRIX_STATE.activeSheetId = MATRIX_STATE.workbook.sheets[0].id;
            }
            if (!silent) clearHistory();
            paintMatrixScreen();
            runMatrixBackgroundSetup();
            if (isAllClients()) {
                dedupeAllPersonnelInWorkbook().then(() => paintMatrixScreen()).catch(e => {
                    console.warn('dedupeAllPersonnel:', e.message);
                });
            }
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

    function applyNativeFileToInput(input, data, onSelected) {
        if (!input) return;
        if (data.file instanceof File) {
            const dt = new DataTransfer();
            dt.items.add(data.file);
            input.files = dt.files;
            onSelected(input);
            return;
        }
        if (data.base64 && data.name) {
            const mime = data.mimeType || 'application/octet-stream';
            const bin = atob(data.base64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            const blob = new Blob([arr], { type: mime });
            const file = new File([blob], data.name, { type: mime });
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            onSelected(input);
        }
    }

    window.addEventListener('message', function (event) {
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (!data) return;

            if ((data.type === 'fileSelected') && window.__matrixPendingDocInputId) {
                const input = document.getElementById(window.__matrixPendingDocInputId);
                window.__matrixPendingDocInputId = null;
                applyNativeFileToInput(input, data, matrixOnDocSelected);
                return;
            }

            if ((data.type === 'fileSelected' || data.type === 'imageSelected' || data.type === 'photoTaken')
                && window.__matrixPendingPhotoInputId) {
                const input = document.getElementById(window.__matrixPendingPhotoInputId);
                window.__matrixPendingPhotoInputId = null;
                if (data.type === 'imageSelected' || data.type === 'photoTaken') {
                    data.name = data.name || 'photo.jpg';
                    data.mimeType = data.mimeType || 'image/jpeg';
                }
                applyNativeFileToInput(input, data, matrixOnPhotoSelected);
            }
        } catch (e) {
            console.warn('matrix native file handler:', e);
        }
    });

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
