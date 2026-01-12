-- FIX: Allow all authenticated users to read profiles
-- This is required so Parents can see the Name of the Sender (Admin/Teacher) in communications.

-- 1. Enable RLS (just in case)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy (if it doesn't usually exist, we iterate. Safe way is to drop and create or use DO block)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Explanation:
-- The 'authenticated' role includes Parents, Teachers, and Admins.
-- limiting using (true) means they can see ALL rows. 
-- Since profiles usually only contain public info like Name/Avatar, this is standard for this typo of app.
