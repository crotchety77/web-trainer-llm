ALTER TABLE users
ADD COLUMN IF NOT EXISTS llm_api_key_encrypted TEXT;
