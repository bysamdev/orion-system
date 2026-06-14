-- Migration to cleanup test tickets and prevent XSS test data from lingering

DELETE FROM public.tickets 
WHERE title ILIKE '%script%'
   OR title ILIKE '%DEBUG%'
   OR title ILIKE '%XSS%'
   OR title ~ '^[a-z]{20,}$';
