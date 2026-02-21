-- SUPABASE SQL EDITOR SCRIPT
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
-- NOTE: Please substitute 'PEPZ7_AMJ-4T_MPD' below with the actual project you're monitoring.

-- LAGGING INDICATORS
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Jangka waktu Pekerjaan', '11 Hari/Sumur', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Jumlah  Pekerja', '2', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Jam kerja selamat', 'Actual', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'KM driven', 'Actual', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Number of Accidents (NoA) 1.	Fatality  2.	Property damage Kerugian> USD 1 Juta 3.	Tumpahan Minyak > 15 Bbls', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'TRIR', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Lost Time Incident (LTI)', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Restricted Work Case (RWC)', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Medical Treatment Case (MTC)', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'First Aid Case (FAC)', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Near miss', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Property damage loss < USD 1 Juta', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Property damage loss > USD 1 Juta', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Tumpahan minyak ≥1 - <15 bbls', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Gangguan Keamanan', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Motor Vehicle Accident Case (MVAC)', '0', '0', '📊', 'negative', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Lagging', 'Illness Medivac', '0', '0', '📊', 'negative', 2025, 3);

-- LEADING INDICATORS
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'MWT', '4', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'HSSE Committee Meeting dipimpin oleh pimpinan perusahaan', '4', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Sosialisasi Kebijakan HSSE', '1', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Pre job HSSE meeting', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'HSE Meeting', '1', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Pengamatan keselamatan (PEKA)', '22', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'RADAR', '48', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Pelaporan Kinerja HSSE', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Medical Check-up', '8', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Fit To Task', '11', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'HSSE Induction', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Pelatihan HSSE (minimal Basic HSSE Training)', '2', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Emergency drill :  -Fire Drill -Muster Point Drill -Medevac Drill (MERP Lv 1 & 2) -Medevac Drill (MERP Lv III) - Kick Drill', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Inspeksi HSE', '0', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'A.	 Housekeeping', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'B.	 fire extinguisher', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'C.	 APD Umum dan Khusu', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'D.	 Peralatan Kerja', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'F.	 Kendaraan', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Pemeriksaan kualitas lingkungan kerja a.	Kebisingan b.	Pencahayaan c.	Temperatur', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Promosi HSSE: a.	CLSR (Corporate Live Saving Rules) b.	SI TEPAT (HFIF, Safe Zone Position, KARIB)  c.	HSSE Marshall d.	Illness Fatality Prevention Programs e. Hand and Finger Safety', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Audit Internal/Eksternal HSSE', '1', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Desinfeksi Area Kerja', '0', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Laporan hasil verifikasi MCU & f/u MCU kategori (P4-P7)', '12', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Sosialisasi HSE Plan ke seluruh personel yang dikirim kelokasi sumur Pemboran', '1', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Memastikan SKCK, MCU, dan BST Seluruh personnel aktif & Valid (Tidak melakukan pemalsuan dokumen). Tidak melakukan unsafe action dengan sengaja', '1', '0', '📊', 'positive', 2025, 3);
INSERT INTO public.ll_indicators (project_id, category, name, target, actual, icon, intent, year, month) VALUES ('PEPZ7_AMJ-4T_MPD', 'Leading', 'Melakukan Assesement safety Behaviour & Technical Competency (BST) Internal Perusahaan', '1', '0', '📊', 'positive', 2025, 3);


-- 4. Enable RLS (Optional, depending on your setup)
ALTER TABLE public.ll_indicators ENABLE ROW LEVEL SECURITY;
