-- Supabase Auth Trigger: Link auth.users to profiles
-- When a new user signs up via Supabase Auth, this trigger creates a matching profiles row
-- with userID = auth.users.id, enabling the JWT's 'sub' claim to resolve directly to the profile.
-- Schema columns: userID (PK), email, userType, firstName, lastName, city, state, country, zipCode, dob, avatar

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    "userID",
    email,
    "userType",
    "firstName",
    "lastName",
    city,
    state,
    country,
    "zipCode",
    dob,
    avatar
  )
  VALUES (
    NEW.id,
    NEW.email,
    0,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL),
    COALESCE(NEW.raw_user_meta_data->>'state', NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', NULL),
    COALESCE(NEW.raw_user_meta_data->>'zip_code', NULL),
    COALESCE(NEW.raw_user_meta_data->>'dob', NULL)::date,
    NULL
  )
  ON CONFLICT ("userID") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger fires after auth.users row is inserted
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- Keep profiles synchronized when editable Auth metadata changes
CREATE OR REPLACE FUNCTION public.handle_user_profile_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,

    "firstName" = CASE
      WHEN NEW.raw_user_meta_data ? 'first_name'
      THEN NEW.raw_user_meta_data->>'first_name'
      ELSE "firstName"
    END,

    "lastName" = CASE
      WHEN NEW.raw_user_meta_data ? 'last_name'
      THEN NEW.raw_user_meta_data->>'last_name'
      ELSE "lastName"
    END,

    city = CASE
      WHEN NEW.raw_user_meta_data ? 'city'
      THEN NEW.raw_user_meta_data->>'city'
      ELSE city
    END,

    state = CASE
      WHEN NEW.raw_user_meta_data ? 'state'
      THEN NEW.raw_user_meta_data->>'state'
      ELSE state
    END,

    country = CASE
      WHEN NEW.raw_user_meta_data ? 'country'
      THEN NEW.raw_user_meta_data->>'country'
      ELSE country
    END,

    "zipCode" = CASE
      WHEN NEW.raw_user_meta_data ? 'zip_code'
      THEN NEW.raw_user_meta_data->>'zip_code'
      ELSE "zipCode"
    END,

    dob = CASE
      WHEN NEW.raw_user_meta_data ? 'dob'
      THEN NULLIF(NEW.raw_user_meta_data->>'dob', '')::date
      ELSE dob
    END

  WHERE "userID" = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_profile_updated ON auth.users;

CREATE TRIGGER on_auth_user_profile_updated
  AFTER UPDATE OF raw_user_meta_data, email
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_profile_update();
