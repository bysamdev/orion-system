import os
from supabase import create_client

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")

supabase = create_client(url, key)

res = supabase.table("profiles").select("role").execute()
roles = set([r['role'] for r in res.data])
print(roles)
