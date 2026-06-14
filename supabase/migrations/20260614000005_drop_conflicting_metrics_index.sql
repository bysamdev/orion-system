-- Migration to drop the conflicting index on machine_metrics
-- The index idx_machine_metrics_collected_at confuses the query planner 
-- when joining machines with machine_metrics using LATERAL JOIN LIMIT 1,
-- causing it to do a massive sequential scan on the index instead of 
-- using the multicolumn idx_machine_metrics_machine_collected index.

DROP INDEX IF EXISTS public.idx_machine_metrics_collected_at;
