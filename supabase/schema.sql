-- Supabase schema for Daniella's First Words
-- Run this in the Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  age_months INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (since this is a personal family app)
CREATE POLICY "Allow public read" ON words FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON words FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON words FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON words FOR DELETE USING (true);

-- Index for faster sorting
CREATE INDEX idx_words_created_at ON words (created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER words_updated_at
  BEFORE UPDATE ON words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
