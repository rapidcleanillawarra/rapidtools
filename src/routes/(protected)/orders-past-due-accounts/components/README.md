# TicketModal Component Tests

## Sydney Timezone Test

The `TicketModal.test.js` file contains tests to verify that the Sydney timezone display in the TicketModal component works correctly.

### What it tests:

1. **Format Validation**: Ensures the time is displayed in the correct format (`DD Month YYYY at HH:MM am/pm`)
2. **Time Validation**: Verifies that hour and minute values are within valid ranges
3. **Stability Testing**: Confirms the function doesn't throw errors when called multiple times
4. **Timezone Verification**: Checks that timezone conversion is working (may use fallback method on Windows)

### Running the test:

```bash
# Using npm script
npm run test:sydney-timezone

# Or directly with node
node "src/routes/(protected)/orders-past-due-accounts/components/TicketModal.test.js"
```

### Test Results:

The test will show:
- ✅ Format test passed
- ✅ Time validation test passed
- ✅ Stability test passed
- ⚠️ Timezone offset test (may show fallback usage on Windows)
- 🎉 All Sydney timezone tests passed!

### About the Sydney Time Display:

The TicketModal component shows the current Sydney time (UTC+10 during AEST) above the due date field. The implementation includes:

- Primary method: Uses `Intl.DateTimeFormat` with `'Australia/Sydney'` timezone
- Fallback method: Manual UTC offset calculation for Windows compatibility
- Format: Australian English locale with 12-hour time and AM/PM indicators

This ensures the time display works correctly across different operating systems and browsers.