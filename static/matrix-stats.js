/**
 * Matrix Personnel — compliance charts on Statistics page.
 */
(function () {
    const TAB_LABELS = {
        employee_mandatory_training: 'Pelatihan Wajib',
        personnel_health: 'Kesehatan Personel',
        personnel_data_information: 'Data Personel',
        contract_information: 'Kontrak',
        emergency_contact_information: 'Kontak Darurat',
    };

    let matrixStatsCharts = {};

    function apiBase() {
        return typeof API_BASE !== 'undefined' ? API_BASE : '';
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

    function getColByLabel(sheet, pattern) {
        return (sheet?.columns || []).find(c => pattern.test(c.label));
    }

    function rowHasProject(sheet, row) {
        const projectCol = getColByLabel(sheet, /^project/i);
        return !!(projectCol && (row.cells?.[projectCol.id] || '').trim());
    }

    function isMasterRow(sheet, row) {
        const clientCol = getColByLabel(sheet, /^client/i);
        if (!clientCol) return !rowHasProject(sheet, row);
        return !(row.cells?.[clientCol.id] || '').trim() && !rowHasProject(sheet, row);
    }

    function isExpiryColumn(col) {
        const label = col.label.replace(/\*/g, '').trim().toLowerCase();
        if (/^client$|^project$|^no$/.test(label)) return false;
        if (/training date|^mcu date$|booster.*date|skck date$|hse passport date|contract start|review \(client\) date|follow up date|birth date/i.test(label)
            && !/expir|expired|end date|berakhir|kadaluarsa/i.test(label)) {
            return false;
        }
        return /expir|expired|end date|berakhir|kadaluarsa/i.test(label)
            || (col.type === 'date' && /expir|expired|end/i.test(label));
    }

    function getExpiryWarnDays(label) {
        const l = (label || '').toLowerCase();
        if (/mcu/i.test(l)) return 90;
        if (/skck.*expir/i.test(l)) return 30;
        if (/contract end|kontrak/i.test(l)) return 30;
        return 30;
    }

    function collectExpiryMetrics(workbook) {
        const items = [];
        for (const sheet of workbook?.sheets || []) {
            const rows = (sheet.rows || []).filter(r => isMasterRow(sheet, r));
            const cols = (sheet.columns || []).filter(isExpiryColumn);
            const tabName = TAB_LABELS[sheet.id] || sheet.title || sheet.name;
            for (const col of cols) {
                const warnDays = getExpiryWarnDays(col.label);
                let soon = 0;
                let expired = 0;
                rows.forEach(row => {
                    const du = daysUntil(row.cells?.[col.id]);
                    if (du == null) return;
                    if (du < 0) expired += 1;
                    else if (du <= warnDays) soon += 1;
                });
                items.push({
                    label: col.label.replace(/\*/g, '').trim(),
                    displayLabel: `${tabName}: ${col.label.replace(/\*/g, '').trim()}`,
                    warnDays,
                    soon,
                    expired,
                    category: tabName,
                });
            }
        }
        return items;
    }

    function buildComplianceCounts(workbook) {
        const counts = { ok: 0, soon: 0, expired: 0, noData: 0 };
        const profileSheet = workbook?.sheets?.find(s => s.id === 'personnel_data_information');
        const nameCol = getColByLabel(profileSheet, /personnel name/i)
            || getColByLabel(workbook?.sheets?.[0], /personnel name/i);
        if (!nameCol) return counts;

        const names = new Set();
        for (const sheet of workbook?.sheets || []) {
            const nc = getColByLabel(sheet, /personnel name/i);
            if (!nc) continue;
            (sheet.rows || []).filter(r => isMasterRow(sheet, r)).forEach(r => {
                const n = (r.cells?.[nc.id] || '').trim();
                if (n) names.add(n.toLowerCase());
            });
        }

        names.forEach(nl => {
            let hasExpired = false;
            let hasSoon = false;
            let hasAnyDate = false;

            for (const sheet of workbook?.sheets || []) {
                const nc = getColByLabel(sheet, /personnel name/i);
                if (!nc) continue;
                const row = (sheet.rows || []).find(r => {
                    if (!isMasterRow(sheet, r)) return false;
                    return (r.cells?.[nc.id] || '').trim().toLowerCase() === nl;
                });
                if (!row) continue;
                for (const col of (sheet.columns || []).filter(isExpiryColumn)) {
                    const du = daysUntil(row.cells?.[col.id]);
                    if (du == null) continue;
                    hasAnyDate = true;
                    const warn = getExpiryWarnDays(col.label);
                    if (du < 0) hasExpired = true;
                    else if (du <= warn) hasSoon = true;
                }
            }

            if (hasExpired) counts.expired += 1;
            else if (hasSoon) counts.soon += 1;
            else if (hasAnyDate) counts.ok += 1;
            else counts.noData += 1;
        });
        return counts;
    }

    function destroyMatrixStatsCharts() {
        Object.values(matrixStatsCharts).forEach(c => { try { c.destroy(); } catch (e) { /* */ } });
        matrixStatsCharts = {};
    }

    function createChart(id, config) {
        const el = document.getElementById(id);
        if (!el || typeof Chart === 'undefined') return null;
        if (matrixStatsCharts[id]) {
            try { matrixStatsCharts[id].destroy(); } catch (e) { /* */ }
        }
        matrixStatsCharts[id] = new Chart(el, config);
        return matrixStatsCharts[id];
    }

    function renderMatrixKpiStrip(expiryMetrics, compliance) {
        const strip = document.getElementById('mx-stats-kpi-strip');
        if (!strip) return;
        const totalSoon = expiryMetrics.reduce((s, m) => s + m.soon, 0);
        const totalExpired = expiryMetrics.reduce((s, m) => s + m.expired, 0);
        const cards = [
            { label: 'Personel (Master)', value: compliance.ok + compliance.soon + compliance.expired + compliance.noData, color: '#46D369' },
            { label: 'Akan Expired', value: totalSoon, color: '#F5A623' },
            { label: 'Sudah Expired', value: totalExpired, color: '#e74c3c' },
            { label: 'Compliant', value: compliance.ok, color: '#4A90D9' },
        ];
        strip.innerHTML = cards.map(c => `
            <div class="ex-kpi" style="--kpi-color:${c.color}">
                <span>${c.label}</span>
                <strong>${c.value}</strong>
            </div>`).join('');
    }

    async function fetchMatrixWorkbook() {
        const res = await fetch(`${apiBase()}/matrix/workbook?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Gagal memuat matrix workbook');
        return res.json();
    }

    window.renderMatrixComplianceStatistics = async function () {
        const section = document.getElementById('mx-stats-section');
        if (!section) return;

        try {
            const workbook = await fetchMatrixWorkbook();
            const expiryMetrics = collectExpiryMetrics(workbook);
            const compliance = buildComplianceCounts(workbook);

            renderMatrixKpiStrip(expiryMetrics, compliance);

            const chartOk = typeof window.ensureChartJs === 'function'
                ? await window.ensureChartJs()
                : typeof Chart !== 'undefined';
            if (!chartOk) return;

            if (typeof Chart !== 'undefined') {
                Chart.defaults.color = '#B3B3B3';
                Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
                Chart.defaults.font.family = 'Inter, sans-serif';
            }
            destroyMatrixStatsCharts();

            const expiringBar = expiryMetrics.filter(m => m.soon > 0).sort((a, b) => b.soon - a.soon).slice(0, 15);
            const expiredBar = expiryMetrics.filter(m => m.expired > 0).sort((a, b) => b.expired - a.expired).slice(0, 15);

            const categoryMap = new Map();
            expiryMetrics.forEach(m => {
                const prev = categoryMap.get(m.category) || { soon: 0, expired: 0 };
                prev.soon += m.soon;
                prev.expired += m.expired;
                categoryMap.set(m.category, prev);
            });
            const categoryLabels = [...categoryMap.keys()];
            const catIssueTotals = categoryLabels.map(k => {
                const v = categoryMap.get(k);
                return v.soon + v.expired;
            });

            createChart('mx-stats-compliance-donut', {
                type: 'doughnut',
                data: {
                    labels: ['Compliant', 'Akan Expired', 'Sudah Expired', 'Belum Ada Data'],
                    datasets: [{
                        data: [compliance.ok, compliance.soon, compliance.expired, compliance.noData],
                        backgroundColor: ['#46D369', '#F5A623', '#e74c3c', '#555555'],
                        borderWidth: 0,
                        hoverOffset: 8,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } },
                },
            });

            createChart('mx-stats-category-donut', {
                type: 'doughnut',
                data: {
                    labels: categoryLabels.length ? categoryLabels : ['Tidak ada data'],
                    datasets: [{
                        data: categoryLabels.length ? catIssueTotals : [1],
                        backgroundColor: ['#E50914', '#F5A623', '#4A90D9', '#9b59b6', '#1abc9c', '#3498db'],
                        borderWidth: 0,
                        hoverOffset: 8,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } } },
                },
            });

            createChart('mx-stats-expiring-bar', {
                type: 'bar',
                data: {
                    labels: expiringBar.length ? expiringBar.map(m => m.displayLabel) : ['Tidak ada'],
                    datasets: [{
                        label: 'Akan Expired',
                        data: expiringBar.length ? expiringBar.map(m => m.soon) : [0],
                        backgroundColor: '#F5A623',
                        borderRadius: 6,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, ticks: { stepSize: 1 } },
                        y: { ticks: { font: { size: 10 } } },
                    },
                },
            });

            createChart('mx-stats-expired-bar', {
                type: 'bar',
                data: {
                    labels: expiredBar.length ? expiredBar.map(m => m.displayLabel) : ['Tidak ada'],
                    datasets: [{
                        label: 'Sudah Expired',
                        data: expiredBar.length ? expiredBar.map(m => m.expired) : [0],
                        backgroundColor: '#e74c3c',
                        borderRadius: 6,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, ticks: { stepSize: 1 } },
                        y: { ticks: { font: { size: 10 } } },
                    },
                },
            });

            createChart('mx-stats-expiry-grouped', {
                type: 'bar',
                data: {
                    labels: expiryMetrics.length ? expiryMetrics.map(m => m.displayLabel) : ['Tidak ada kolom expiry'],
                    datasets: [
                        {
                            label: 'Akan Expired',
                            data: expiryMetrics.length ? expiryMetrics.map(m => m.soon) : [0],
                            backgroundColor: '#F5A623',
                            borderRadius: 4,
                        },
                        {
                            label: 'Sudah Expired',
                            data: expiryMetrics.length ? expiryMetrics.map(m => m.expired) : [0],
                            backgroundColor: '#e74c3c',
                            borderRadius: 4,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                        x: { ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 25 } },
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    },
                },
            });
        } catch (e) {
            console.warn('[Matrix Stats]', e.message);
            const strip = document.getElementById('mx-stats-kpi-strip');
            if (strip) strip.innerHTML = '<p class="ex-chart-desc">Matrix compliance tidak tersedia.</p>';
        }
    };
})();
