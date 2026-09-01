-- Supabase Auth Trigger: Link auth.users to profiles
-- When a new user signs up via Supabase Auth, this trigger creates a matching profiles row
-- with userID = auth.users.id, enabling the JWT's 'sub' claim to resolve directly to the profile.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    "userID",
    email,
    "userType",
    "firstName",
    "lastName"
  )
  VALUES (
    NEW.id,
    NEW.email,
    0,  -- default userType (RETAIL_CLIENT)
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
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
