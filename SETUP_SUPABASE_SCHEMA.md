# Supabase Schema & Auth Setup Instructions

## Updated Schema

The application now uses a consistent schema across frontend and backend:

```
public.profiles:
  - userID (UUID, PK) ← from auth.users.id via trigger
  - email (TEXT, UNIQUE)
  - userType (NUMERIC, default 0)
  - firstName (TEXT, nullable)
  - lastName (TEXT, nullable)
  - city (TEXT, nullable)
  - state (TEXT, nullable)
  - country (TEXT, nullable)
  - zipCode (TEXT, nullable)
  - dob (DATE, nullable)
  - avatar (TEXT, nullable)
```

## Deployment Steps

### 1. Create the profiles table in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- File: tools/supabase-sql/00-create-profiles-table.sql
CREATE TABLE IF NOT EXISTS public.profiles (
  "userID" uuid NOT NULL,
  email text NOT NULL,
  "userType" numeric NOT NULL DEFAULT '0'::numeric,
  "firstName" text NULL,
  "lastName" text NULL,
  city text NULL,
  state text NULL,
  country text NULL,
  "zipCode" text NULL,
  dob date NULL,
  avatar text NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY ("userID"),
  CONSTRAINT profiles_email_key UNIQUE (email)
) TABLESPACE pg_default;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
```

### 2. Create the auth trigger

After the table exists, run this in Supabase SQL Editor:

```sql
-- File: tools/supabase-sql/01-auth-trigger.sql
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## What Changed

### Backend
- **Profile.java**: Removed `@GeneratedValue` — `userID` is now set by Supabase trigger, not generated independently
- All column names now match the schema exactly

### Frontend
- **ProfileRow interface**: Updated to match database schema (userID, firstName, lastName, etc.)
- **getProfile() method**: Now queries correct columns from the database
- **Profile component**: Builds full name from `firstName` + `lastName` (not `full_name`)
- **Shell component**: Same display name logic updated

## Identity Chain Flow

```
1. User signs up in Angular → Supabase Auth
2. auth.users row created with id (UUID)
3. Trigger fires → creates profiles row with userID = auth.users.id
4. Backend receives JWT with 'sub' claim = auth.users.id
5. CurrentUserService.getUserId() → UUID from JWT 'sub'
6. Query: SELECT * FROM profiles WHERE userID = currentUserId ✅
```

## Testing

After deploying to Supabase:

1. Sign up a new user in the Angular app
2. Check Supabase → profiles table — should see a row with matching userID
3. Backend should be able to load the profile with no errors

## Backend Status

✅ Backend compiles successfully with all changes
✅ Profile entity matches schema
✅ CurrentUserService ready to resolve users from JWT
