-- Local development seed data.
-- Creates a deterministic test admin user and allowlist entry.

DO $$
DECLARE
  seed_email CONSTANT text := 'test@test.com';
  seed_password CONSTANT text := 'password';
  fallback_user_id CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  seed_user_id uuid;
BEGIN
  SELECT id INTO seed_user_id FROM auth.users WHERE email = seed_email LIMIT 1;

  IF seed_user_id IS NULL THEN
    seed_user_id := fallback_user_id;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      seed_user_id,
      'authenticated',
      'authenticated',
      seed_email,
      crypt(seed_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      '{}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      confirmation_token = '',
      email_change = '',
      email_change_token_new = '',
      recovery_token = '',
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      updated_at = now();
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = crypt(seed_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = '',
      email_change = '',
      email_change_token_new = '',
      recovery_token = '',
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      updated_at = now()
    WHERE id = seed_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities
    WHERE provider = 'email' AND user_id = seed_user_id
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      seed_user_id,
      jsonb_build_object('sub', seed_user_id::text, 'email', seed_email),
      'email',
      seed_user_id::text,
      now(),
      now(),
      now()
    );
  END IF;

  INSERT INTO public.allowed_emails (email, invited_by)
  VALUES (seed_email, seed_user_id)
  ON CONFLICT (email) DO UPDATE
  SET invited_by = EXCLUDED.invited_by;

  INSERT INTO public.allowed_emails (email, invited_by)
  VALUES
    ('one@test.com', seed_user_id),
    ('two@test.com', seed_user_id)
  ON CONFLICT (email) DO UPDATE
  SET invited_by = EXCLUDED.invited_by;

  INSERT INTO public.profiles (id, display_name, is_admin)
  VALUES (seed_user_id, 'Test Admin', true)
  ON CONFLICT (id) DO UPDATE
  SET
    is_admin = true,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);
END;
$$;
