# Google Sign-In Setup (CSMS)

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** → type **Web application**
3. **Authorized JavaScript origins:**
   - `http://localhost:8000`
   - `https://csms-gamma.vercel.app` (your production URL)
4. **Authorized redirect URIs** (wajib untuk login Android — tanpa ini error `redirect_uri_mismatch`):
   - `https://csms-gamma.vercel.app/auth/google/callback`
   - `http://localhost:8000/auth/google/callback` (local dev)
   - Salin **persis** (https, tanpa slash di akhir path). Tunggu 1–5 menit setelah Save.
5. Copy **Client ID** and **Client Secret**

Pastikan OAuth client yang diedit adalah client yang sama dengan `GOOGLE_CLIENT_ID` di Vercel  
(contoh dari error: `382751875054-....apps.googleusercontent.com`).

Cek URI yang dipakai server: buka  
`https://csms-gamma.vercel.app/auth/google/redirect-uri`  
→ field `redirect_uri` harus **identik** dengan yang didaftarkan di Google Console.

## 2. Environment variables (Vercel / `.env`)

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CSMS_AUTH_SECRET=long-random-secret-for-jwt-signing
CSMS_PUBLIC_URL=https://csms-gamma.vercel.app
CSMS_ADMIN_EMAILS=your-admin@company.com,other@company.com
```

`CSMS_PUBLIC_URL` — canonical site URL for OAuth redirect (use your real Vercel domain).

`CSMS_ADMIN_EMAILS` — comma-separated Google emails that receive **Admin Mode** automatically after login.

## 3. Supabase

Run if not done yet:

- `create_product_line_employees_table.sql`
- `alter_product_line_employees_crud.sql`

## 4. Login flows

| Platform | Method |
|----------|--------|
| Desktop browser | Google Identity Services button (popup / One Tap) |
| **Android app (WebView)** | **Redirect** — tombol membuka `/auth/google/start` di WebView yang sama |
| React Native shell | `postMessage({ type: 'googleSignIn' })` atau redirect fallback |

### Android / WebView issue (fixed)

Tombol Google lama membuka **Chrome eksternal** → halaman blank → tidak kembali ke app.

**Solusi:** di Android, CSMS memakai **OAuth redirect** di WebView yang sama. Setelah login Google, server redirect ke `/?csms_token=...` dan app masuk otomatis.

### React Native (opsional, untuk APK)

Native app dapat menangani:

```json
{ "type": "googleSignIn", "clientId": "..." }
```

Lalu kirim balik ke WebView:

```json
{ "type": "googleAuthSuccess", "idToken": "..." }
```

atau panggil `window.handleNativeGoogleCredential(idToken)`.

## 5. Troubleshooting Android: `Error 400: redirect_uri_mismatch`

| Gejala | Penyebab |
|--------|----------|
| Google menolak login, detail `redirect_uri_mismatch` | URI callback belum didaftarkan di OAuth client yang benar |

**Langkah perbaikan:**

1. Buka [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Klik OAuth 2.0 Client ID yang sama dengan `GOOGLE_CLIENT_ID` di Vercel
3. Di **Authorized redirect URIs**, klik **+ ADD URI** dan paste:
   ```
   https://csms-gamma.vercel.app/auth/google/callback
   ```
4. Di **Authorized JavaScript origins**, pastikan ada:
   ```
   https://csms-gamma.vercel.app
   ```
5. **Save** → tunggu beberapa menit → coba login lagi di HP (clear cache app jika perlu)

Jika domain Vercel Anda berbeda, set `CSMS_PUBLIC_URL` di Vercel ke domain itu, redeploy, lalu daftarkan URI dari `/auth/google/redirect-uri`.

## 6. Personnel flow

1. User opens app → Google Sign-In screen
2. First time → pick **Product Line** + **Personnel Name** → email saved on Master row
3. **OPERATIONS MANAGEMENT** → ACCESS TO PL = Yes
4. Other positions → ACCESS PERSONNEL ONLY = Yes (admin can override on Master)
5. Session stored in `localStorage` (`csms_auth_token`) — persists on device until sign out or name removed from Master
6. Header profile menu → **Keluar** to sign out
