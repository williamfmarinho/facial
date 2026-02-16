CREATE TABLE IF NOT EXISTS public.face_users (
  id SERIAL PRIMARY KEY,
  full_name TEXT UNIQUE NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 1 AND age <= 120),
  descriptor DOUBLE PRECISION[] NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_users_full_name
  ON public.face_users (full_name);
