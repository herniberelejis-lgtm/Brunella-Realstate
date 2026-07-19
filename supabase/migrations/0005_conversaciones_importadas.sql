-- Conversaciones imported from a client's WhatsApp chat history (exported as .txt and sent to
-- the Telegram bot) need to be distinguishable from voice-note and manual entries, since they
-- represent a bulk historical migration rather than a live interaction.

alter table conversaciones drop constraint if exists conversaciones_origen_check;
alter table conversaciones drop constraint if exists conversaciones_constraint_2; -- pg-mem name
alter table conversaciones add constraint conversaciones_origen_check_v2
  check (origen in ('nota_de_voz','manual','importado_whatsapp'));
