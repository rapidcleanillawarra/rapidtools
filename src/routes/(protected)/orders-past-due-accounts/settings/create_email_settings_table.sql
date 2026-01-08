-- Table: orders_past_due_accounts_email_settings
-- Purpose: Store default email composition settings for past due account reminders
-- Can be configured per-user or use global defaults

CREATE TABLE orders_past_due_accounts_email_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  is_global BOOLEAN DEFAULT false,
  
  -- Email fields
  default_from TEXT NOT NULL DEFAULT 'accounts@rapidcleanillawarra.com.au',
  default_to TEXT DEFAULT '',
  default_cc TEXT DEFAULT '',
  default_bcc TEXT DEFAULT 'mario@rapidcleanillawarra.com.au',
  default_subject TEXT DEFAULT 'Past Due Payment Reminder - Invoice {invoice}',
  
  -- Email templates based on PD counter ranges
  template_15_25_days TEXT DEFAULT 'Dear {customer},

I hope this email finds you well. This is a friendly reminder that payment for invoice {invoice} in the amount of ${amount} is now {days} days past due.

We value our relationship with you and understand that payments can sometimes be delayed. Please arrange payment at your earliest convenience to avoid any impact on our continued service.

If you have any questions or need to discuss payment arrangements, please don''t hesitate to contact us.

Thank you for your attention to this matter.

Best regards,
Rapid Clean Team',
  
  template_26_40_days TEXT DEFAULT 'Dear {customer},

This is our second follow-up regarding payment for invoice {invoice} in the amount of ${amount}, which is now {days} days past due.

We appreciate your business and understand that circumstances can affect payment timing. However, continued delays may result in service interruptions or holds on future orders.

Please arrange payment as soon as possible. If you need to discuss payment arrangements or have any concerns, please contact us immediately.

Thank you for your prompt attention to this matter.

Best regards,
Rapid Clean Team',
  
  template_41_59_days TEXT DEFAULT 'Dear {customer},

URGENT: Payment for invoice {invoice} in the amount of ${amount} is now {days} days past due and requires immediate attention.

This extended delay is causing significant concern and may affect our ability to continue providing service. We kindly request that you arrange payment without further delay.

Please contact us immediately if there are any issues preventing payment or if you need to discuss alternative arrangements.

We appreciate your urgent attention to this matter.

Best regards,
Rapid Clean Team',
  
  template_60_plus_days TEXT DEFAULT 'Dear {customer},

FINAL NOTICE: Payment for invoice {invoice} in the amount of ${amount} is now {days} days past due.

This prolonged delay is unacceptable and severely impacts our operations. Immediate payment is required to restore service and avoid further escalation.

Please arrange payment TODAY. Contact us immediately if there are legitimate circumstances preventing payment.

We expect your urgent cooperation in this matter.

Best regards,
Rapid Clean Team

NOTE: Continued non-payment may result in collection actions and service termination.',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  
  -- Constraints
  UNIQUE(user_email)
);

-- Add comment
COMMENT ON TABLE orders_past_due_accounts_email_settings IS 'Stores email composition settings for past due account reminders';

-- Add indexes
CREATE INDEX idx_email_settings_user_email ON orders_past_due_accounts_email_settings(user_email);
CREATE INDEX idx_email_settings_is_global ON orders_past_due_accounts_email_settings(is_global) WHERE is_global = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON orders_past_due_accounts_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default global settings
INSERT INTO orders_past_due_accounts_email_settings (
  user_email,
  is_global,
  created_by
) VALUES (
  'global@system',
  true,
  'system'
) ON CONFLICT (user_email) DO NOTHING;

