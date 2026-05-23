/**
 * CSMS Google Sign-In + personnel onboarding gate.
 */
(function () {
    const TOKEN_KEY = 'csms_auth_token';
    const SESSION_KEY = 'csms_user_session';

    let googleClientId = '';
    let authSession = null;
    let lastSessionRefresh = 0;
    let onboardPlCombo = null;
    let onboardPersonnelCombo = null;
    let onboardPersonnelRows = [];

    function apiBase() {
        return typeof API_BASE !== 'undefined' ? API_BASE : '';
    }

    function readStorage(key) {
        try {
            return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
        } catch (e) {
            return '';
        }
    }

    function writeStorage(key, value) {
        try {
            if (value) {
                localStorage.setItem(key, value);
                sessionStorage.setItem(key, value);
            } else {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            }
        } catch (e) {
            try {
                if (value) sessionStorage.setItem(key, value);
                else sessionStorage.removeItem(key);
            } catch (e2) { /* ignore */ }
        }
    }

    function getToken() {
        return readStorage(TOKEN_KEY);
    }

    function setToken(token) {
        writeStorage(TOKEN_KEY, token || '');
    }

    function setSession(session) {
        authSession = session || null;
        if (session) writeStorage(SESSION_KEY, JSON.stringify(session));
        else writeStorage(SESSION_KEY, '');
        updateHeaderUser();
    }

    function loadCachedSession() {
        try {
            const raw = readStorage(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function isAuthHttpFailure(status, message) {
        const msg = (message || '').toLowerCase();
        if (status === 401 || status === 403) return true;
        return /expired|invalid session|tidak valid|authorization required|signature|unauthorized/.test(msg);
    }

    function restoreUIFromCachedSession() {
        const cached = loadCachedSession();
        if (!cached || !getToken()) return false;
        authSession = cached;
        if (cached.onboarded && cached.employee_id) {
            showApp();
            return true;
        }
        if (!cached.onboarded) {
            showOnboarding();
            return true;
        }
        return false;
    }

    function createSearchableSelect(config) {
        const input = document.getElementById(config.inputId);
        const list = document.getElementById(config.listId);
        const hidden = document.getElementById(config.hiddenId);
        if (!input || !list || !hidden) return null;

        let items = [];
        let open = false;
        let highlight = -1;

        function closeList() {
            open = false;
            highlight = -1;
            list.classList.remove('open');
            input.setAttribute('aria-expanded', 'false');
        }

        function openList() {
            if (input.disabled) return;
            open = true;
            list.classList.add('open');
            input.setAttribute('aria-expanded', 'true');
            renderList(input.value);
        }

        function setValue(id, label) {
            hidden.value = id ? String(id) : '';
            input.value = label || '';
            closeList();
            if (typeof config.onChange === 'function') config.onChange(id || '');
        }

        function clearValue(placeholder) {
            hidden.value = '';
            input.value = '';
            input.placeholder = placeholder || config.placeholder || '';
            closeList();
        }

        function renderList(query) {
            const q = (query || '').trim().toLowerCase();
            const filtered = q
                ? items.filter(it => it.label.toLowerCase().includes(q))
                : items.slice();
            list.innerHTML = '';
            if (!filtered.length) {
                const li = document.createElement('li');
                li.className = 'csms-search-select-empty';
                li.textContent = items.length ? 'Tidak ada hasil' : (config.emptyText || 'Tidak ada data');
                list.appendChild(li);
                return;
            }
            filtered.forEach((it, idx) => {
                const li = document.createElement('li');
                li.className = 'csms-search-select-item' + (idx === highlight ? ' active' : '');
                li.setAttribute('role', 'option');
                li.textContent = it.label;
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    setValue(it.id, it.label);
                });
                list.appendChild(li);
            });
        }

        input.addEventListener('focus', () => openList());
        input.addEventListener('click', () => openList());
        input.addEventListener('input', () => {
            hidden.value = '';
            openList();
        });
        input.addEventListener('keydown', (e) => {
            const options = list.querySelectorAll('.csms-search-select-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!open) openList();
                highlight = Math.min(highlight + 1, options.length - 1);
                options.forEach((el, i) => el.classList.toggle('active', i === highlight));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlight = Math.max(highlight - 1, 0);
                options.forEach((el, i) => el.classList.toggle('active', i === highlight));
            } else if (e.key === 'Enter' && highlight >= 0 && options[highlight]) {
                e.preventDefault();
                options[highlight].dispatchEvent(new MouseEvent('mousedown'));
            } else if (e.key === 'Escape') {
                closeList();
            }
        });
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target)) closeList();
        });

        return {
            setItems(newItems) {
                items = (newItems || []).map(it => ({
                    id: it.id,
                    label: it.label,
                    meta: it.meta || {},
                }));
            },
            setValue,
            clearValue,
            getValue: () => hidden.value,
            setDisabled(disabled) {
                input.disabled = !!disabled;
                if (disabled) closeList();
            },
            setLoading(text) {
                items = [];
                hidden.value = '';
                input.value = '';
                input.placeholder = text || 'Memuat...';
                closeList();
            },
        };
    }

    function initOnboardingCombos() {
        if (!onboardPlCombo) {
            onboardPlCombo = createSearchableSelect({
                inputId: 'onboard-pl-input',
                listId: 'onboard-pl-list',
                hiddenId: 'onboard-pl-value',
                placeholder: 'Ketik untuk cari Product Line...',
                emptyText: 'Product line tidak ditemukan',
                onChange: (plId) => onOnboardPlChange(plId),
            });
        }
        if (!onboardPersonnelCombo) {
            onboardPersonnelCombo = createSearchableSelect({
                inputId: 'onboard-personnel-input',
                listId: 'onboard-personnel-list',
                hiddenId: 'onboard-personnel-value',
                placeholder: 'Ketik untuk cari nama personnel...',
                emptyText: 'Nama tidak ditemukan',
                onChange: () => onOnboardPersonnelChange(),
            });
        }
    }

    function personnelDisplayName(session) {
        const name = session?.personnel_name || session?.name || session?.email || 'User';
        const short = name.split(',')[0].trim() || name;
        return {
            full: name,
            short: short.length > 20 ? `${short.slice(0, 18)}…` : short,
        };
    }

    function personnelInitials(name) {
        const parts = (name || 'U').split(/[\s,]+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return (name || 'U').substring(0, 3).toUpperCase();
    }

    function profilePhotoSrc(session) {
        if (!session) return '';
        if (session.profile_photo_file_id) {
            return `${apiBase()}/matrix/profile-photo/view/${encodeURIComponent(session.profile_photo_file_id)}`;
        }
        return session.picture || '';
    }

    function applyAvatarToElements(session, imgEl, initialsEl, fallbackEl) {
        const names = personnelDisplayName(session);
        const initials = personnelInitials(names.full);
        const src = profilePhotoSrc(session);
        if (imgEl) {
            if (src) {
                imgEl.src = src;
                imgEl.alt = names.full;
                imgEl.style.display = 'block';
                imgEl.onload = () => {
                    if (initialsEl) initialsEl.style.display = 'none';
                    if (fallbackEl) fallbackEl.style.display = 'none';
                };
                imgEl.onerror = () => {
                    imgEl.style.display = 'none';
                    if (initialsEl) {
                        initialsEl.textContent = initials;
                        initialsEl.style.display = 'flex';
                    }
                    if (fallbackEl) {
                        fallbackEl.textContent = initials;
                        fallbackEl.style.display = 'flex';
                    }
                };
            } else {
                imgEl.style.display = 'none';
                imgEl.removeAttribute('src');
            }
        }
        if (initialsEl) {
            initialsEl.textContent = initials;
            initialsEl.style.display = src ? 'none' : 'flex';
        }
        if (fallbackEl) {
            fallbackEl.textContent = initials;
            fallbackEl.style.display = src ? 'none' : 'flex';
        }
    }

    function updateHeaderUser() {
        const menuBtn = document.getElementById('header-user-menu');
        if (!menuBtn) return;

        const isPreview = new URLSearchParams(window.location.search).get('mode') === 'preview';
        const locked = document.body.classList.contains('auth-locked');
        if (locked || isPreview || !authSession) {
            menuBtn.style.display = 'none';
            closeHeaderUserMenu();
            return;
        }

        menuBtn.style.display = 'flex';
        bindHeaderUserMenu();
        const names = personnelDisplayName(authSession);
        const nameEl = document.getElementById('header-user-name');
        if (nameEl) {
            nameEl.textContent = names.short;
            nameEl.title = names.full;
        }

        applyAvatarToElements(
            authSession,
            document.getElementById('header-user-avatar-img'),
            document.getElementById('header-user-avatar-initials'),
            null
        );

        const ddName = document.getElementById('header-dd-name');
        const ddEmail = document.getElementById('header-dd-email');
        const ddPl = document.getElementById('header-dd-pl');
        const ddLoginText = document.getElementById('header-dd-login-text');
        if (ddName) ddName.textContent = names.full;
        if (ddEmail) ddEmail.textContent = authSession.email || '—';
        if (ddPl) {
            ddPl.textContent = authSession.product_line_name
                ? `Product Line: ${authSession.product_line_name}`
                : 'Belum memilih Product Line';
        }
        if (ddLoginText) {
            ddLoginText.textContent = authSession.email
                ? `Masuk sebagai ${authSession.email}`
                : 'Masuk dengan Google';
        }

        applyAvatarToElements(
            authSession,
            document.getElementById('header-dd-photo'),
            null,
            document.getElementById('header-dd-photo-fallback'),
        );

        const isAdmin = document.body.classList.contains('admin-mode');
        const adminLogin = document.getElementById('header-dd-admin-login');
        const adminActive = document.getElementById('header-dd-admin-active');
        if (adminLogin) adminLogin.style.display = isAdmin ? 'none' : 'flex';
        if (adminActive) adminActive.style.display = isAdmin ? 'flex' : 'none';
    }

    function showHeaderMenuPanel() {
        const menuView = document.getElementById('header-user-view-menu');
        const settingsView = document.getElementById('header-user-view-settings');
        if (menuView) menuView.style.display = 'block';
        if (settingsView) settingsView.style.display = 'none';
    }

    function showHeaderSettingsPanel() {
        const menuView = document.getElementById('header-user-view-menu');
        const settingsView = document.getElementById('header-user-view-settings');
        if (menuView) menuView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'block';
        if (typeof updateSettingsUI === 'function') updateSettingsUI();
        openHeaderUserMenu(false);
    }

    function openHeaderUserMenu(resetPanel) {
        if (resetPanel !== false) showHeaderMenuPanel();
        const menuBtn = document.getElementById('header-user-menu');
        const dropdown = document.getElementById('header-user-dropdown');
        const backdrop = document.getElementById('header-user-backdrop');
        if (!dropdown) return;
        dropdown.classList.add('active');
        backdrop?.classList.add('active');
        menuBtn?.classList.add('open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    }

    function closeHeaderUserMenu() {
        document.getElementById('header-user-menu')?.classList.remove('open');
        document.getElementById('header-user-dropdown')?.classList.remove('active');
        document.getElementById('header-user-backdrop')?.classList.remove('active');
        const btn = document.getElementById('header-user-menu');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        showHeaderMenuPanel();
    }

    function toggleHeaderUserMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const dropdown = document.getElementById('header-user-dropdown');
        if (!dropdown) return;
        if (dropdown.classList.contains('active')) {
            closeHeaderUserMenu();
        } else {
            openHeaderUserMenu(true);
        }
    }

    function bindHeaderUserMenu() {
        const btn = document.getElementById('header-user-menu');
        if (!btn || btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleHeaderUserMenu(e);
        });

        document.getElementById('header-user-backdrop')?.addEventListener('click', closeHeaderUserMenu);
        document.getElementById('header-dd-open-settings')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showHeaderSettingsPanel();
        });
        document.getElementById('header-dd-settings-back')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showHeaderMenuPanel();
        });
        document.getElementById('header-dd-admin-login')?.addEventListener('click', (e) => {
            e.stopPropagation();
            closeHeaderUserMenu();
            if (typeof showAdminLoginModal === 'function') showAdminLoginModal();
        });
        const openLogout = () => openLogoutConfirmModal();
        document.getElementById('header-dd-logout')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openLogout();
        });
        document.getElementById('header-dd-logout-settings')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openLogout();
        });
        document.getElementById('logout-confirm-close')?.addEventListener('click', closeLogoutConfirmModal);
        document.getElementById('logout-confirm-cancel')?.addEventListener('click', closeLogoutConfirmModal);
        document.getElementById('logout-confirm-yes')?.addEventListener('click', executePersonnelSignOut);
    }

    function openLogoutConfirmModal() {
        closeHeaderUserMenu();
        document.getElementById('logout-confirm-modal')?.classList.add('active');
    }

    function closeLogoutConfirmModal() {
        document.getElementById('logout-confirm-modal')?.classList.remove('active');
    }

    function executePersonnelSignOut() {
        closeLogoutConfirmModal();
        personnelSignOut();
    }

    function updateMatrixAccessClass() {
        const pl = (authSession?.access_to_pl || '').toLowerCase() === 'yes';
        const po = (authSession?.access_personnel_only || '').toLowerCase() === 'yes';
        const allow = !!(authSession?.onboarded && (authSession?.is_admin || pl || po));
        document.body.classList.toggle('matrix-access', allow);
    }

    function showLogin() {
        document.body.classList.add('auth-locked');
        document.getElementById('csms-login-screen')?.classList.add('active');
        document.getElementById('csms-onboarding-screen')?.classList.remove('active');
        document.body.classList.remove('personnel-authenticated');
        document.body.classList.remove('matrix-access');
    }

    function showOnboarding() {
        document.body.classList.add('auth-locked');
        document.getElementById('csms-login-screen')?.classList.remove('active');
        document.getElementById('csms-onboarding-screen')?.classList.add('active');
        initOnboardingCombos();
        loadOnboardingProductLines();
    }

    function showApp() {
        document.body.classList.remove('auth-locked');
        document.getElementById('csms-login-screen')?.classList.remove('active');
        document.getElementById('csms-onboarding-screen')?.classList.remove('active');
        document.body.classList.add('personnel-authenticated');
        updateMatrixAccessClass();
        updateHeaderUser();
        const logoutBtn = document.getElementById('personnel-logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'flex';
        updateMatrixAccessClass();
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

    function isNativeAppShell() {
        return !!(window.ReactNativeWebView || (window.AndroidInterface && window.AndroidInterface.googleSignIn));
    }

    function useGoogleRedirectFlow() {
        return isNativeAppShell() || /Android/i.test(navigator.userAgent);
    }

    async function completeLoginFromServerResult(data) {
        setToken(data.token);
        setSession(data.session);
        if (data.needs_onboarding) showOnboarding();
        else showApp();
        if (typeof showToast === 'function') showToast('Login berhasil', 'success');
    }

    async function handleGoogleCredential(response) {
        const errEl = document.getElementById('csms-login-error');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        const idToken = response?.credential || response?.id_token || response;
        if (!idToken || typeof idToken !== 'string') {
            if (errEl) {
                errEl.textContent = 'Token Google tidak valid';
                errEl.style.display = 'block';
            }
            return;
        }
        try {
            const res = await authFetch('/auth/google', {
                method: 'POST',
                body: JSON.stringify({ id_token: idToken }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || 'Login gagal');
            await completeLoginFromServerResult(data);
        } catch (e) {
            if (errEl) {
                errEl.textContent = e.message || 'Login gagal';
                errEl.style.display = 'block';
            }
        }
    }

    function startGoogleOAuthRedirect() {
        const errEl = document.getElementById('csms-login-error');
        if (errEl) errEl.style.display = 'none';
        setToken('');
        setSession(null);
        window.location.assign(`${apiBase()}/auth/google/start`);
    }

    function renderGoogleRedirectButton() {
        const container = document.getElementById('csms-google-btn-wrap');
        if (!container) return;
        container.innerHTML = `
            <button type="button" class="csms-google-redirect-btn" id="csms-google-redirect-btn">
                <span class="csms-google-redirect-icon" aria-hidden="true">G</span>
                <span>Masuk dengan Google</span>
            </button>
            <p class="csms-auth-hint">Login di jendela aplikasi (cocok untuk Android).</p>
        `;
        document.getElementById('csms-google-redirect-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            startGoogleOAuthRedirect();
        });
    }

    function renderNativeGoogleButton() {
        const container = document.getElementById('csms-google-btn-wrap');
        if (!container) return;
        container.innerHTML = `
            <button type="button" class="csms-google-redirect-btn" id="csms-native-google-btn">
                <span class="csms-google-redirect-icon" aria-hidden="true">G</span>
                <span>Masuk dengan Google</span>
            </button>
            <button type="button" class="csms-google-redirect-link" id="csms-google-redirect-fallback">
                Atau masuk via browser aplikasi
            </button>
        `;
        document.getElementById('csms-native-google-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'googleSignIn',
                    clientId: googleClientId,
                }));
            } else if (window.AndroidInterface?.googleSignIn) {
                window.AndroidInterface.googleSignIn(googleClientId);
            } else {
                startGoogleOAuthRedirect();
            }
        });
        document.getElementById('csms-google-redirect-fallback')?.addEventListener('click', (e) => {
            e.preventDefault();
            startGoogleOAuthRedirect();
        });
    }

    function initGoogleButton() {
        const container = document.getElementById('csms-google-btn-wrap');
        if (!container) return;

        if (isNativeAppShell()) {
            renderNativeGoogleButton();
            return;
        }
        if (useGoogleRedirectFlow()) {
            renderGoogleRedirectButton();
            return;
        }

        if (!googleClientId || !window.google?.accounts?.id) return;
        google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredential,
            auto_select: true,
            itp_support: true,
        });
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: Math.min(360, Math.max(280, container.clientWidth || 320)),
        });
        google.accounts.id.prompt();
    }

    function readAuthUrlParams() {
        if (window.location.hash && window.location.hash.length > 1) {
            return new URLSearchParams(window.location.hash.slice(1));
        }
        return new URLSearchParams(window.location.search);
    }

    function consumeAuthFromUrl() {
        const params = readAuthUrlParams();
        const err = params.get('auth_error');
        const errEl = document.getElementById('csms-login-error');
        if (err) {
            if (errEl) {
                errEl.textContent = decodeURIComponent(err.replace(/\+/g, ' '));
                errEl.style.display = 'block';
            }
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            return false;
        }

        const token = params.get('csms_token');
        if (!token) return false;

        setToken(token);
        const needsOnboarding = params.get('needs_onboarding') === '1';
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

        (async () => {
            try {
                const res = await authFetch('/auth/me');
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (isAuthHttpFailure(res.status, data.detail)) throw new Error(data.detail || 'Login gagal');
                    if (typeof showToast === 'function') showToast('Koneksi lemah — sesi disimpan di perangkat', 'warning');
                    return;
                }
                setSession(data.session);
                if (needsOnboarding || data.needs_onboarding) showOnboarding();
                else showApp();
                if (typeof showToast === 'function') showToast('Login berhasil', 'success');
            } catch (e) {
                if (isAuthHttpFailure(401, e.message)) {
                    setToken('');
                    setSession(null);
                    showLogin();
                }
                if (errEl) {
                    errEl.textContent = e.message || 'Login gagal';
                    errEl.style.display = 'block';
                }
            }
        })();
        return true;
    }

    function handleNativeAuthMessage(data) {
        if (!data || typeof data !== 'object') return;
        if (data.type === 'googleAuthSuccess' || data.type === 'googleIdToken') {
            const token = data.idToken || data.id_token || data.credential || data.token;
            if (token) handleGoogleCredential({ credential: token });
        }
    }

    async function validateExistingSession(silent) {
        const token = getToken();
        if (!token) {
            showLogin();
            return;
        }
        if (!silent) restoreUIFromCachedSession();
        try {
            const res = await authFetch('/auth/me');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (isAuthHttpFailure(res.status, data.detail)) {
                    throw new Error(data.detail || 'Session expired');
                }
                if (!silent && typeof showToast === 'function') {
                    showToast('Offline — menggunakan sesi tersimpan', 'warning');
                }
                return;
            }
            setToken(token);
            setSession(data.session);
            if (data.needs_onboarding) showOnboarding();
            else showApp();
            lastSessionRefresh = Date.now();
        } catch (e) {
            if (isAuthHttpFailure(401, e.message)) {
                setToken('');
                setSession(null);
                showLogin();
                const errEl = document.getElementById('csms-login-error');
                if (errEl && !silent) {
                    errEl.textContent = e.message || 'Sesi tidak valid. Silakan login ulang.';
                    errEl.style.display = 'block';
                }
            } else if (!silent && restoreUIFromCachedSession() && typeof showToast === 'function') {
                showToast('Tidak dapat memverifikasi sesi — mode offline', 'warning');
            }
        }
    }

    function refreshSessionOnResume() {
        if (!getToken() || document.body.classList.contains('auth-locked')) return;
        const now = Date.now();
        if (now - lastSessionRefresh < 45000) return;
        validateExistingSession(true);
    }

    async function loadOnboardingProductLines() {
        initOnboardingCombos();
        if (!onboardPlCombo) return;
        onboardPlCombo.setLoading('Memuat product line...');
        onboardPersonnelCombo?.setDisabled(true);
        onboardPersonnelCombo?.clearValue('Pilih Product Line dulu');
        const preview = document.getElementById('onboard-personnel-preview');
        if (preview) preview.textContent = '';
        try {
            const res = await authFetch('/auth/onboarding/product-lines');
            const lines = await res.json();
            if (!res.ok) throw new Error(lines.detail || 'Gagal memuat product line');
            onboardPlCombo.setItems(lines.map(pl => ({
                id: pl.id,
                label: `${pl.name} (${pl.employee_count})`,
            })));
            document.getElementById('onboard-pl-input').placeholder = 'Ketik untuk cari Product Line...';
        } catch (e) {
            onboardPlCombo.setItems([]);
            if (typeof showToast === 'function') showToast(e.message, 'error');
        }
    }

    async function onOnboardPlChange(plIdArg) {
        initOnboardingCombos();
        const plId = plIdArg || onboardPlCombo?.getValue() || '';
        const preview = document.getElementById('onboard-personnel-preview');
        if (!onboardPersonnelCombo) return;
        if (!plId) {
            onboardPersonnelCombo.setDisabled(true);
            onboardPersonnelCombo.clearValue('Pilih Product Line dulu');
            if (preview) preview.textContent = '';
            return;
        }
        onboardPersonnelCombo.setDisabled(false);
        onboardPersonnelCombo.setLoading('Memuat nama...');
        if (preview) preview.textContent = '';
        try {
            const res = await authFetch(`/auth/onboarding/personnel?product_line_id=${encodeURIComponent(plId)}`);
            const rows = await res.json();
            if (!res.ok) throw new Error(rows.detail || 'Gagal memuat personnel');
            onboardPersonnelRows = rows;
            onboardPersonnelCombo.setItems(rows.map(r => {
                const pos = r.job_family_description || r.job_description || '';
                return {
                    id: r.id,
                    label: `${r.name}${pos ? ' — ' + pos : ''}`,
                    meta: { jfd: pos },
                };
            }));
            document.getElementById('onboard-personnel-input').placeholder = 'Ketik untuk cari nama personnel...';
        } catch (e) {
            onboardPersonnelCombo.setItems([]);
            if (typeof showToast === 'function') showToast(e.message, 'error');
        }
    }

    function onOnboardPersonnelChange() {
        const preview = document.getElementById('onboard-personnel-preview');
        if (!preview || !onboardPersonnelCombo) return;
        const empId = onboardPersonnelCombo.getValue();
        if (!empId) {
            preview.textContent = '';
            return;
        }
        const row = onboardPersonnelRows.find(r => String(r.id) === String(empId));
        const pos = row?.job_family_description || row?.job_description || '';
        preview.textContent = pos ? `Posisi: ${pos}` : '';
    }

    async function submitOnboarding(e) {
        e.preventDefault();
        const plId = parseInt(onboardPlCombo?.getValue() || document.getElementById('onboard-pl-value')?.value, 10);
        const empId = parseInt(onboardPersonnelCombo?.getValue() || document.getElementById('onboard-personnel-value')?.value, 10);
        const errEl = document.getElementById('onboard-error');
        const submitBtn = document.querySelector('.csms-onboard-submit');
        if (errEl) errEl.style.display = 'none';
        if (!plId || !empId) {
            if (errEl) { errEl.textContent = 'Pilih Product Line dan Personnel Name'; errEl.style.display = 'block'; }
            return;
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Memproses...';
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
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Konfirmasi & Masuk ke Aplikasi';
            }
        }
    }

    function personnelSignOut() {
        closeHeaderUserMenu();
        closeLogoutConfirmModal();
        setToken('');
        setSession(null);
        if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
        document.body.classList.remove('admin-mode');
        localStorage.removeItem('csms_admin_logged_in');
        const logoutBtn = document.getElementById('personnel-logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'none';
        updateHeaderUser();
        showLogin();
        if (typeof showToast === 'function') showToast('Anda telah keluar', 'success');
    }

    async function initAuthFlow() {
        bindHeaderUserMenu();
        window.handleNativeGoogleCredential = (idToken) => handleGoogleCredential({ credential: idToken });

        const isPreview = new URLSearchParams(window.location.search).get('mode') === 'preview';
        if (isPreview) {
            document.body.classList.remove('auth-locked');
            return;
        }

        if (consumeAuthFromUrl()) return;

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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeHeaderUserMenu();
            closeLogoutConfirmModal();
        }
    });

    window.addEventListener('message', (event) => {
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            handleNativeAuthMessage(data);
        } catch (e) { /* ignore */ }
    });
    document.addEventListener('message', (event) => {
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            handleNativeAuthMessage(data);
        } catch (e) { /* ignore */ }
    });

    window.addEventListener('pageshow', (event) => {
        if (getToken()) refreshSessionOnResume();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshSessionOnResume();
    });

    window.initAuthFlow = initAuthFlow;
    window.handleGoogleCredential = handleGoogleCredential;
    window.startGoogleOAuthRedirect = startGoogleOAuthRedirect;
    window.personnelSignOut = personnelSignOut;
    window.updateHeaderUser = updateHeaderUser;
    window.toggleHeaderUserMenu = toggleHeaderUserMenu;
    window.openHeaderUserMenu = openHeaderUserMenu;
    window.closeHeaderUserMenu = closeHeaderUserMenu;
    window.showHeaderMenuPanel = showHeaderMenuPanel;
    window.showHeaderSettingsPanel = showHeaderSettingsPanel;
    window.openLogoutConfirmModal = openLogoutConfirmModal;
    window.closeLogoutConfirmModal = closeLogoutConfirmModal;
    window.executePersonnelSignOut = executePersonnelSignOut;
    window.onOnboardPlChange = onOnboardPlChange;
    window.onOnboardPersonnelChange = onOnboardPersonnelChange;
    window.submitOnboarding = submitOnboarding;
    window.getCsmsAuthToken = getToken;
    window.getCsmsAuthSession = () => authSession;
})();
