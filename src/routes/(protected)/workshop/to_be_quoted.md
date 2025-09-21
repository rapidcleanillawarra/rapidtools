# Workshop Status: "To Be Quoted" Conditions

## Overview
This document outlines the specific conditions and behavior of the workshop creation/edit page when the workshop status is "to_be_quoted".

## Page Title and Status Display
- **Page Title**: "Edit Workshop Job" (when existingWorkshopId exists)
- **Status Pill**: "To Be Quoted" (displayed as "To Be Quoted" in the status pill)

## Section Visibility and Behavior

### Form Sections
- **Machine Information Section**: Collapsed by default (auto-collapsed for non-new workshops)
- **User Information Section**: Collapsed by default (auto-collapsed for non-new workshops)
- **Optional Contacts Section**: Collapsed by default (auto-collapsed for non-new workshops)
- **Photos Section**: Always visible
- **Docket Info Section**: **VISIBLE** (shown for non-new, non-pickup workshops)

### Field States
- **Machine Information Fields**: All fields remain editable (not disabled like pickup status)
  - Location of Repair radios: Enabled
  - Product Name: Enabled (required)
  - Client's Work Order: Enabled
  - Make/Model: Enabled
  - Serial Number: Enabled
  - Site/Location: Enabled (required when location is "Site")
  - Pickup Schedule: Enabled
  - Fault Description: Enabled

- **User Information Fields**: All fields remain editable
  - Customer Name (Maropost): Enabled (required)
  - Contact Email: Enabled
  - Contact Number: Enabled

- **Optional Contacts**: Fully editable and expandable

- **Photos**: Fully functional (add, remove, view)

### Docket Info Section (Newly Available)
When status is "to_be_quoted", the following docket fields become available:
- **Quote or Repair**: Radio buttons (Quote/Repair) - Section background changes color based on selection
  - **Purple background** (`bg-purple-100`) when "Quote" is selected
  - **Green background** (`bg-green-100`) when "Repair" is selected
- **Quote Description**: Textarea
- **Additional Information**: Textarea
- **Stock On Hand**: Text input
- **Labour**: Text input
- **Travel Time**: Text input
- **Call out**: Text input
- **Parts**: Dynamic list with SKU and Quantity fields (can add/remove rows)

## Button Behavior

### Submit Button
- **Text**: "Docket Ready" (for all existing workshops on page load)
- **Action**: Calls `handleSubmit()` function
- **Purpose**: Ready for docket preparation/finalization
- **Loading Text**: "Processing..."

### Update Job Button
- **Text**: "Update Job"
- **Action**: Calls `handleUpdateJob()` function
- **Purpose**: Save changes without status transitions or order creation
- **Loading Text**: "Updating Job..."

### Cancel Button
- **Text**: "Cancel"
- **Action**: Navigate to workshop job status page

## Form Submission Logic
- **Maropost Order Creation**: Will create order if workshop doesn't already have an order_id
- **Status Transition**: No automatic status change on submit (stays "to_be_quoted")
- **Pickup Logic**: Not applicable (different from pickup submissions)

## Validation
- **Required Fields**: Product Name, Customer Name, Site Location (if location is "Site")
- **Photo Requirements**: Optional (minimum 0 required)
- **Docket Fields**: No specific validation requirements (can be empty)

## Key Differences from Other Statuses
- **vs "new"**: Has docket info section, sections auto-collapsed, submit button shows "Docket Ready", color-coded docket background
- **vs "pickup"**: Fields remain editable, no disabled styling, different button text
- **vs "in_progress"**: Can still edit all fields, different button behavior, color-coded docket background

## Visual Feedback
- **Color-coded docket section**: The entire docket info section changes background color based on the Quote/Repair selection
  - Purple background indicates "Quote" selection
  - Green background indicates "Repair" selection
- **Consistent button text**: All existing workshops show "Docket Ready" on page load for clear action indication

## Purpose
Workshops with "to_be_quoted" status are ready for the final docket preparation phase, where technicians can add quote details, parts information, and other service-related data before the job moves to completion.
