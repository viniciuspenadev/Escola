-- Remove Parent Invite (WhatsApp Link) Schema
DROP FUNCTION IF EXISTS public.claim_invite(uuid);
DROP FUNCTION IF EXISTS public.get_invite_info(uuid);
DROP TABLE IF EXISTS public.parent_invites;
