/**
 * Matrix sheet dashboard — 5 Chart.js visualizations (filtered table data).
 */
(function () {
    const CHART_IDS = ['compliance', 'kpi', 'expiryStack', 'coverage', 'personExpiry'];
    let charts = {};

    const PALETTE = ['#46D369', '#F5A623', '#e74c3c', '#4A90D9', '#9b59b6', '#E50914', '#1abc9c', '#3498db'];

    function chartBaseOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#B3B3B3',
                        boxWidth: 12,
                        padding: 12,
                        font: { size: 11, family: 'Inter, sans-serif' },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(20,20,20,0.95)',
                    titleColor: '#fff',
                    bodyColor: '#ddd',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                },
            },
        };
    }

    function destroyAll() {
        Object.values(charts).forEach(c => {
            try { c.destroy(); } catch (e) { /* */ }
        });
        charts = {};
    }

    function create(id, config) {
        const el = document.getElementById(`mx-chart-${id}`);
        if (!el || typeof Chart === 'undefined') return null;
        if (charts[id]) {
            try { charts[id].destroy(); } catch (e) { /* */ }
        }
        charts[id] = new Chart(el, config);
        return charts[id];
    }

    function isExpiryCol(col) {
        const label = (col?.label || '').replace(/\*/g, '').trim().toLowerCase();
        return /expir|expired|end date|berakhir|kadaluarsa/i.test(label);
    }

    function warnDays(col) {
        const l = (col?.label || '').replace(/\*/g, '').trim().toLowerCase();
        if (/mcu|hse passport|siml|^sim\s*expir|bst|sbtc|one\s*sika|t-bosiet|h2s|sea survival|hse demo|well control|first aid|fire|ohc|forklift|radiation|handak|k3 umum|tkpk|tkdn|hse 101|hse 201|hse 301/.test(l)) {
            if (/skck|contract|kontrak/.test(l)) return 30;
            return 90;
        }
        if (/skck|contract|kontrak/.test(l)) return 30;
        return 30;
    }

    function parseDate(val) {
        if (!val) return null;
        const s = String(val).trim();
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function daysUntil(val) {
        const d = parseDate(val);
        if (!d) return null;
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return Math.ceil((d - t) / 86400000);
    }

    function buildCompliance(rows, sheet) {
        const counts = { ok: 0, soon: 0, expired: 0, noData: 0 };
        const expiryCols = (sheet?.columns || []).filter(isExpiryCol);
        if (!rows.length) return { ok: 0, soon: 0, expired: 0, noData: 1 };
        rows.forEach(row => {
            let hasExpired = false;
            let hasSoon = false;
            let hasAny = false;
            expiryCols.forEach(col => {
                const du = daysUntil(row.cells?.[col.id]);
                if (du == null) return;
                hasAny = true;
                const w = warnDays(col);
                if (du < 0) hasExpired = true;
                else if (du <= w) hasSoon = true;
            });
            if (hasExpired) counts.expired += 1;
            else if (hasSoon) counts.soon += 1;
            else if (hasAny) counts.ok += 1;
            else counts.noData += 1;
        });
        return counts;
    }

    function buildExpiryStack(rows, sheet) {
        const cols = (sheet?.columns || []).filter(isExpiryCol).slice(0, 10);
        const labels = cols.map(c => {
            const l = (c.label || '').replace(/\*/g, '').trim();
            return l.length > 22 ? `${l.slice(0, 20)}…` : l;
        });
        const soon = [];
        const expired = [];
        cols.forEach(col => {
            let s = 0;
            let e = 0;
            rows.forEach(row => {
                const du = daysUntil(row.cells?.[col.id]);
                if (du == null) return;
                if (du < 0) e += 1;
                else if (du <= warnDays(col)) s += 1;
            });
            soon.push(s);
            expired.push(e);
        });
        return { labels, soon, expired };
    }

    function buildCoverage(rows, sheet) {
        const cols = (sheet?.columns || []).filter(c => {
            const l = (c.label || '').replace(/\*/g, '').trim().toLowerCase();
            if (/^client$|^project$|^no$/.test(l)) return false;
            if (c.type === 'file' || c.type === 'image') return false;
            if (/^doc:/i.test(c.label || '')) return false;
            return true;
        }).slice(0, 8);
        const labels = cols.map(c => {
            const l = (c.label || '').replace(/\*/g, '').trim();
            return l.length > 18 ? `${l.slice(0, 16)}…` : l;
        });
        const data = cols.map(col => {
            if (!rows.length) return 0;
            const filled = rows.filter(r => (r.cells?.[col.id] || '').toString().trim()).length;
            return Math.round((filled / rows.length) * 100);
        });
        return { labels, data };
    }

    function buildPersonExpiry(row, sheet) {
        const items = [];
        (sheet?.columns || []).forEach(col => {
            if (!isExpiryCol(col)) return;
            const raw = (row?.cells?.[col.id] || '').toString().trim();
            if (!raw) return;
            const du = daysUntil(raw);
            const label = (col.label || '').replace(/\*/g, '').trim();
            items.push({
                label: label.length > 20 ? `${label.slice(0, 18)}…` : label,
                days: du != null ? Math.max(du, 0) : 0,
            });
        });
        items.sort((a, b) => a.days - b.days);
        return items.slice(0, 12);
    }

    function renderChartsPanel() {
        const cards = [
            { id: 'compliance', title: 'Status Compliance Personel', sub: 'Ringkasan filter aktif' },
            { id: 'kpi', title: 'Indikator KPI Sheet', sub: 'Metrik dashboard' },
            { id: 'expiryStack', title: 'Expiry per Kolom', sub: 'Segera vs sudah expired' },
            { id: 'coverage', title: 'Kelengkapan Data', sub: '% baris terisi per kolom' },
            { id: 'personExpiry', title: 'Hari ke Expiry (Personel)', sub: 'Baris terpilih di sidebar' },
        ];
        return `
        <section class="mx-charts-section" aria-label="Ringkasan chart">
            <h3 class="mx-charts-heading">Ringkasan Visual</h3>
            <div class="mx-charts-grid">
                ${cards.map(c => `
                <article class="mx-chart-card">
                    <header class="mx-chart-card-head">
                        <strong>${c.title}</strong>
                        <span>${c.sub}</span>
                    </header>
                    <div class="mx-chart-wrap"><canvas id="mx-chart-${c.id}" role="img" aria-label="${c.title}"></canvas></div>
                </article>`).join('')}
            </div>
        </section>`;
    }

    function renderComplianceChart(data) {
        create('compliance', {
            type: 'doughnut',
            data: {
                labels: ['Compliant', 'Akan Expired', 'Sudah Expired', 'Belum Ada Data'],
                datasets: [{
                    data: [data.ok, data.soon, data.expired, data.noData],
                    backgroundColor: ['#46D369', '#F5A623', '#e74c3c', '#6b7280'],
                    borderWidth: 0,
                    hoverOffset: 10,
                }],
            },
            options: {
                ...chartBaseOptions(),
                cutout: '62%',
                plugins: {
                    ...chartBaseOptions().plugins,
                    legend: { position: 'bottom' },
                },
            },
        });
    }

    function renderKpiChart(summary) {
        const items = (summary?.kpis || []).filter(k => k.label).slice(0, 10);
        const labels = items.map(k => k.shortLabel || k.label);
        const values = items.map(k => {
            const n = parseInt(String(k.value).replace(/[^\d-]/g, ''), 10);
            return Number.isNaN(n) ? 0 : n;
        });
        const colors = items.map(k => k.color || '#C41E3A');
        create('kpi', {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['—'],
                datasets: [{
                    label: 'Jumlah',
                    data: values.length ? values : [0],
                    backgroundColor: colors,
                    borderRadius: 8,
                    borderSkipped: false,
                }],
            },
            options: {
                ...chartBaseOptions(),
                indexAxis: 'y',
                plugins: { ...chartBaseOptions().plugins, legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
                    y: { grid: { display: false }, ticks: { font: { size: 10 } } },
                },
            },
        });
    }

    function renderExpiryStackChart(stack) {
        create('expiryStack', {
            type: 'bar',
            data: {
                labels: stack.labels.length ? stack.labels : ['—'],
                datasets: [
                    {
                        label: 'Akan expired',
                        data: stack.soon,
                        backgroundColor: '#F5A623',
                        borderRadius: 4,
                    },
                    {
                        label: 'Sudah expired',
                        data: stack.expired,
                        backgroundColor: '#e74c3c',
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                ...chartBaseOptions(),
                plugins: { ...chartBaseOptions().plugins, legend: { position: 'top' } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 25, font: { size: 9 } } },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
                },
            },
        });
    }

    function renderCoverageChart(cov) {
        create('coverage', {
            type: 'polarArea',
            data: {
                labels: cov.labels.length ? cov.labels : ['—'],
                datasets: [{
                    data: cov.data.length ? cov.data : [0],
                    backgroundColor: PALETTE.map(c => c + '99'),
                    borderColor: PALETTE,
                    borderWidth: 1,
                }],
            },
            options: {
                ...chartBaseOptions(),
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 25, backdropColor: 'transparent' },
                        grid: { color: 'rgba(255,255,255,0.08)' },
                    },
                },
            },
        });
    }

    function renderPersonExpiryChart(items, personName) {
        create('personExpiry', {
            type: 'line',
            data: {
                labels: items.length ? items.map(i => i.label) : ['Tidak ada expiry terisi'],
                datasets: [{
                    label: personName || 'Personel',
                    data: items.length ? items.map(i => i.days) : [0],
                    borderColor: '#C41E3A',
                    backgroundColor: 'rgba(196,30,58,0.15)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#C41E3A',
                }],
            },
            options: {
                ...chartBaseOptions(),
                plugins: { ...chartBaseOptions().plugins, legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Hari', color: '#888' } },
                    x: { ticks: { maxRotation: 50, minRotation: 30, font: { size: 9 } } },
                },
            },
        });
    }

    window.renderMatrixChartsPanelHtml = renderChartsPanel;

    window.renderMatrixSheetCharts = async function (sheet, rows, summary, selectedRow, personName) {
        const ok = typeof window.ensureChartJs === 'function'
            ? await window.ensureChartJs()
            : typeof Chart !== 'undefined';
        if (!ok) return;

        Chart.defaults.color = '#B3B3B3';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
        Chart.defaults.font.family = 'Inter, sans-serif';

        destroyAll();

        const compliance = buildCompliance(rows, sheet);
        const stack = buildExpiryStack(rows, sheet);
        const cov = buildCoverage(rows, sheet);
        const personItems = selectedRow ? buildPersonExpiry(selectedRow, sheet) : [];

        renderComplianceChart(compliance);
        renderKpiChart(summary);
        renderExpiryStackChart(stack);
        renderCoverageChart(cov);
        renderPersonExpiryChart(personItems, personName);
    };

    window.destroyMatrixSheetCharts = destroyAll;

    window.captureMatrixChartImagesForPdf = function () {
        const out = {};
        CHART_IDS.forEach(id => {
            const canvas = document.getElementById(`mx-chart-${id}`);
            if (canvas && canvas.width > 0) {
                out[id] = canvas.toDataURL('image/png', 1.0);
            }
        });
        return out;
    };
})();
