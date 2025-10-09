# Workshop Job Status Conditions

This document summarizes the conditions and behaviors for the workshop create/edit page based on different job statuses.

## Job Status Types
- `new` - Brand new job that hasn't been saved yet
- `pickup` - Job where equipment has been delivered to workshop
- `to_be_quoted` - Job ready for quoting/docket creation
- `docket_ready` - Job with completed docket information
- `quoted` - Job that has been quoted
- `repaired` - Job that has been repaired
- `waiting_approval_po` - Job waiting for PO approval
- `waiting_for_parts` - Job waiting for parts
- `booked_in_for_repair_service` - Job booked for repair service
- `pending_jobs` - Job in pending status
- `null` - No status (typically new forms)

## Section Visibility and Editability by Status

### Machine Information Section
| Status | Can Edit | Visible | Notes |
|--------|----------|---------|-------|
| `pickup` | ❌ No | ✅ Yes | Cannot modify machine info once equipment is delivered |
| `new` | ✅ Yes | ✅ Yes | Can edit all machine information |
| `to_be_quoted` | ❌ No | ✅ Yes | Cannot edit once ready for quoting |
| `quoted`/`repaired` | ❌ No | ✅ Yes | Cannot edit completed jobs |
| All others | ❌ No | ✅ Yes | Default: cannot edit active jobs |

### User Information Section
| Status | Can Edit | Visible | Notes |
|--------|----------|---------|-------|
| `pickup` | ❌ No | ✅ Yes | Cannot modify user info once equipment is delivered |
| `new` | ✅ Yes | ✅ Yes | Can edit all user information |
| `to_be_quoted` | ❌ No | ✅ Yes | Cannot edit once ready for quoting |
| `quoted`/`repaired` | ❌ No | ✅ Yes | Cannot edit completed jobs |
| All others | ❌ No | ✅ Yes | Default: cannot edit active jobs |

### Optional Contacts Section
| Status | Can Edit | Visible | Notes |
|--------|----------|---------|-------|
| `pickup` | ❌ No | ❌ No | Cannot modify contacts for pickup jobs |
| `new` | ✅ Yes | ✅ Yes | Can add/edit contacts |
| `to_be_quoted` | ✅ Yes | ✅ Yes | Can still add contacts for quoted jobs |
| `quoted`/`repaired` | ❌ No | ✅ Yes | Cannot edit contacts for completed jobs |
| All others | ❌ No | ✅ Yes | Default: cannot edit active jobs |

### Photos Section
- **Always visible** regardless of status
- Photos are optional (MIN_PHOTOS_REQUIRED = 0)

### Docket Info Section
| Status | Visible | Notes |
|--------|----------|-------|
| `new` | ❌ No | No docket info for new jobs |
| `pickup` | ❌ No | No docket info for pickup jobs |
| All others | ✅ Yes | Available for existing non-new/pickup jobs |

## Button Behavior by Status

### Submit Button Text
| Status | Button Text | Notes |
|--------|-------------|-------|
| `pickup` | "Delivered/To Be Quoted" | Status transition button |
| `new` + Site location | "Pickup →" | Creates pickup job |
| `new` + Workshop location | "To be Quoted" | Creates regular job |
| No existing workshop ID + Site | "Pickup →" | Creates pickup job |
| No existing workshop ID + Workshop | "Create Job" | Creates regular job |
| `to_be_quoted` | "Docket Ready" | Moves to docket_ready status |
| `quoted`/`repaired` | "Update Job" | Update existing completed job |
| All others | "Update Job" | Default update button |

### Button Visibility
- **Update Job Button**: Always visible for data updates only (no status changes)
- **Submit Button**: Only visible when `existingWorkshopId` exists (for status transitions)

## Order Creation Logic

### When Orders Can Be Created
| Condition | Can Create Order | Notes |
|-----------|------------------|-------|
| `pickup` status | ❌ No | Pickup jobs never create Maropost orders |
| `new` status | ❌ No | New jobs don't create orders until submitted |
| No existing workshop | ❌ No | New forms don't create orders |
| `to_be_quoted` + no existing order | ✅ Yes | Can create order if doesn't have one |
| All others | ❌ No | Default: no order creation |

### Order Creation Triggers
- Only for existing workshops (`existingWorkshopId` exists)
- Only when status allows (`canCreateOrder: true`)
- Checks if workshop already has `order_id` before creating new order
- Fetches customer data from Maropost API first
- Creates order via Maropost API

## Special Status Transitions

### New Job → Pickup Job
- Condition: `(workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site'`
- Sets status to `'pickup'`
- Shows pickup status change modal
- Forces navigation to workshop board

### Pickup Job → To Be Quoted
- Condition: `existingWorkshopId && workshopStatus === 'pickup'`
- Sets status to `'to_be_quoted'`
- Shows pickup submission modal

### To Be Quoted → Docket Ready
- Condition: `existingWorkshopId && workshopStatus === 'to_be_quoted'`
- Sets status to `'docket_ready'`
- Includes docket info in submission

## Form Validation Rules

### Required Fields
- **Product Name**: Always required
- **Customer Name**: Always required
- **Location of Repair**: Always required
- **Site Location**: Required when `locationOfRepair === 'Site'`
- **Pickup Schedule**: Required when `isPickupScheduleRequired` (new jobs with Site location)

### Pickup Schedule Requirements
- Required for: `(workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site'`
- Minimum datetime: Current date/time
- Optional for all other cases

## Modal Behavior

### Success Modals
| Scenario | Modal Type | Navigation |
|----------|------------|-----------|
| New pickup job created | Pickup Status Change Modal | Forces workshop board navigation |
| Pickup job submitted | Pickup Submission Modal | User chooses navigation |
| Regular updates | Success Modal | User closes modal |
| New job creation | Post-Submission Modal | User chooses next action |

### Incomplete Contact Modal
- Shows when user tries to submit with incomplete contact information
- Options: Clear incomplete contact or go back to editing
- Prevents form submission until resolved

## Priority System
Jobs are evaluated in priority order (lower number = higher priority):
1. **Pickup Status Jobs** - Highest priority
2. **New Jobs** - Brand new saved jobs
3. **Brand New Forms** - Forms with no existing workshop
4. **To Be Quoted Jobs** - Jobs ready for quoting
5. **Completed Jobs** - Quoted/repaired jobs
6. **Other Jobs** - Default fallback

## Section Expansion Behavior

### Auto-collapse Logic
- Machine Info and User Info sections auto-collapse for non-new workshops
- Optional Contacts section starts collapsed for all statuses
- Sections can be manually expanded/collapsed by users

## Special Entry Points

### Camera Entry
- Detected via URL parameter `from=camera` or referrer containing `/workshop/camera`
- Sets `startedWith = 'camera'`
- Shows camera emoji in status pills
- Provides tip about adding site location later

### Existing Workshop Loading
- Detected via URL parameter `workshop_id`
- Loads existing workshop data from database
- Populates all form fields with existing data
- Handles existing photos differently (marks as `isExisting: true`)
