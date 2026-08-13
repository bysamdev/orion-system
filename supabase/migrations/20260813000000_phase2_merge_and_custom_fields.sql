-- Migration: 20260813000000_phase2_merge_and_custom_fields.sql

-- Add custom_fields to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create GIN indexes for custom_fields
CREATE INDEX IF NOT EXISTS idx_tickets_custom_fields ON public.tickets USING GIN (custom_fields);

-- Create stored procedure fn_merge_tickets
CREATE OR REPLACE FUNCTION public.fn_merge_tickets(primary_id UUID, duplicate_ids UUID[])
RETURNS VOID AS $$
DECLARE
    dup_id UUID;
    merged_by UUID;
BEGIN
    merged_by := auth.uid();
    
    FOREACH dup_id IN ARRAY duplicate_ids
    LOOP
        -- Transfer updates
        UPDATE public.ticket_updates SET ticket_id = primary_id WHERE ticket_id = dup_id;
        
        -- Transfer attachments
        UPDATE public.ticket_attachments SET ticket_id = primary_id WHERE ticket_id = dup_id;
        
        -- Add audit note to primary ticket
        INSERT INTO public.ticket_updates (ticket_id, user_id, update_type, content, created_at)
        VALUES (
            primary_id, 
            merged_by, 
            'system', 
            'Ticket ' || dup_id || ' foi mesclado a este ticket.', 
            NOW()
        );
        
        -- Add audit note to duplicate ticket and close it
        UPDATE public.tickets SET status = 'closed' WHERE id = dup_id;
        
        INSERT INTO public.ticket_updates (ticket_id, user_id, update_type, content, created_at)
        VALUES (
            dup_id, 
            merged_by, 
            'system', 
            'Este ticket foi mesclado ao ticket ' || primary_id || ' e encerrado.', 
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
