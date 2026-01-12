-- Force delete corrupted users directly from DB
-- Bypasses API 500 errors caused by NULL tokens or other issues

-- Old Users (from previous logs)
DELETE FROM auth.users WHERE id = '3ecf0ee2-39f9-4452-b49e-5789a1f74b63';
DELETE FROM auth.users WHERE id = '070f154d-3c46-4e53-b7ff-1315613137bf';

-- New Users to remove (2026-01-02)
DELETE FROM auth.users WHERE id = '4841d682-b1e0-4315-8377-3f1128062a61'; -- lumira@colegiolumira.com.br (old)
DELETE FROM auth.users WHERE id = 'b50e7765-5b97-470f-b27f-912f6363885b'; -- tati@colegiolumira.com.br
DELETE FROM auth.users WHERE id = '5c08040a-810f-4c40-8e3b-d2ee44edf2f5'; -- lumira@colegiolumira.com.br (latest - created before final fix)
DELETE FROM auth.users WHERE id = 'b05350f6-9f76-45b4-8001-431bd1ca0866'; -- colegio@colegiolumira.com.br (created without email_change tokens)

-- Cleanup any other users with NULL confirmation tokens (Safety Net)
-- Only deletes users created recently (last 24h) to avoid accidents
DELETE FROM auth.users 
WHERE confirmation_token IS NULL 
AND created_at > (now() - interval '24 hours');
