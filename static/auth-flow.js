/**
 * CSMS Google Sign-In + personnel onboarding gate.
 */
(function () {
    const TOKEN_KEY = 'csms_auth_token';
    const SESSION_KEY = 'csms_user_session';

    let googleClientId = '';
    let authSession = null;

    function apiBase() {
        return typeof API_BASE !== 'undefined' ? API_BASE : '';
    }

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token) {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    }

    function setSession(session) {
        authSession = session || null;
        if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        else localStorage.removeItem(SESSION_KEY);
        updateHeaderBadge();
    }

    function loadCachedSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function updateHeaderBadge() {
        const badge = document.getElementById('header-user-badge');
        if (!badge || !authSession) return;
        const name = authSession.personnel_name || authSession.name || authSession.email || 'User';
        badge.textContent = name.split(',')[0].trim() || name;
        badge.title = authSession.email || '';
    }

    function showLogin() {
        document.body.classList.add('auth-locked');
        document.getElementById('csms-login-screen')?.classList.add('active');
        document.getElementById('csms-onboarding-screen')?.classList.remove('active');
        document.body.classList.remove('personnel-authenticated');
    }

    function showOnboarding() {
        document.body.classList.add('auth-locked');
        document.getElementById('csms-login-screen')?.classList.remove('active');
        document.getElementById('csms-onboarding-screen')?.classList.add('active');
        loadOnboardingProductLines();
    }

    function showApp() {
        document.body.classList.remove('auth-locked');
        document.getElementById('csms-login-screen')?.classList.remove('active');
        document.getElementById('csms-onboarding-screen')?.classList.remove('active');
        document.body.classList.add('personnel-authenticated');
        updateHeaderBadge();
        const logoutBtn = document.getElementById('personnel-logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (authSession?.is_admin) {
            document.body.classList.add('admin-mode');
            localStorage.setItem('csms_admin_logged_in', 'true');
            const adminBtn = document.getElementById('admin-login-btn');
            if (adminBtn) adminBtn.style.display = 'none';
            if (typeof loadMasterDataPage === 'function') loadMasterDataPage();
            if (typeof populateClientProductLineDropdowns === 'function') populateClientProductLineDropdowns();
        }
    }

    async function authFetch(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        if (options.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
        return res;
    }

    async function fetchAuthConfig() {
        const res = await fetch(`${apiBase()}/auth/config`);
        if (!res.ok) throw new Error('Gagal memuat konfigurasi login');
        return res.json();
    }

    async function handleGoogleCredential(response) {
        const errEl = document.getElementById('csms-login-error');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        try {
            const res = await authFetch('/auth/google', {
                method: 'POST',
                body: JSON.stringify({ id_token: response.credential }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Login gagal');
            setToken(data.token);
            setSession(data.session);
            if (data.needs_onboarding) showOnboarding();
            else showApp();
            if (typeof showToast === 'function') showToast('Login berhasil', 'success');
        } catch (e) {
            if (errEl) {
                errEl.textContent = e.message || 'Login gagal';
                errEl.style.display = 'block';
            }
        }
    }

    function initGoogleButton() {
        if (!googleClientId || !window.google?.accounts?.id) return;
        google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredential,
            auto_select: true,
            itp_support: true,
        });
        const container = document.getElementById('csms-google-btn-wrap');
        if (container) {
            container.innerHTML = '';
            google.accounts.id.renderButton(container, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                width: Math.min(320, container.clientWidth || 320),
            });
        }
        google.accounts.id.prompt();
    }

    async function validateExistingSession() {
        const token = getToken();
        if (!token) {
            showLogin();
            return;
        }
        try {
            const res = await authFetch('/auth/me');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Session expired');
            setToken(token);
            setSession(data.session);
            if (data.needs_onboarding) showOnboarding();
            else showApp();
        } catch (e) {
            setToken('');
            setSession(null);
            showLogin();
            const errEl = document.getElementById('csms-login-error');
            if (errEl && e.message) {
                errEl.textContent = e.message;
                errEl.style.display = 'block';
            }
        }
    }

    async function loadOnboardingProductLines() {
        const sel = document.getElementById('onboard-pl-select');
        const nameSel = document.getElementById('onboard-personnel-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">Memuat product line...</option>';
        if (nameSel) nameSel.innerHTML = '<option value="">Pilih Product Line dulu</option>';
        try {
            const res = await authFetch('/auth/onboarding/product-lines');
            const lines = await res.json();
            if (!res.ok) throw new Error(lines.detail || 'Gagal memuat product line');
            sel.innerHTML = '<option value="">— Pilih Product Line —</option>' +
                lines.map(pl => `<option value="${pl.id}">${pl.name} (${pl.employee_count})</option>`).join('');
        } catch (e) {
            sel.innerHTML = '<option value="">Gagal memuat</option>';
            if (typeof showToast === 'function') showToast(e.message, 'error');
        }
    }

    async function onOnboardPlChange() {
        const plId = document.getElementById('onboard-pl-select')?.value;
        const nameSel = document.getElementById('onboard-personnel-select');
        const preview = document.getElementById('onboard-personnel-preview');
        if (!nameSel) return;
        if (!plId) {
            nameSel.innerHTML = '<option value="">Pilih Product Line dulu</option>';
            if (preview) preview.textContent = '';
            return;
        }
        nameSel.innerHTML = '<option value="">Memuat nama...</option>';
        try {
            const res = await authFetch(`/auth/onboarding/personnel?product_line_id=${encodeURIComponent(plId)}`);
            const rows = await res.json();
            if (!res.ok) throw new Error(rows.detail || 'Gagal memuat personnel');
            if (!rows.length) {
                nameSel.innerHTML = '<option value="">Tidak ada nama tersedia</option>';
                return;
            }
            nameSel.innerHTML = '<option value="">— Pilih Personnel Name —</option>' +
                rows.map(r => {
                    const pos = r.job_family_description || r.job_description || '';
                    return `<option value="${r.id}" data-jfd="${encodeURIComponent(pos)}">${r.name}${pos ? ' — ' + pos : ''}</option>`;
                }).join('');
        } catch (e) {
            nameSel.innerHTML = '<option value="">Gagal memuat</option>';
            if (typeof showToast === 'function') showToast(e.message, 'error');
        }
    }

    function onOnboardPersonnelChange() {
        const sel = document.getElementById('onboard-personnel-select');
        const preview = document.getElementById('onboard-personnel-preview');
        if (!sel || !preview) return;
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !sel.value) {
            preview.textContent = '';
            return;
        }
        const jfd = decodeURIComponent(opt.getAttribute('data-jfd') || '');
        preview.textContent = jfd ? `Posisi: ${jfd}` : '';
    }

    async function submitOnboarding(e) {
        e.preventDefault();
        const plId = parseInt(document.getElementById('onboard-pl-select')?.value, 10);
        const empId = parseInt(document.getElementById('onboard-personnel-select')?.value, 10);
        const errEl = document.getElementById('onboard-error');
        if (errEl) errEl.style.display = 'none';
        if (!plId || !empId) {
            if (errEl) { errEl.textContent = 'Pilih Product Line dan Personnel Name'; errEl.style.display = 'block'; }
            return;
        }
        try {
            const res = await authFetch('/auth/onboard', {
                method: 'POST',
                body: JSON.stringify({ product_line_id: plId, employee_id: empId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Konfirmasi gagal');
            setToken(data.token);
            setSession(data.session);
            showApp();
            if (typeof showToast === 'function') {
                showToast('Selamat datang, ' + (data.session.personnel_name || ''), 'success');
            }
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'Konfirmasi gagal';
                errEl.style.display = 'block';
            }
        }
    }

    function personnelSignOut() {
        setToken('');
        setSession(null);
        if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
        document.body.classList.remove('admin-mode');
        localStorage.removeItem('csms_admin_logged_in');
        const logoutBtn = document.getElementById('personnel-logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'none';
        showLogin();
        if (typeof showToast === 'function') showToast('Anda telah keluar', 'success');
    }

    async function initAuthFlow() {
        const isPreview = new URLSearchParams(window.location.search).get('mode') === 'preview';
        if (isPreview) {
            document.body.classList.remove('auth-locked');
            return;
        }
        try {
            const cfg = await fetchAuthConfig();
            googleClientId = cfg.google_client_id || '';
            if (!cfg.google_enabled) {
                const errEl = document.getElementById('csms-login-error');
                if (errEl) {
                    errEl.textContent = 'GOOGLE_CLIENT_ID belum dikonfigurasi di server.';
                    errEl.style.display = 'block';
                }
                showLogin();
                return;
            }
            authSession = loadCachedSession();
            const tryGoogle = () => {
                if (window.google?.accounts?.id) initGoogleButton();
                else setTimeout(tryGoogle, 100);
            };
            tryGoogle();
            await validateExistingSession();
        } catch (e) {
            console.error('[Auth]', e);
            showLogin();
        }
    }

    window.initAuthFlow = initAuthFlow;
    window.personnelSignOut = personnelSignOut;
    window.onOnboardPlChange = onOnboardPlChange;
    window.onOnboardPersonnelChange = onOnboardPersonnelChange;
    window.submitOnboarding = submitOnboarding;
    window.getCsmsAuthToken = getToken;
    window.getCsmsAuthSession = () => authSession;
})();
