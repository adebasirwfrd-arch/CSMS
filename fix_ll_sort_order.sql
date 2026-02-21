-- =============================================
-- Fix LL Indicators: Add sort_order column
-- =============================================

-- 1. Add sort_order column
ALTER TABLE public.ll_indicators ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 2. Set sort_order for LAGGING indicators (Excel rows B4-B20)
UPDATE public.ll_indicators SET sort_order = 1 WHERE category = 'Lagging' AND name LIKE 'Jangka waktu Pekerjaan%';
UPDATE public.ll_indicators SET sort_order = 2 WHERE category = 'Lagging' AND name LIKE 'Jumlah%Pekerja%';
UPDATE public.ll_indicators SET sort_order = 3 WHERE category = 'Lagging' AND name LIKE 'Jam kerja selamat%';
UPDATE public.ll_indicators SET sort_order = 4 WHERE category = 'Lagging' AND name LIKE 'KM driven%';
UPDATE public.ll_indicators SET sort_order = 5 WHERE category = 'Lagging' AND name LIKE 'Number of Accidents%';
UPDATE public.ll_indicators SET sort_order = 6 WHERE category = 'Lagging' AND name = 'TRIR';
UPDATE public.ll_indicators SET sort_order = 7 WHERE category = 'Lagging' AND name LIKE 'Lost Time Incident%';
UPDATE public.ll_indicators SET sort_order = 8 WHERE category = 'Lagging' AND name LIKE 'Restricted Work Case%';
UPDATE public.ll_indicators SET sort_order = 9 WHERE category = 'Lagging' AND name LIKE 'Medical Treatment Case%';
UPDATE public.ll_indicators SET sort_order = 10 WHERE category = 'Lagging' AND name LIKE 'First Aid Case%';
UPDATE public.ll_indicators SET sort_order = 11 WHERE category = 'Lagging' AND name = 'Near miss';
UPDATE public.ll_indicators SET sort_order = 12 WHERE category = 'Lagging' AND name LIKE 'Property damage loss < USD%';
UPDATE public.ll_indicators SET sort_order = 13 WHERE category = 'Lagging' AND name LIKE 'Property damage loss > USD%';
UPDATE public.ll_indicators SET sort_order = 14 WHERE category = 'Lagging' AND name LIKE 'Tumpahan minyak%';
UPDATE public.ll_indicators SET sort_order = 15 WHERE category = 'Lagging' AND name LIKE 'Gangguan Keamanan%';
UPDATE public.ll_indicators SET sort_order = 16 WHERE category = 'Lagging' AND name LIKE 'Motor Vehicle Accident%';
UPDATE public.ll_indicators SET sort_order = 17 WHERE category = 'Lagging' AND name LIKE 'Illness Medivac%';

-- 3. Set sort_order for LEADING indicators (Excel rows B25-B51)
UPDATE public.ll_indicators SET sort_order = 1 WHERE category = 'Leading' AND name = 'MWT';
UPDATE public.ll_indicators SET sort_order = 2 WHERE category = 'Leading' AND name LIKE 'HSSE Committee Meeting%';
UPDATE public.ll_indicators SET sort_order = 3 WHERE category = 'Leading' AND name LIKE 'Sosialisasi Kebijakan HSSE%';
UPDATE public.ll_indicators SET sort_order = 4 WHERE category = 'Leading' AND name LIKE 'Pre job HSSE meeting%';
UPDATE public.ll_indicators SET sort_order = 5 WHERE category = 'Leading' AND name = 'HSE Meeting';
UPDATE public.ll_indicators SET sort_order = 6 WHERE category = 'Leading' AND name LIKE 'Pengamatan keselamatan%';
UPDATE public.ll_indicators SET sort_order = 7 WHERE category = 'Leading' AND name = 'RADAR';
UPDATE public.ll_indicators SET sort_order = 8 WHERE category = 'Leading' AND name LIKE 'Pelaporan Kinerja HSSE%';
UPDATE public.ll_indicators SET sort_order = 9 WHERE category = 'Leading' AND name = 'Medical Check-up';
UPDATE public.ll_indicators SET sort_order = 10 WHERE category = 'Leading' AND name = 'Fit To Task';
UPDATE public.ll_indicators SET sort_order = 11 WHERE category = 'Leading' AND name = 'HSSE Induction';
UPDATE public.ll_indicators SET sort_order = 12 WHERE category = 'Leading' AND name LIKE 'Pelatihan HSSE%';
UPDATE public.ll_indicators SET sort_order = 13 WHERE category = 'Leading' AND name LIKE 'Emergency drill%';
UPDATE public.ll_indicators SET sort_order = 14 WHERE category = 'Leading' AND name = 'Inspeksi HSE';
UPDATE public.ll_indicators SET sort_order = 15 WHERE category = 'Leading' AND name LIKE 'A.%Housekeeping%';
UPDATE public.ll_indicators SET sort_order = 16 WHERE category = 'Leading' AND name LIKE 'B.%fire extinguisher%';
UPDATE public.ll_indicators SET sort_order = 17 WHERE category = 'Leading' AND name LIKE 'C.%APD Umum%';
UPDATE public.ll_indicators SET sort_order = 18 WHERE category = 'Leading' AND name LIKE 'D.%Peralatan Kerja%';
UPDATE public.ll_indicators SET sort_order = 19 WHERE category = 'Leading' AND name LIKE 'F.%Kendaraan%';
UPDATE public.ll_indicators SET sort_order = 20 WHERE category = 'Leading' AND name LIKE 'Pemeriksaan kualitas lingkungan%';
UPDATE public.ll_indicators SET sort_order = 21 WHERE category = 'Leading' AND name LIKE 'Promosi HSSE%';
UPDATE public.ll_indicators SET sort_order = 22 WHERE category = 'Leading' AND name LIKE 'Audit Internal/Eksternal%';
UPDATE public.ll_indicators SET sort_order = 23 WHERE category = 'Leading' AND name LIKE 'Desinfeksi Area Kerja%';
UPDATE public.ll_indicators SET sort_order = 24 WHERE category = 'Leading' AND name LIKE 'Laporan hasil verifikasi MCU%';
UPDATE public.ll_indicators SET sort_order = 25 WHERE category = 'Leading' AND name LIKE 'Sosialisasi HSE Plan%';
UPDATE public.ll_indicators SET sort_order = 26 WHERE category = 'Leading' AND name LIKE 'Memastikan SKCK%';
UPDATE public.ll_indicators SET sort_order = 27 WHERE category = 'Leading' AND name LIKE 'Melakukan Assesement%';

-- 4. Verify the results
SELECT category, sort_order, name FROM public.ll_indicators ORDER BY category DESC, sort_order ASC;
