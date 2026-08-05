-- Habilita login propio SGR con SAP ID + contrasena.
-- Este script NO toca auth.users ni public.profiles.
-- Ejecutar en Supabase SQL Editor.

alter table public.supply_access_users
  add column if not exists password_hash text;

insert into public.supply_access_users (
  id,
  sap_id,
  nombre,
  email,
  rol,
  activo
)
values (
  '00000000-0000-0000-0000-000000000001',
  'ADMIN',
  'Administrador SGR',
  'admin@sgr.local.com',
  'administrador',
  true
)
on conflict (sap_id) do update
set
  nombre = excluded.nombre,
  email = excluded.email,
  rol = excluded.rol,
  activo = excluded.activo;

-- La primera carga del login asignara automaticamente la contrasena inicial
-- Admin12345! si ADMIN aun no tiene password_hash.
