export DB_URL="postgresql://postgres.kcxwealimsfxqstoprdg:!Oivelox5216@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

echo "=== 1. ALL TABLES ==="
psql $DB_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"

echo "=== 2. TABLES WITHOUT INDEXES ==="
psql $DB_URL -c "SELECT relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid);"

echo "=== 3. DISABLED RLS ==="
psql $DB_URL -c "SELECT relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' AND relrowsecurity = false;"

echo "=== 4. FOREIGN KEYS WITHOUT CORRESPONDING INDEX ==="
psql $DB_URL -c "
SELECT c.conrelid::regclass AS table_name, c.conname AS fk_name,
  (SELECT string_agg(attname, ', ') FROM pg_attribute WHERE attrelid = c.conrelid AND attnum = ANY(c.conkey)) AS columns
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE c.contype = 'f' AND n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i 
    WHERE i.indrelid = c.conrelid 
      AND i.indkey[0] = c.conkey[1]
  );
"

echo "=== 5. TABLE SIZES ==="
psql $DB_URL -c "SELECT relname AS table_name, pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size, pg_size_pretty(pg_relation_size(c.oid)) AS data_size FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' ORDER BY pg_total_relation_size(c.oid) DESC;"
