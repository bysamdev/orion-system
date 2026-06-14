import re

with open("src/components/dashboard/StatsReport.tsx", "r") as f:
    content = f.read()

# Replace SLA_TARGETS import
content = content.replace("import { useTicketStats, SLA_TARGETS } from '@/hooks/useStats';", "import { useTicketStats } from '@/hooks/useStats';\nimport { useSLAConfigs } from '@/hooks/useSLAConfigs';")

# Add useSLAConfigs inside component
useSLAConfigs_injection = """  const { data: stats, isLoading } = useTicketStats(period);
  const { data: activeSla } = useSLAConfigs();
  const SLA_TARGETS = {
    high: activeSla?.high_hours || 24,
    medium: activeSla?.medium_hours || 48,
    low: activeSla?.low_hours || 72,
  };"""
content = content.replace("  const { data: stats, isLoading } = useTicketStats(period);", useSLAConfigs_injection)

with open("src/components/dashboard/StatsReport.tsx", "w") as f:
    f.write(content)
