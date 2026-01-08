# Email Settings for Past Due Accounts

## Overview

This feature allows users to configure default email composition settings for sending past due payment reminders. Settings include default email addresses (from, to, cc, bcc), subject line, and message templates for different PD counter ranges.

## Files

- `create_email_settings_table.sql` - Database schema for Supabase
- `emailSettings.ts` - TypeScript service with types and API functions
- `TemplateEditor.svelte` - Reusable component for editing message templates
- `+page.svelte` - Settings page UI

## Database Setup

### 1. Create the Table in Supabase

Run the SQL script in your Supabase SQL Editor:

```bash
# Navigate to Supabase Dashboard > SQL Editor
# Copy and paste the contents of create_email_settings_table.sql
# Execute the script
```

This will create:
- Table: `orders_past_due_accounts_email_settings`
- Indexes for performance
- Trigger for automatic `updated_at` timestamp
- Default global settings row

### 2. Configure Row Level Security (RLS) - Optional but Recommended

```sql
-- Enable RLS
ALTER TABLE orders_past_due_accounts_email_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own settings or global settings
CREATE POLICY "Users can read own or global settings"
ON orders_past_due_accounts_email_settings
FOR SELECT
USING (
  user_email = auth.jwt()->>'email' 
  OR is_global = true
);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
ON orders_past_due_accounts_email_settings
FOR INSERT
WITH CHECK (user_email = auth.jwt()->>'email');

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings"
ON orders_past_due_accounts_email_settings
FOR UPDATE
USING (user_email = auth.jwt()->>'email')
WITH CHECK (user_email = auth.jwt()->>'email');
```

## Features

### Email Fields Configuration
- **From**: Sender email address (required)
- **To**: Default recipient (optional, falls back to customer email)
- **CC**: Carbon copy recipients
- **BCC**: Blind carbon copy recipients
- **Subject**: Email subject with `{invoice}` placeholder support

### Message Templates
Four separate templates based on PD Counter ranges:
- **15-25 days**: Friendly reminder
- **26-40 days**: Second follow-up with warning
- **41-59 days**: Urgent payment required
- **60+ days**: Final notice

### Placeholder System
Templates support these placeholders:
- `{customer}` - Customer name
- `{invoice}` - Invoice/order ID
- `{amount}` - Outstanding amount
- `{days}` - Days past due

## Testing Guide

### 1. Database Setup Test

```sql
-- Verify table was created
SELECT * FROM orders_past_due_accounts_email_settings;

-- Should return the default global settings row
```

### 2. Settings Page Access

1. Navigate to `/orders-past-due-accounts`
2. Click the "Settings" button in the toolbar (gear icon)
3. Verify you're redirected to `/orders-past-due-accounts/settings`
4. Verify the page loads with two tabs: "Email Fields" and "Message Templates"

### 3. Load Settings Test

**Expected Behavior:**
- If you're a new user (no saved settings), you should see:
  - Default From: `accounts@rapidcleanillawarra.com.au`
  - Default BCC: `mario@rapidcleanillawarra.com.au`
  - Default subject with `{invoice}` placeholder
  - Four pre-populated message templates

**To Test:**
```javascript
// Open browser console on settings page
// Check network tab for Supabase query
// Should fetch from orders_past_due_accounts_email_settings
```

### 4. Save Settings Test

**Steps:**
1. Modify any field (e.g., change BCC email)
2. Click "Save Settings"
3. Verify success toast appears
4. Refresh the page
5. Verify your changes persist

**Database Verification:**
```sql
-- Check your settings were saved
SELECT * FROM orders_past_due_accounts_email_settings 
WHERE user_email = 'your-email@example.com';
```

### 5. Template Editor Test

**Steps:**
1. Go to "Message Templates" tab
2. Switch between the four template tabs (15-25, 26-40, 41-59, 60+ days)
3. Click "Show Preview" on any template
4. Verify placeholders are replaced with sample data:
   - `{customer}` → "ABC Company Pty Ltd"
   - `{invoice}` → "INV-12345"
   - `{amount}` → "2,450.00"
   - `{days}` → "35"

### 6. Email Modal Integration Test

**Steps:**
1. Navigate back to `/orders-past-due-accounts`
2. Find an order with an email address
3. Click the email address to open the email modal
4. Verify the modal loads with your saved settings:
   - From field shows your configured sender
   - CC/BCC fields show your configured defaults
   - Subject shows with `{invoice}` replaced by actual invoice number
   - Message body shows appropriate template based on PD counter
   - All placeholders replaced with actual order data

