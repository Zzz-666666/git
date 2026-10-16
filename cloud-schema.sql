CREATE SCHEMA IF NOT EXISTS wandeng;
REVOKE ALL ON SCHEMA wandeng FROM PUBLIC;
SET LOCAL search_path TO wandeng,pg_catalog;
CREATE TABLE IF NOT EXISTS people (id text PRIMARY KEY,auth text NOT NULL UNIQUE,name text NOT NULL,bio text NOT NULL,avatar text NOT NULL,dm bigint NOT NULL DEFAULT 1,created bigint NOT NULL,space_name text NOT NULL DEFAULT '我的空间',effect text NOT NULL DEFAULT 'fireworks');
CREATE TABLE IF NOT EXISTS accounts (id text PRIMARY KEY,person text NOT NULL UNIQUE REFERENCES people(id),username text NOT NULL UNIQUE,password text NOT NULL,salt text NOT NULL,recovery text NOT NULL,created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (hash text PRIMARY KEY,account text NOT NULL REFERENCES accounts(id),expires bigint NOT NULL);
CREATE TABLE IF NOT EXISTS auth_limits (key text PRIMARY KEY,count bigint NOT NULL,until bigint NOT NULL);
CREATE TABLE IF NOT EXISTS posts (id text PRIMARY KEY,author text NOT NULL REFERENCES people(id),text text NOT NULL,mood text NOT NULL,visibility text NOT NULL,audio text,mime text,duration bigint,created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY,post text NOT NULL REFERENCES posts(id),author text NOT NULL REFERENCES people(id),text text NOT NULL,created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS hugs (post text NOT NULL REFERENCES posts(id),author text NOT NULL REFERENCES people(id),UNIQUE(post,author));
CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY,sender text NOT NULL REFERENCES people(id),recipient text NOT NULL REFERENCES people(id),text text NOT NULL,created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS friendships (first text NOT NULL REFERENCES people(id),second text NOT NULL REFERENCES people(id),requester text NOT NULL REFERENCES people(id),state text NOT NULL,created bigint NOT NULL,UNIQUE(first,second));
CREATE TABLE IF NOT EXISTS follows (owner text NOT NULL REFERENCES people(id),target text NOT NULL REFERENCES people(id),created bigint NOT NULL,UNIQUE(owner,target));
CREATE TABLE IF NOT EXISTS notes (owner text NOT NULL REFERENCES people(id),target text NOT NULL REFERENCES people(id),label text NOT NULL,UNIQUE(owner,target));
CREATE TABLE IF NOT EXISTS legacy_claims (hash text PRIMARY KEY,person text NOT NULL UNIQUE REFERENCES people(id),expires bigint NOT NULL);
REVOKE ALL ON ALL TABLES IN SCHEMA wandeng FROM PUBLIC;
DO $$ DECLARE table_name text; role_name text; BEGIN
 FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='wandeng' LOOP
  EXECUTE format('ALTER TABLE wandeng.%I ENABLE ROW LEVEL SECURITY',table_name);
 END LOOP;
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
  EXECUTE format('REVOKE ALL ON SCHEMA wandeng FROM %I',role_name);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA wandeng FROM %I',role_name);
 END LOOP;
END $$;
