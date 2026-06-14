import re

with open("src/hooks/useStats.ts", "r") as f:
    content = f.read()

# Remove SLA_TARGETS definition
content = re.sub(r'// SLA targets by priority \(in hours\)\nexport const SLA_TARGETS = {\n  high: 2,\n  medium: 4,\n  low: 8,\n} as const;\n', '', content)

# Inject SLA fetching into useTicketStats
useTicketStats_injection = """    queryFn: async () => {
      const { data: slaConfigs } = await supabaseRead.from('sla_configs').select('*').limit(1);
      const activeSla = slaConfigs?.[0] || { urgent_hours: 4, high_hours: 24, medium_hours: 48, low_hours: 72 };
      const SLA_TARGETS = { urgent: activeSla.urgent_hours, high: activeSla.high_hours, medium: activeSla.medium_hours, low: activeSla.low_hours };

      const now = new Date();"""
content = content.replace("    queryFn: async () => {\n      const now = new Date();", useTicketStats_injection, 1)

# Inject SLA fetching into useGlobalTicketStats
useGlobalTicketStats_injection = """    queryFn: async () => {
      const { data: slaConfigs } = await supabaseRead.from('sla_configs').select('*').limit(1);
      const activeSla = slaConfigs?.[0] || { urgent_hours: 4, high_hours: 24, medium_hours: 48, low_hours: 72 };
      const SLA_TARGETS = { urgent: activeSla.urgent_hours, high: activeSla.high_hours, medium: activeSla.medium_hours, low: activeSla.low_hours };

      const now = new Date();"""
content = content.replace("    queryFn: async () => {\n      const now = new Date();", useGlobalTicketStats_injection, 1)

with open("src/hooks/useStats.ts", "w") as f:
    f.write(content)
