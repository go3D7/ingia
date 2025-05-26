```sql
-- Enable pgcrypto extension if not already enabled (for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the 'premises' table (assuming it might not exist yet in a fresh setup)
CREATE TABLE IF NOT EXISTS public.premises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    category TEXT,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    county TEXT,
    address TEXT,
    owner_id UUID REFERENCES auth.users(id),
    friendly_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security for 'premises' table if it exists or was just created
ALTER TABLE public.premises ENABLE ROW LEVEL SECURITY;

-- Create a trigger on 'premises' table to update 'updated_at' on any update
-- This ensures the trigger exists, even if the table was created in a previous migration
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_premises_modtime' AND tgrelid = 'premises'::regclass) THEN
      CREATE TRIGGER update_premises_modtime
      BEFORE UPDATE ON public.premises
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
   END IF;
END
$$;

-- Create the 'user_profiles' table (assuming it might not exist yet in a fresh setup)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security for 'user_profiles' table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a trigger on 'user_profiles' table to update 'updated_at' on any update
-- This ensures the trigger exists, even if the table was created in a previous migration
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_profiles_modtime' AND tgrelid = 'user_profiles'::regclass) THEN
      CREATE TRIGGER update_user_profiles_modtime
      BEFORE UPDATE ON public.user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_timestamp();
   END IF;
END
$$;

-- Create the 'forms' table
CREATE TABLE public.forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    premise_id UUID REFERENCES public.premises(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    definition JSONB, -- Example: '[{"label": "Full Name", "type": "text", "required": true}]'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

COMMENT ON TABLE public.forms IS 'Stores custom form structures created by vendors for visitor check-in.';

-- Create the 'qrcodes' table
CREATE TABLE public.qrcodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE,
    premise_id UUID REFERENCES public.premises(id) ON DELETE CASCADE, -- Denormalized for easier lookup if needed
    qr_identifier TEXT UNIQUE NOT NULL, -- Data to be embedded in the visual QR (e.g., a UUID)
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.qrcodes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_qrcodes_updated_at
BEFORE UPDATE ON public.qrcodes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

COMMENT ON TABLE public.qrcodes IS 'Stores identifiers for QR codes, linked to forms.';

-- Create the 'visits' table
CREATE TABLE public.visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id UUID REFERENCES public.profiles(id), -- Corrected to reference profiles.id
    premise_id UUID REFERENCES public.premises(id) ON DELETE CASCADE,
    form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE,
    qrcode_id UUID REFERENCES public.qrcodes(id),
    form_data JSONB,
    check_in_time TIMESTAMPTZ DEFAULT now(),
    check_out_time TIMESTAMPTZ,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security for 'visits' table
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Create a trigger on 'visits' table to update 'updated_at' on any update
CREATE TRIGGER set_visits_updated_at
BEFORE UPDATE ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Policies for 'premises' table
-- Allow users to view their own premises
CREATE POLICY "Enable read access for own premises" ON public.premises
FOR SELECT USING (auth.uid() = owner_id);

-- Allow users to insert their own premises (if they don't have one already - handled by application logic)
CREATE POLICY "Enable insert for own premises" ON public.premises
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Allow users to update their own premises
CREATE POLICY "Enable update for own premises" ON public.premises
FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Policies for 'user_profiles' table
-- Users can view their own profile
CREATE POLICY "Enable read access for own user" ON public.user_profiles
FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Enable update for own user" ON public.user_profiles
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policies for 'forms' table
-- Users can manage forms for premises they own
CREATE POLICY "Enable ALL for own premise forms" ON public.forms
FOR ALL
USING (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id))
WITH CHECK (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id));

-- Policies for 'qrcodes' table
-- Users can manage QR codes for premises they own
CREATE POLICY "Enable ALL for own premise qrcodes" ON public.qrcodes
FOR ALL
USING (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id))
WITH CHECK (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id));

-- Policies for 'visits' table
-- Allow users to view visits associated with their premises
CREATE POLICY "Enable read access for own premise visits" ON public.visits
FOR SELECT USING (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id));

-- Allow authenticated users to insert new visits (e.g., through a public form submission that gets associated with a premise)
-- This might need further refinement based on specific application logic for how visits are created by non-owners.
-- For now, let's assume any authenticated user can create a visit, but it must be linked to a valid premise.
CREATE POLICY "Enable insert for authenticated users" ON public.visits
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow owners to update visits associated with their premises (e.g., check_out_time)
CREATE POLICY "Enable update for own premise visits" ON public.visits
FOR UPDATE USING (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id))
WITH CHECK (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id));

-- Allow owners to delete visits associated with their premises
CREATE POLICY "Enable delete for own premise visits" ON public.visits
FOR DELETE USING (auth.uid() = (SELECT owner_id FROM premises WHERE id = premise_id));

```
