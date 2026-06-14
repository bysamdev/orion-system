import os
import glob
import re
from collections import defaultdict

sql_files = glob.glob('supabase/migrations/*.sql')
content = ''
for f in sorted(sql_files):
    with open(f, 'r') as file:
        content += file.read() + '\n'

# Find tables
tables = re.findall(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)', content, re.IGNORECASE)
tables = list(set(tables))

# Find Foreign Keys
# Look for "FOREIGN KEY (col) REFERENCES table(col)" or "col_name TYPE REFERENCES table(col)"
fks = []
for line in content.split('\n'):
    if 'REFERENCES' in line.upper():
        fks.append(line.strip())

# Find Indexes
indexes = re.findall(r'CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([^)]+)\)', content, re.IGNORECASE)

# Find Policies
policies = re.findall(r'CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)', content, re.IGNORECASE)

print("--- TABLES ---")
print(", ".join(tables))
print("\n--- INDEXES ---")
for idx in indexes:
    print(f"Table: {idx[1]}, Index: {idx[0]}, Columns: {idx[2]}")

print("\n--- FOREIGN KEYS ---")
for fk in fks:
    print(fk)

print("\n--- RLS POLICIES ---")
for pol in policies:
    print(f"Table: {pol[1]}, Policy: {pol[0]}")

