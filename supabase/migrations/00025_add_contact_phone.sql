-- Add optional contact_phone column to businesses table for customer-facing WhatsApp redirects
ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
