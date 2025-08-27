# feat(workshop): Store user's full name in created_by field

This commit enhances the workshop creation process by storing the creator's full name instead of just their UID, improving traceability and user experience.

### Files Modified:

#### 1. `src/lib/services/workshop.ts`
- CHANGED: Modified `createWorkshop` to store user's full name in `created_by` field instead of UID
- ADDED: Integration with user profile system to fetch firstName and lastName
- REMOVED: Unnecessary `created_by_name` field from WorkshopRecord interface
- DIFF:
  ```diff
  // Import user profile functionality
  + import { fetchUserProfile } from '$lib/userProfile';
  
  // In createWorkshop function
  + // Fetch user profile to get name information (same as Header)
  + let userProfile = null;
  + try {
  +   userProfile = await fetchUserProfile(finalUserId);
  + } catch (error) {
  +   console.warn('Could not fetch user profile:', error);
  + }
  +
  + // Create user name from profile or fallback to email
  + let createdByName = 'Unknown User';
  + if (userProfile && userProfile.firstName && userProfile.lastName) {
  +   createdByName = `${userProfile.firstName} ${userProfile.lastName}`;
  + } else {
  +   // Fallback to current user's email if profile not available
  +   const currentUserData = get(currentUser);
  +   if (currentUserData?.email) {
  +     createdByName = currentUserData.email.split('@')[0] || 'Unknown User';
  +   }
  + }

  // In workshopData object
  - created_by: finalUserId,
  + created_by: createdByName,
  ```
- WHY: Improve traceability by showing who created each workshop by name instead of just UID
- IMPACT: Makes workshop records more human-readable and matches the name display in Header

### Technical Improvements:

#### Traceability:
- BEFORE: Workshop records showed creator's UID (e.g., "abc123def456")
- AFTER: Workshop records show creator's full name (e.g., "John Smith")

#### Consistency:
- BEFORE: Header showed user's name but database stored UID
- AFTER: Both Header and database use the same user profile information

#### Error Handling:
- ADDED: Graceful fallback if profile fetch fails
  - First tries to use firstName + lastName from profile
  - Falls back to email username if profile unavailable
  - Uses "Unknown User" as last resort

#### Reusability:
- IMPROVED: Both create page and camera page benefit from the change
- MAINTAINED: Original UID is still available in Firebase authentication context

### Testing Instructions:

1. Login to the application
2. Create a new workshop via either:
   - Workshop Create page
   - Workshop Camera page
3. Check the created workshop in the database
4. Verify the `created_by` field shows your full name instead of UID

### Related Components:
- Workshop Create page
- Workshop Camera page
- Header component (uses the same user profile pattern)

### Dependencies:
- Uses existing `userProfile.ts` functionality
- No new dependencies added