import re

with open("src/pages/TicketDetails.tsx", "r") as f:
    content = f.read()

# Add useSLAConfigs import
content = content.replace("import { useTicket, useTicketUpdates, useUpdateTicketStatus, useUpdateTicketAssignment, useAddTicketUpdate, useTicketTimeEntries, useTicketAttachments, useUploadAttachment, useRealtimeTicket } from '@/hooks/useTickets';", "import { useTicket, useTicketUpdates, useUpdateTicketStatus, useUpdateTicketAssignment, useAddTicketUpdate, useTicketTimeEntries, useTicketAttachments, useUploadAttachment, useRealtimeTicket } from '@/hooks/useTickets';\nimport { useSLAConfigs } from '@/hooks/useSLAConfigs';")

# Inject hook call
content = content.replace("  const { data: userProfile } = useUserProfile();", "  const { data: userProfile } = useUserProfile();\n  const { data: activeSla } = useSLAConfigs();")

# Replace the text
content = content.replace("O ticket será encerrado automaticamente em 48h caso não haja resposta.", "O ticket será encerrado automaticamente em {activeSla?.medium_hours || 48}h caso não haja resposta.")

with open("src/pages/TicketDetails.tsx", "w") as f:
    f.write(content)
