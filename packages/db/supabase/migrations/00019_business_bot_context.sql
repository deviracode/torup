-- Free-text guidance from business owners that gets injected into the
-- WhatsApp bot's system prompt to give it more relevant business context
ALTER TABLE businesses
  ADD COLUMN bot_context TEXT;
