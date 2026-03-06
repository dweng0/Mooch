# Test Credentials

Test users are automatically created when you run `devenv up`.

## Available Test Users

### Default Test User (Monthly Plan)
- **Email:** `test@example.com`
- **Password:** `test123`
- **Plan:** `monthly`
- **Features:** Full access to all Interview Copilot features

### Half Moon Plan
- **Email:** `halfmoon@example.com`
- **Password:** `test123`
- **Plan:** `half_moon`
- **Interviews:** 3 per month

### Full Moon Plan
- **Email:** `fullmoon@example.com`
- **Password:** `test123`
- **Plan:** `full_moon`
- **Interviews:** 6 per month

## How It Works

On every `devenv up`:
1. Database migrations run
2. Seed script runs automatically
3. Test user is created if it doesn't exist
4. Test user gets an active subscription

You can immediately open the Electron app and login with the credentials above.

## Manual Seed

If you need to re-run the seed manually:

```bash
cd web
wasp db seed
```

This is safe to run multiple times - it won't create duplicates.
