"""
Generate Google OAuth2 Token for CSMS
=====================================
Run this script locally to generate a new GOOGLE_TOKEN_JSON
that can be used in Vercel.

Usage:
1. Make sure you have google_credentials.json in the services folder
2. Run: python services/generate_oauth_token.py
3. Login with your Google account in the browser
4. Copy the generated token JSON to Vercel environment variables
"""

import os
import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']

def main():
    creds_path = Path(__file__).parent / "google_credentials.json"
    token_path = Path(__file__).parent / "google_token.json"
    
    if not creds_path.exists():
        print("ERROR: google_credentials.json not found in services folder!")
        print("Please download OAuth 2.0 credentials from Google Cloud Console:")
        print("1. Go to https://console.cloud.google.com/apis/credentials")
        print("2. Create OAuth 2.0 Client ID (Desktop app)")
        print("3. Download JSON and save as services/google_credentials.json")
        return
    
    print("Starting OAuth2 flow...")
    print("A browser window will open. Please login with your Google account.")
    
    flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
    creds = flow.run_local_server(port=0)
    
    # Save to file
    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes
    }
    
    with open(token_path, 'w') as f:
        json.dump(token_data, f, indent=2)
    
    print(f"\n✅ Token saved to: {token_path}")
    print("\n" + "="*60)
    print("COPY THE JSON BELOW TO VERCEL ENVIRONMENT VARIABLES")
    print("Variable name: GOOGLE_TOKEN_JSON")
    print("="*60)
    print(json.dumps(token_data))
    print("="*60)

if __name__ == "__main__":
    main()
