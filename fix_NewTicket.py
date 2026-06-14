import re

with open("src/pages/NewTicket.tsx", "r") as f:
    content = f.read()

# Replace useQuery for slaConfigs with useSLAConfigs
import_statement = "import { useQuery, useQueryClient } from '@tanstack/react-query';"
if "useSLAConfigs" not in content:
    content = content.replace(import_statement, import_statement + "\nimport { useSLAConfigs } from '@/hooks/useSLAConfigs';")

# Find and replace the block
query_block = """  const { data: slaConfigs } = useQuery({
    queryKey: ['sla-configs', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('sla_configs')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  const activeSla = slaConfigs?.[0] || {
    urgent_hours: 4,
    high_hours: 24,
    medium_hours: 48,
    low_hours: 72,
  };"""

if query_block in content:
    content = content.replace(query_block, "  const { data: activeSla } = useSLAConfigs();")
else:
    print("Could not find the query block exactly, trying regex...")
    pattern = re.compile(r'  const { data: slaConfigs } = useQuery\(\{[\s\S]*?enabled: !!profile\?\.company_id\n  \}\);\n\n  const activeSla = slaConfigs\?\.\[0\] \|\| \{\n    urgent_hours: 4,\n    high_hours: 24,\n    medium_hours: 48,\n    low_hours: 72,\n  \};\n')
    if pattern.search(content):
        content = pattern.sub("  const { data: activeSla = { urgent_hours: 4, high_hours: 24, medium_hours: 48, low_hours: 72 } } = useSLAConfigs();\n", content)

with open("src/pages/NewTicket.tsx", "w") as f:
    f.write(content)
