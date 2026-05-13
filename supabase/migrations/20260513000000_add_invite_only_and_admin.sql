-- A. Add is_admin to profiles
ALTER TABLE public.profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

-- B. Protect is_admin from client-side modification
CREATE OR REPLACE FUNCTION public.protect_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'is_admin cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_is_admin_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_is_admin();

-- C. Create allowed_emails table
CREATE TABLE public.allowed_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.allowed_emails FROM anon, authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