**Test Cases:**

| PD Counter | Expected Template |
|------------|------------------|
| 20 days    | 15-25 day template (Friendly Reminder) |
| 35 days    | 26-40 day template (2nd Follow-up) |
| 50 days    | 41-59 day template (Urgent) |
| 65 days    | 60+ day template (Final Notice) |

### 7. Reset to Defaults Test

**Steps:**
1. Go to settings page
2. Make several changes to fields and templates
3. Click "Reset to Defaults"
4. Confirm the reset dialog
5. Verify all fields revert to default values
6. Click "Save Settings"
7. Verify defaults are now saved to database

### 8. Validation Test

**Test invalid inputs:**
1. Clear the "From" field (required) → Save should fail with error
2. Enter invalid email format → Save should fail with validation error
3. Clear a template → Save should fail with error
4. Enter valid data → Save should succeed

### 9. Multi-User Test

**Steps:**
1. Log in as User A
2. Configure custom settings
3. Log out
4. Log in as User B
5. Verify User B sees either:
   - Their own settings (if they've saved before)
   - Global default settings (if new user)
   - NOT User A's settings

### 10. Settings Loading State Test

**Steps:**
1. Open email modal
2. Check for "Loading settings..." indicator
3. Verify modal doesn't show stale data while loading
4. Verify fields populate after settings load

## Common Issues & Troubleshooting

### Settings Not Loading
**Symptoms:** Settings page shows defaults even after saving

**Solutions:**
1. Check browser console for Supabase errors
2. Verify table exists: `SELECT * FROM orders_past_due_accounts_email_settings;`
3. Check user is authenticated: `currentUser` should have an email
4. Verify Supabase credentials in `.env` file

### Placeholders Not Replaced
**Symptoms:** Email shows `{customer}` instead of actual customer name

**Solutions:**
1. Check `replacePlaceholders` function is being called
2. Verify order data has required fields (customer, invoice, amount, pdCounter)
3. Check browser console for JavaScript errors

### Email Modal Not Using Settings
**Symptoms:** Modal shows hardcoded defaults instead of saved settings

**Solutions:**
1. Verify `EmailModal.svelte` imports from `emailSettings.ts`
2. Check `loadEmailSettings()` is being called when modal opens
3. Verify `emailSettings` state variable is populated before template loading

### Database Permission Errors
**Symptoms:** "permission denied" or "row level security" errors

**Solutions:**
1. Temporarily disable RLS to test: `ALTER TABLE orders_past_due_accounts_email_settings DISABLE ROW LEVEL SECURITY;`
2. Check RLS policies match your auth setup
3. Verify user email matches the format stored in the database

## Performance Considerations

- Settings are loaded once when the email modal opens, then cached
- Settings are reset when modal closes to ensure fresh data next time
- Database queries use indexes on `user_email` and `is_global` for fast lookups
- No settings stored in localStorage (always fetched from DB for consistency)

## Future Enhancements

- [ ] Admin interface to manage global settings
- [ ] Template versioning and history
- [ ] Rich text editor for templates (HTML formatting)
- [ ] Additional template variables (payment history, account status, etc.)
- [ ] Email scheduling and automation
- [ ] Preview email before sending
- [ ] Template categories/tags for organization
- [ ] Export/import settings functionality
- [ ] A/B testing for email templates

## API Reference

### `fetchEmailSettings(userEmail: string): Promise<EmailSettings>`
Fetches email settings for a user, with fallback to global settings.

### `saveEmailSettings(settings: EmailSettings): Promise<{ success: boolean; error?: string }>`
Saves or updates email settings for a user.

### `getDefaultSettings(userEmail?: string): EmailSettings`
Returns hardcoded default settings as a fallback.

### `getTemplateForPdCounter(pdCounter: number, settings: EmailSettings): string`
Returns the appropriate template based on PD counter value.

### `replacePlaceholders(template: string, values: object): string`
Replaces placeholders in a template with actual values.

### `validateSettings(settings: EmailSettings): { valid: boolean; errors: string[] }`
Validates email settings before saving.

## Support

For issues or questions:
1. Check this README
2. Review browser console for errors
3. Check Supabase logs for database errors
4. Verify all files are present and imports are correct

