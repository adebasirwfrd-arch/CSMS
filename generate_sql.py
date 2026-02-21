import json
import uuid

# Hardcoded lists from earlier script
lagging = [
    {"category": "Lagging", "name": "Jangka waktu Pekerjaan", "target": "11 Hari/Sumur", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Jumlah  Pekerja", "target": "2", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Jam kerja selamat", "target": "Actual", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "KM driven", "target": "Actual", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Number of Accidents (NoA) 1.\tFatality  2.\tProperty damage Kerugian> USD 1 Juta 3.\tTumpahan Minyak > 15 Bbls", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "TRIR", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Lost Time Incident (LTI)", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Restricted Work Case (RWC)", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Medical Treatment Case (MTC)", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "First Aid Case (FAC)", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Near miss", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Property damage loss < USD 1 Juta", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Property damage loss > USD 1 Juta", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Tumpahan minyak ≥1 - <15 bbls", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Gangguan Keamanan", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Motor Vehicle Accident Case (MVAC)", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"},
    {"category": "Lagging", "name": "Illness Medivac", "target": "0", "actual": "0", "icon": "📊", "intent": "negative"}
]
leading = [
    {"category": "Leading", "name": "MWT", "target": "4", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "HSSE Committee Meeting dipimpin oleh pimpinan perusahaan", "target": "4", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Sosialisasi Kebijakan HSSE", "target": "1", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Pre job HSSE meeting", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "HSE Meeting", "target": "1", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Pengamatan keselamatan (PEKA)", "target": "22", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "RADAR", "target": "48", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Pelaporan Kinerja HSSE", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Medical Check-up", "target": "8", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Fit To Task", "target": "11", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "HSSE Induction", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Pelatihan HSSE (minimal Basic HSSE Training)", "target": "2", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Emergency drill :  -Fire Drill -Muster Point Drill -Medevac Drill (MERP Lv 1 & 2) -Medevac Drill (MERP Lv III) - Kick Drill", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Inspeksi HSE", "target": "0", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "A.\u00a0\u00a0\u00a0\u00a0 Housekeeping", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "B.\u00a0\u00a0\u00a0\u00a0 fire extinguisher", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "C.\u00a0\u00a0\u00a0\u00a0 APD Umum dan Khusu", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "D.\u00a0\u00a0\u00a0\u00a0 Peralatan Kerja", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "F.\u00a0\u00a0\u00a0\u00a0 Kendaraan", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Pemeriksaan kualitas lingkungan kerja a.\tKebisingan b.\tPencahayaan c.\tTemperatur", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Promosi HSSE: a.\tCLSR (Corporate Live Saving Rules) b.\tSI TEPAT (HFIF, Safe Zone Position, KARIB)  c.\tHSSE Marshall d.\tIllness Fatality Prevention Programs e. Hand and Finger Safety", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Audit Internal/Eksternal HSSE", "target": "1", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Desinfeksi Area Kerja", "target": "0", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Laporan hasil verifikasi MCU & f/u MCU kategori (P4-P7)", "target": "12", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Sosialisasi HSE Plan ke seluruh personel yang dikirim kelokasi sumur Pemboran", "target": "1", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Memastikan SKCK, MCU, dan BST Seluruh personnel aktif & Valid (Tidak melakukan pemalsuan dokumen). Tidak melakukan unsafe action dengan sengaja", "target": "1", "actual": "0", "icon": "📊", "intent": "positive"},
    {"category": "Leading", "name": "Melakukan Assesement safety Behaviour & Technical Competency (BST) Internal Perusahaan", "target": "1", "actual": "0", "icon": "📊", "intent": "positive"}
]

sql_str = """-- SUPABASE SQL EDITOR SCRIPT
-- RUN THIS TO RECREATE THE LL INDICATOR TABLE AND SEED DEFAULT DATA
-- REPLACE 'YOUR_PROJECT_ID' WITH THE ACTUAL PROJECT ID String FROM THE UI.

-- 1. Drop the existing table (Warning: this deletes all existing LL indicator data)
DROP TABLE IF EXISTS public.ll_indicators;

-- 2. Create the new table schema
CREATE TABLE public.ll_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Lagging', 'Leading')),
    name TEXT NOT NULL,
    target TEXT DEFAULT '0',
    actual TEXT DEFAULT '0',
    icon TEXT DEFAULT '📊',
    intent TEXT DEFAULT 'positive',
    year INTEGER NOT NULL,
    month INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Seed Initial Data
-- NOTE: Please substitute 'PROJECT_ID_STRING' below with the actual project you're monitoring.
-- The UI will still auto-generate these rows on an empty project when opened, but this inserts a batch immediately.

"""

def escape_sql(s):
    return s.replace("'", "''")

for item in lagging + leading:
    cat = item["category"]
    name = escape_sql(item["name"])
    target = escape_sql(str(item.get("target", "0")))
    actual = "0"
    icon = item.get("icon", "📊")
    intent = item.get("intent", "negative")
    
    # Defaults year to 2025 and month to 1. Replace with whatever context needed.
    # We substitute PEPZ7_AMJ-4T_MPD since that's what was in the user's screenshot.
    sql_str += f"INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', '{cat}', '{name}', '{target}', '{actual}', '{icon}', '{intent}', 2025, 3);\n"

sql_str += """
-- 4. Enable RLS (Optional, depending on your setup)
ALTER TABLE public.ll_indicators ENABLE ROW LEVEL SECURITY;
"""

with open("recreate_ll_indicators_seeded.sql", "w") as f:
    f.write(sql_str)
print("done")
