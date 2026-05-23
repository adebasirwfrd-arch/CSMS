# Google Sign-In Setup (CSMS)

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** → type **Web application**
3. **Authorized JavaScript origins:**
   - `http://localhost:8000`
   - `https://csms-gamma.vercel.app` (your production URL)
4. **Authorized redirect URIs:** not required for One Tap / button (GIS)
5. Copy the **Client ID**

## 2. Environment variables (Vercel / `.env`)

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CSMS_AUTH_SECRET=long-random-secret-for-jwt-signing
CSMS_ADMIN_EMAILS=your-admin@company.com,other@company.com
```

`GOOGLE_CLIENT_SECRET` disimpan di env untuk referensi / integrasi Drive; login personel memakai **Client ID** + token ID dari tombol Google.

`CSMS_ADMIN_EMAILS` — comma-separated Google emails that receive **Admin Mode** automatically after login.

## 3. Supabase

Run if not done yet:

- `create_product_line_employees_table.sql`
- `alter_product_line_employees_crud.sql`

## 4. Flow

1. User opens app → Google Sign-In screen
2. First time → pick **Product Line** + **Personnel Name** → email saved on Master row
3. **OPERATIONS MANAGEMENT** → ACCESS TO PL = Yes
4. Other positions → ACCESS PERSONNEL ONLY = Yes (admin can override on Master)
5. Session stored in `localStorage` (`csms_auth_token`) — persists on device until sign out or name removed from Master
6. Drawer → **Keluar** to sign out
