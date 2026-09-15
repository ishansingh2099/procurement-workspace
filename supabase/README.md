# Supabase setup

1. Open the Supabase dashboard for this project.
2. Open **SQL Editor** and create a new query.
3. Copy the contents of `001_requests.sql` into the query.
4. Run the query.
5. Restart the Next.js development server so it reloads `.env.local`.
6. Open `http://localhost:3000` and save a draft.
7. In Supabase, open **Table Editor > requests** and confirm the row exists.

The current API uses `SUPABASE_SERVICE_ROLE_KEY` only on the server in `src/lib/supabase-server.ts`. Do not import that module into a client component or expose the key through a `NEXT_PUBLIC_` variable.

The current prototype intentionally stores one demo request with the fixed ID `demo-request-1`. Replace this with authenticated user IDs and normal request IDs before supporting multiple users.
