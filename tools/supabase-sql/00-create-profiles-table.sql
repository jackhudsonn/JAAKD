-- Create public.profiles table matching JAAKD backend schema
-- Run this in Supabase SQL Editor first, then run 01-auth-trigger.sql

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

-- Enable RLS (policies will be added separately)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
