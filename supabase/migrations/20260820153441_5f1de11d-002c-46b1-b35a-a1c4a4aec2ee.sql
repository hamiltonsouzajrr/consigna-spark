-- Migration to create leads management tables
CREATE TABLE public.lead_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
    total_leads INTEGER DEFAULT 0,
    processed_leads INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.leads_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.lead_batches(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- 'new', 'processed', 'invalid'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_batches TO authenticated;
GRANT ALL ON public.lead_batches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_raw TO authenticated;
GRANT ALL ON public.leads_raw TO service_role;

-- Enable RLS
ALTER TABLE public.lead_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_raw ENABLE ROW LEVEL SECURITY;

-- Policies for lead_batches
CREATE POLICY "Admins can manage all lead batches"
ON public.lead_batches
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can see their own batches"
ON public.lead_batches
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Policies for leads_raw
CREATE POLICY "Admins can manage all raw leads"
ON public.leads_raw
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can see leads from their batches"
ON public.leads_raw
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.lead_batches
        WHERE lead_batches.id = leads_raw.batch_id
        AND lead_batches.created_by = auth.uid()
    )
);
