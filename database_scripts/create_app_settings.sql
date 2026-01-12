-- Create a general settings table
create table if not exists app_settings (
    key text primary key,
    value text not null,
    description text,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users(id)
);

-- RLS Policies
alter table app_settings enable row level security;

-- Everyone can read settings (needed for Parent App)
create policy "Everyone can read settings"
    on app_settings for select
    using (true);

-- Only admins can modify (assuming we check roles in DB or App - for now open to authenticated users who are staff, but let's just say 'authenticated' for simplicity of this script, strict RLS would be added if we had roles table setup here)
-- For now, let's allow authenticated users to update if they are admins (conceptually).
-- Since we don't have a robust role check in SQL here yet, we'll allow all authenticated to insert/update for the Admin panel to work, relying on App-side routing protection.
create policy "Authenticated can update settings"
    on app_settings for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

-- Insert default value for diary release time
insert into app_settings (key, value, description)
values ('diary_release_time', '17:00', 'Horário (HH:MM) em que o diário do dia atual fica visível para os pais.')
on conflict (key) do nothing;
