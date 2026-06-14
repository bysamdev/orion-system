import re
import glob

content = ''
for f in sorted(glob.glob('supabase/migrations/*.sql')):
    with open(f, 'r') as file:
        content += file.read() + '\n'

tables = list(set(re.findall(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)', content, re.IGNORECASE)))
fks = [line.strip() for line in content.split('\n') if 'REFERENCES' in line.upper()]
indexes = re.findall(r'CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)', content, re.IGNORECASE)
policies = re.findall(r'CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)', content, re.IGNORECASE)

print("--- TABLES ---")
print(", ".join(tables))
print("\n--- INDEXES ---")
for idx in indexes: print(f"Table: {idx[1]}, Index: {idx[0]}, Columns: {idx[2]}")
print("\n--- POLICIES ---")
for p in policies: print(f"Table: {p[1]}, Policy: {p[0]}")
