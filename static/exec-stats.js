/**
 * Executive monthly statistics — Chart.js visualizations across all CSMS modules.
 */
(function () {
    const CHART_COLORS = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
        '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#E74C3C'
    ];
    const GRADIENT_PAIRS = [
        ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb']
    ];

    let executiveCharts = {};

    function destroyExecutiveCharts() {
        Object.values(executiveCharts).forEach(c => { try { c.destroy(); } catch (e) { /* */ } });
        executiveCharts = {};
    }

    function mkGradient(ctx, i) {
        const g = ctx.createLinearGradient(0, 0, 0, 280);
        const [a, b] = GRADIENT_PAIRS[i % GRADIENT_PAIRS.length];
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        return g;
    }

    function chartDefaults() {
        Chart.defaults.color = '#B3B3B3';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
        Chart.defaults.font.family = 'Inter, sans-serif';
    }

    function createChart(id, config) {
        const el = document.getElementById(id);
        if (!el) return null;
        if (executiveCharts[id]) {
            executiveCharts[id].destroy();
        }
        executiveCharts[id] = new Chart(el, config);
        return executiveCharts[id];
    }

    function setKpi(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    window.renderExecutiveStatistics = function (stats) {
        if (typeof Chart === 'undefined') {
            console.error('[Stats] Chart.js not loaded');
            return;
        }
        chartDefaults();
        destroyExecutiveCharts();

        const proj = stats.projects || {};
        const task = stats.tasks || {};
        const sched = stats.schedules || {};
        const pb = stats.pb || {};
        const ll = stats.ll || {};
        const otp = stats.otp || {};
        const monthly = stats.monthly_executive || {};

        setKpi('ex-kpi-projects', proj.total || 0);
        setKpi('ex-kpi-tasks', task.total || 0);
        setKpi('ex-kpi-completion', `${(task.completion_rate || 0).toFixed(0)}%`);
        setKpi('ex-kpi-schedules', sched.total || 0);
        setKpi('ex-kpi-pb-avg', pb.average ? `${pb.average}%` : '—');
        setKpi('ex-kpi-otp', otp.avg_progress ? `${otp.avg_progress}%` : '—');
        setKpi('ex-kpi-ll', ll.on_track_pct ? `${ll.on_track_pct}%` : '—');
        setKpi('ex-kpi-pb-records', pb.total || 0);

        const periodEl = document.getElementById('ex-report-period');
        if (periodEl) {
            const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const m = stats.report_month ? months[stats.report_month] : 'Semua Bulan';
            periodEl.textContent = `${m} ${stats.report_year || new Date().getFullYear()}`;
        }

        // 1. Projects — Doughnut status
        createChart('chart-projects-status', {
            type: 'doughnut',
            data: {
                labels: ['Akan Datang', 'Berjalan', 'Selesai', 'Ditunda'],
                datasets: [{
                    data: [
                        proj.by_status?.Upcoming || 0,
                        proj.by_status?.InProgress || 0,
                        proj.by_status?.Completed || 0,
                        proj.by_status?.OnHold || 0
                    ],
                    backgroundColor: ['#F5A623', '#46D369', '#4A90D9', '#9B59B6'],
                    borderWidth: 0,
                    hoverOffset: 12
                }]
            },
            options: {
                cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8 } } }
            }
        });

        // 2. Projects — Polar area by client
        let clients = stats.clients || [];
        if (!clients.length) clients = [{ name: 'Belum ada data', count: 1 }];
        createChart('chart-projects-client', {
            type: 'polarArea',
            data: {
                labels: clients.map(c => c.name),
                datasets: [{
                    data: clients.map(c => c.count),
                    backgroundColor: clients.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'CC')
                }]
            },
            options: {
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } },
                scales: { r: { grid: { color: 'rgba(255,255,255,0.06)' } } }
            }
        });

        // 3. Projects — Horizontal bar completion
        const pc = (stats.project_completion || []).slice(0, 10);
        createChart('chart-projects-completion', {
            type: 'bar',
            data: {
                labels: pc.map(p => p.name),
                datasets: [{
                    label: 'Completion %',
                    data: pc.map(p => p.percentage),
                    backgroundColor: pc.map(p =>
                        p.percentage >= 80 ? '#46D369' : p.percentage >= 50 ? '#F5A623' : '#E50914'),
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { max: 100, grid: { color: 'rgba(255,255,255,0.06)' } } }
            }
        });

        // 4. Tasks — Pie status
        createChart('chart-tasks-status', {
            type: 'pie',
            data: {
                labels: ['Akan Datang', 'Dalam Proses', 'Selesai'],
                datasets: [{
                    data: [
                        task.by_status?.Upcoming || 0,
                        task.by_status?.['In Progress'] || 0,
                        task.by_status?.Completed || 0
                    ],
                    backgroundColor: ['#FF9F43', '#10AC84', '#5F27CD'],
                    borderWidth: 2,
                    borderColor: '#1F1F1F'
                }]
            },
            options: { plugins: { legend: { position: 'right' } } }
        });

        // 5. Tasks — Line monthly completed
        createChart('chart-tasks-monthly', {
            type: 'line',
            data: {
                labels: monthly.labels || [],
                datasets: [{
                    label: 'Tugas Selesai',
                    data: monthly.tasks_completed || [],
                    borderColor: '#46D369',
                    backgroundColor: 'rgba(70,211,105,0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 7
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        // 6. Tasks — Radar categories
        const tcat = stats.tasks_by_category || [];
        createChart('chart-tasks-radar', {
            type: 'radar',
            data: {
                labels: tcat.map(c => c.name),
                datasets: [{
                    label: 'Jumlah Tugas',
                    data: tcat.map(c => c.count),
                    backgroundColor: 'rgba(74,144,217,0.35)',
                    borderColor: '#4A90D9',
                    pointBackgroundColor: '#4A90D9'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { r: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.08)' } } }
            }
        });

        // 7. Schedule — Polar types
        const sbt = sched.by_type || {};
        let stLabels = Object.keys(sbt).filter(k => sbt[k] > 0);
        if (!stLabels.length) stLabels = ['none'];
        if (!stLabels[0] || stLabels[0] === 'none') sbt.none = 0;
        createChart('chart-schedule-types', {
            type: 'polarArea',
            data: {
                labels: stLabels.map(k => k.toUpperCase()),
                datasets: [{
                    data: stLabels.map(k => sbt[k]),
                    backgroundColor: stLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'BB')
                }]
            },
            options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 8 } } } } }
        });

        // 8. Schedule — Multi line monthly
        createChart('chart-schedule-monthly', {
            type: 'line',
            data: {
                labels: monthly.labels || [],
                datasets: [{
                    label: 'Jadwal',
                    data: monthly.schedules || [],
                    borderColor: '#F5A623',
                    backgroundColor: 'rgba(245,166,35,0.15)',
                    fill: true,
                    tension: 0.35
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });

        // 9. Schedule — Bubble (type vs count synthetic)
        const bubbleData = stLabels.map((k, i) => ({
            x: i + 1,
            y: sbt[k],
            r: Math.max(6, Math.min(24, sbt[k] * 3))
        }));
        createChart('chart-schedule-bubble', {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Jenis Jadwal',
                    data: bubbleData,
                    backgroundColor: 'rgba(229,9,20,0.6)',
                    borderColor: '#E50914'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: 'Kategori' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Jumlah' } }
                }
            }
        });

        // 10. PB — Bar by project
        const pbp = pb.by_project || [];
        createChart('chart-pb-projects', {
            type: 'bar',
            data: {
                labels: pbp.map(p => p.name),
                datasets: [{
                    label: 'Skor PB',
                    data: pbp.map(p => p.score),
                    backgroundColor: pbp.map(p =>
                        p.score >= 80 ? '#27ae60' : p.score >= 60 ? '#f1c40f' : '#e74c3c'),
                    borderRadius: 8
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } }
            }
        });

        // 11. PB — Line monthly average
        createChart('chart-pb-trend', {
            type: 'line',
            data: {
                labels: monthly.labels || [],
                datasets: [{
                    label: 'Rata-rata Skor PB',
                    data: pb.monthly_avg || [],
                    borderColor: '#9b59b6',
                    segment: {
                        borderColor: ctx => (ctx.p0.parsed.y < 60 ? '#e74c3c' : '#9b59b6')
                    },
                    tension: 0.4,
                    pointRadius: 5
                }]
            },
            options: { scales: { y: { min: 0, max: 100 } } }
        });

        // 12. PB — Doughnut bands
        const bands = pb.by_band || {};
        createChart('chart-pb-bands', {
            type: 'doughnut',
            data: {
                labels: ['Kritis (<60)', 'Peringatan (60-79)', 'Baik (≥80)'],
                datasets: [{
                    data: [bands.critical || 0, bands.warning || 0, bands.good || 0],
                    backgroundColor: ['#e74c3c', '#f1c40f', '#27ae60'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '55%', plugins: { legend: { position: 'bottom' } } }
        });

        // 13. OTP — Doughnut leading/lagging
        createChart('chart-otp-category', {
            type: 'doughnut',
            data: {
                labels: ['Lagging', 'Leading'],
                datasets: [{
                    data: [otp.lagging || 0, otp.leading || 0],
                    backgroundColor: ['#e74c3c', '#3498db'],
                    hoverOffset: 10
                }]
            },
            options: { cutout: '50%' }
        });

        // 14. OTP — Bar progress buckets
        createChart('chart-otp-progress', {
            type: 'bar',
            data: {
                labels: ['0-24%', '25-49%', '50-74%', '75-100%'],
                datasets: [{
                    label: 'Program',
                    data: otp.progress_buckets || [0, 0, 0, 0],
                    backgroundColor: ['#e74c3c', '#f39c12', '#3498db', '#27ae60'],
                    borderRadius: 10
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });

        // 15. OTP — Horizontal bar top programs
        const topOtp = otp.top_programs || [];
        createChart('chart-otp-top', {
            type: 'bar',
            data: {
                labels: topOtp.map(p => p.name),
                datasets: [{
                    label: 'Progress %',
                    data: topOtp.map(p => p.progress),
                    backgroundColor: topOtp.map(p =>
                        p.progress >= 100 ? '#27ae60' : p.progress >= 50 ? '#3498db' : '#e67e22'),
                    borderRadius: 6
                }]
            },
            options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: 100 } } }
        });

        // 16. LL — On track vs off track
        createChart('chart-ll-track', {
            type: 'bar',
            data: {
                labels: ['On Track', 'Off Track'],
                datasets: [{
                    data: [ll.on_track || 0, ll.off_track || 0],
                    backgroundColor: ['#2ecc71', '#e74c3c'],
                    borderRadius: 12,
                    barThickness: 48
                }]
            },
            options: { plugins: { legend: { display: false } } }
        });

        // 17. LL — Polar lagging vs leading count
        createChart('chart-ll-category', {
            type: 'polarArea',
            data: {
                labels: ['Lagging Indicators', 'Leading Indicators'],
                datasets: [{
                    data: [ll.lagging || 0, ll.leading || 0],
                    backgroundColor: ['rgba(231,76,60,0.75)', 'rgba(52,152,219,0.75)']
                }]
            },
            options: { plugins: { legend: { position: 'bottom' } } }
        });

        // 18. Executive mixed — bar + line
        const ctx = document.getElementById('chart-executive-mixed')?.getContext('2d');
        createChart('chart-executive-mixed', {
            type: 'bar',
            data: {
                labels: monthly.labels || [],
                datasets: [
                    {
                        type: 'bar',
                        label: 'Proyek Baru',
                        data: monthly.projects || [],
                        backgroundColor: 'rgba(229,9,20,0.7)',
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: 'Jadwal',
                        data: monthly.schedules || [],
                        backgroundColor: 'rgba(245,166,35,0.7)',
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Audit PB',
                        data: monthly.pb_audits || [],
                        borderColor: '#9b59b6',
                        borderWidth: 3,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
                scales: {
                    y: { beginAtZero: true, position: 'left' },
                    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } }
                }
            }
        });
    };

    window.getStatisticsQueryParams = function () {
        const y = document.getElementById('ex-filter-year')?.value;
        const m = document.getElementById('ex-filter-month')?.value;
        const params = new URLSearchParams();
        if (y) params.set('year', y);
        if (m) params.set('month', m);
        const q = params.toString();
        return q ? `?${q}` : '';
    };

    window.destroyExecutiveCharts = destroyExecutiveCharts;
})();
