import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Handle credential access decisions (approve/decline)
export const GET: RequestHandler = async ({ url }) => {
  try {
    const action = url.searchParams.get('action');
    const user = url.searchParams.get('user');
    const credential = url.searchParams.get('credential');
    const credentialId = url.searchParams.get('id');

    if (!action || !user || !credential || !credentialId) {
      return json({
        error: 'Missing required parameters',
        required: ['action', 'user', 'credential', 'id']
      }, { status: 400 });
    }

    if (!['approve', 'decline'].includes(action)) {
      return json({
        error: 'Invalid action. Must be "approve" or "decline"'
      }, { status: 400 });
    }

    // TODO: Here you would connect to your database and update the current_access column
    // Example implementation:

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    if (action === 'approve') {
      // Add approved access entry to current_access array
      const accessEntry = {
        user_id: 'user-id-here', // TODO: Get actual user ID from authentication
        user_name: user,
        granted_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'active'
      };

      // SQL would be something like:
      // UPDATE credentials_vault
      // SET current_access = current_access || $1::jsonb
      // WHERE id = $2
      // (where $1 is the accessEntry JSON, $2 is credentialId)

      console.log(`Credential access APPROVED:`, {
        credential: credentialInfo,
        user,
        granted_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      });

    } else if (action === 'decline') {
      // For decline, you might want to add a declined entry or just log it
      const declineEntry = {
        user_id: 'user-id-here',
        user_name: user,
        requested_at: now.toISOString(),
        status: 'declined',
        reason: 'declined_by_approver'
      };

      console.log(`Credential access DECLINED:`, {
        credential: credentialInfo,
        user,
        declined_at: now.toISOString()
      });
    }

    // For now, just log the action and return success
    return json({
      success: true,
      message: `Credential access ${action}d successfully`,
      data: {
        action,
        user,
        credential: credentialInfo,
        credentialId,
        processedAt: now.toISOString(),
        expiresAt: action === 'approve' ? expiresAt.toISOString() : null
      }
    });

    // Option 2: Redirect to a success page (uncomment if preferred)
    // return redirect('/credentials-action-success?action=' + action, 302);

  } catch (error) {
    console.error('Error processing credential access decision:', error);
    return json({
      error: 'Internal server error',
      message: 'Failed to process credential access decision'
    }, { status: 500 });
  }
};
