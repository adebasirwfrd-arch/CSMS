-- =============================================
-- Cleanup: Remove duplicate LL indicators
-- Keep only one row per (project_id, category, name, year, month)
-- =============================================

-- 1. Delete duplicates, keeping the row with the HIGHEST sort_order (the corrected one)
DELETE FROM public.ll_indicators
WHERE id NOT IN (
    SELECT DISTINCT ON (project_id, category, name, year, month) id
    FROM public.ll_indicators
    ORDER BY project_id, category, name, year, month, sort_order DESC NULLS LAST
);

-- 2. Verify: should show 44 rows (17 lagging + 27 leading) per project/month
SELECT category, count(*) as count 
FROM public.ll_indicators 
GROUP BY category 
ORDER BY category;

-- 3. Verify sort order is correct
SELECT category, sort_order, name 
FROM public.ll_indicators 
WHERE month = 3
ORDER BY category DESC, sort_order ASC;
