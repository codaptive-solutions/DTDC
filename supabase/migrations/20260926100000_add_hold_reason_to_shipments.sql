-- Add custom hold warning text per shipment
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS hold_reason text;
