-- Query to compare a WORKING user vs a BROKEN user
-- Replace the IDs with actual IDs from your database

-- Working user (created via enrollment - example)
SELECT 
    'WORKING USER' as type,
    id,
    email,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    email_change_token_new,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_sent_at,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'eduardafernandes.murra@gmail.com' -- Replace with a working user email

UNION ALL

-- Broken user (created via admin_create_user RPC)
SELECT 
    'BROKEN USER' as type,
    id,
    email,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    email_change_token_new,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_sent_at,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'lumira@colegiolumira.com.br'; -- Replace with a broken user email

-- Also check if profiles exist for both
SELECT 
    'PROFILES CHECK' as type,
    u.email,
    p.id as profile_exists,
    p.role,
    p.name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email IN ('eduardafernandes.murra@gmail.com', 'lumira@colegiolumira.com.br');
