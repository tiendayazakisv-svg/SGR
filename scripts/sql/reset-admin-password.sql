-- Restablece el administrador inicial del sistema SGR.
-- Ejecutar en Supabase SQL Editor.
--
-- Credenciales despues de ejecutar:
-- SAP ID: ADMIN
-- Contrasena: Admin12345!

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_access_id uuid := '00000000-0000-0000-0000-000000000001';
  v_auth_id uuid;
  v_email text := 'admin@sgr.local.com';
  v_password text := 'Admin12345!';
  v_identity_id_type text;
begin
  select id
    into v_auth_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_auth_id is null then
    v_auth_id := v_access_id;

    if exists (select 1 from auth.users where id = v_auth_id) then
      v_auth_id := gen_random_uuid();
    end if;

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"sap_id":"ADMIN","nombre":"Administrador SGR","rol":"administrador"}'::jsonb,
      now(),
      now()
    );
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb) ||
        '{"sap_id":"ADMIN","nombre":"Administrador SGR","rol":"administrador"}'::jsonb,
      updated_at = now()
    where id = v_auth_id;
  end if;

  select data_type
    into v_identity_id_type
  from information_schema.columns
  where table_schema = 'auth'
    and table_name = 'identities'
    and column_name = 'id';

  if exists (
    select 1
    from auth.identities
    where provider = 'email'
      and provider_id = v_auth_id::text
  ) then
    update auth.identities
    set
      user_id = v_auth_id,
      identity_data = jsonb_build_object(
        'sub', v_auth_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      updated_at = now()
    where provider = 'email'
      and provider_id = v_auth_id::text;
  else
    if v_identity_id_type = 'uuid' then
      insert into auth.identities (
        id,
        user_id,
        provider_id,
        provider,
        identity_data,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        v_auth_id,
        v_auth_id::text,
        'email',
        jsonb_build_object(
          'sub', v_auth_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        now(),
        now(),
        now()
      );
    else
      insert into auth.identities (
        id,
        user_id,
        provider_id,
        provider,
        identity_data,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        v_auth_id::text,
        v_auth_id,
        v_auth_id::text,
        'email',
        jsonb_build_object(
          'sub', v_auth_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        now(),
        now(),
        now()
      );
    end if;
  end if;

  insert into public.supply_access_users (
    id,
    sap_id,
    nombre,
    email,
    rol,
    activo
  )
  values (
    v_access_id,
    'ADMIN',
    'Administrador SGR',
    v_email,
    'administrador',
    true
  )
  on conflict (sap_id) do update
  set
    nombre = excluded.nombre,
    email = excluded.email,
    rol = excluded.rol,
    activo = excluded.activo;
end $$;
