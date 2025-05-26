-- Create the 'premises' table
CREATE TABLE premises (
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

-- Enable Row Level Security for 'premises' table
ALTER TABLE premises ENABLE ROW LEVEL SECURITY;

-- Create a trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger on 'premises' table to update 'updated_at' on any update
CREATE TRIGGER update_premises_modtime
BEFORE UPDATE ON premises
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- Create the 'user_profiles' table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security for 'user_profiles' table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a trigger on 'user_profiles' table to update 'updated_at' on any update
CREATE TRIGGER update_user_profiles_modtime
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();
