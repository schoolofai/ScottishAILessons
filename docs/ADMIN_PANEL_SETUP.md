# Admin Panel Setup Guide

This guide explains how to set up and use the new Admin Panel for reviewing and publishing Schemes of Work (SOWs) and lesson templates.

## Overview

The Admin Panel allows authorized administrators to:

- **View all SOWs** with their statuses (draft, review, published)
- **Inspect SOW JSON** with syntax-highlighted code viewer
- **Generate markdown** from SOW JSON hierarchy for documentation
- **View associated lesson templates** for each SOW
- **Preview lesson template cards** with their CFUs and pedagogy
- **Publish SOWs and lesson templates** with confirmation dialogs
- **Filter and search** through all available content

## Architecture

### Authentication & Authorization

The admin panel uses **Appwrite User Labels** for role management:

- **Admin users** have the `'admin'` label in their Appwrite user account
- **Non-admin users** are redirected to the dashboard if they try to access `/admin`
- Admin status is checked on component load using the `useIsAdmin()` hook

### Key Files

#### Backend Drivers
- `lib/appwrite/driver/AuthoredSOWDriver.ts` - Extended with admin methods:
  - `getAllSOWsForAdmin()` - Fetch all SOWs (all statuses)
  - `getSOWById()` - Get specific SOW by document ID
  - `publishSOW()` - Publish a SOW (change status to 'published')

- `lib/appwrite/driver/LessonDriver.ts` - Extended with admin methods:
  - `getTemplatesByCourseIdForAdmin()` - Fetch all templates for a course
  - `publishTemplate()` - Publish a lesson template

#### Utilities
- `lib/utils/adminCheck.ts` - Admin status checking
  - `isUserAdmin()` - Check if user has admin label
  - `useIsAdmin()` - React hook for admin status (with loading state)

- `lib/utils/jsonToMarkdown.ts` - JSON to Markdown conversion
  - Converts JSON hierarchy to structured markdown with sections

#### Components
- `components/admin/JsonViewer.tsx` - Syntax-highlighted JSON display
- `components/admin/MarkdownPreview.tsx` - Markdown rendering
- `components/admin/SOWListView.tsx` - List of all SOWs with publish buttons
- `components/admin/SOWDetailView.tsx` - Single SOW details with JSON/markdown
- `components/admin/LessonTemplateCard.tsx` - Expandable lesson template cards

#### Routes
- `app/(protected)/admin/page.tsx` - Main admin panel (`/admin`)
- `app/(protected)/admin/sow/[id]/page.tsx` - SOW detail view (`/admin/sow/[id]`)

## Setup Instructions

### Step 1: Install Dependencies

All required dependencies have been installed. If needed, run:

```bash
cd assistant-ui-frontend
npm install --legacy-peer-deps \
  react-syntax-highlighter \
  @types/react-syntax-highlighter \
  react-markdown \
  remark-gfm
```

### Step 2: Create API Key with Users Scope

You need an API key with proper permissions:

1. Go to https://cloud.appwrite.io/console
2. Click **Settings** (bottom left) → **API Keys**
3. Click **Create API Key**
4. **IMPORTANT**: Enable these scopes:
   - ✅ `users.read`
   - ✅ `users.write`
5. Click **Create** and copy the key

### Step 3: Create Admin User

Use the setup script to add the 'admin' label to a user:

```bash
# Install node-appwrite globally (one-time)
npm install -g node-appwrite

# Then run the setup script
node scripts/setAdminLabel.js <userId> <apiKey>
```

**Example:**
```bash
node scripts/setAdminLabel.js 6571c04c5c4a5d2e8f1e4a9b your_api_key_here
```

**Troubleshooting:**
- Make sure the API key has **both** `users.read` and `users.write` scopes
- Make sure you copied the **entire** API key (it's very long!)
- Get the userId from Appwrite console: Auth → Users → [Select User] → User ID
- If using custom Appwrite endpoint, set:
  ```bash
  export APPWRITE_API_ENDPOINT=https://your-endpoint.com/v1
  export APPWRITE_PROJECT_ID=your_project_id
  ```

### Step 4: Verify Admin Status

1. Start the application:
   ```bash
   cd langgraph-agent
   ./start.sh
   ```

2. Log in with the admin user account

3. You should see "Admin Panel" option in the user menu (top right)

4. Click "Admin Panel" to access `/admin`

## Usage

### Viewing SOWs

1. Navigate to `/admin` (Admin Panel link in user menu)
2. See list of all SOWs sorted by creation date
3. Each SOW shows:
   - Course name
   - Course ID and version
   - Number of lessons and total duration
   - Status badge (draft/review/published)
   - Publish button (if not published)

### Viewing SOW Details

1. Click on any SOW in the list
2. View SOW metadata in summary cards
3. Toggle between **JSON** and **Markdown** views:
   - **JSON View**: Syntax-highlighted JSON structure with indentation
   - **Markdown View**: Structured markdown with sections/subsections from JSON hierarchy
4. Scroll down to see associated lesson templates
5. Expand individual templates to inspect their details

### Viewing Lesson Templates

1. On the SOW detail page, scroll to "Associated Lesson Templates"
2. See all templates for that course, sorted by SOW order
3. Each template card shows:
   - Title and order number
   - Number of lesson cards
   - Estimated duration
   - Status badge
   - Publish button (if not published)

### Inspecting Template Details

1. Click the chevron to expand a template card
2. Choose **JSON** or **Markdown** view
3. **JSON View**: See complete template structure including decompressed lesson cards
4. **Markdown View**: See formatted markdown preview of all content

### Publishing Content

#### Publishing a SOW
1. On the admin panel or SOW detail page, click the **Publish** button
2. Confirm the action in the dialog
3. SOW status changes from draft/review to **published**
4. The template is now available in production

#### Publishing a Lesson Template
1. Expand the lesson template card on the SOW detail page
2. Click the **Publish** button
3. Confirm the action
4. Template status changes to **published**

## Features

### JSON to Markdown Conversion

The `jsonToMarkdown()` utility intelligently converts JSON to markdown:

```
{
  "metadata": {
    "course_name": "Application of Mathematics",
    "total_lessons": 12,
    "weeks": 18
  },
  "entries": [
    { "order": 1, "label": "Lesson 1" },
    { "order": 2, "label": "Lesson 2" }
  ]
}
```

Becomes:

```markdown
# Metadata

## Course Name
Application of Mathematics

## Total Lessons
12

## Weeks
18

# Entries

## Item 1
**Order:** 1
**Label:** Lesson 1

## Item 2
**Order:** 2
**Label:** Lesson 2
```

### Real-time Updates

- Publishing updates immediately in the UI
- Lists refresh automatically after publishing
- No page reload needed

### Error Handling

- Clear error messages displayed for failed operations
- Network errors logged to console
- Form validation prevents invalid operations

## Security Considerations

### Admin Access Control

- Only users with 'admin' label can access `/admin`
- Non-admin users attempting to access `/admin` are redirected to dashboard
- Admin check runs on every page load
- Authorization happens client-side before rendering

### Database Operations

- All database operations use authenticated Appwrite sessions
- Publish operations require confirmation dialogs
- Errors throw exceptions (no fallback patterns)
- Only admins can call `publishSOW()` and `publishTemplate()` methods

### Data Protection

- Markdown/JSON viewers are read-only
- No direct editing of SOW/template content
- Publishing is the only write operation available in admin panel

## Troubleshooting

### Admin Panel Link Not Showing

- Verify user has 'admin' label: Run `setAdminLabel.ts` script
- Clear browser cache and reload
- Check browser console for errors

### Can't Access `/admin` Route

- Non-admin users are redirected to dashboard
- Check that user has 'admin' label
- Verify middleware has `/admin` in protected routes

### JSON Viewer Not Loading

- Check browser console for errors
- Ensure `react-syntax-highlighter` is installed
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Markdown Preview Looks Wrong

- This is expected - some markdown features may not render perfectly
- Check the raw markdown by copying text
- JSON view is more reliable for inspecting data

### Publishing Fails

- Check browser console for error message
- Verify SOW/template exists in database
- Ensure you have write permissions
- Try refreshing the page and retrying

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Operations**
   - Publish multiple SOWs at once
   - Bulk status changes

2. **Search & Filter**
   - Filter by status (draft/review/published)
   - Search by course name or ID
   - Filter by date range

3. **Comments & Notes**
   - Leave comments on SOWs for review workflow
   - Attach notes to templates

4. **Approval Workflow**
   - Multi-step review process
   - Assign reviewers to SOWs
   - Approval notifications

5. **Diff Viewer**
   - Compare versions of SOWs
   - Highlight changes between versions

6. **Export Options**
   - Export SOWs as JSON files
   - Export lesson templates individually
   - Batch export multiple resources

## Testing Checklist

After setup, verify these functions:

- [ ] Admin user can see "Admin Panel" in user menu
- [ ] Non-admin users cannot access `/admin`
- [ ] Non-admin users are redirected when trying `/admin`
- [ ] Admin panel loads list of SOWs
- [ ] Can click SOW to view details
- [ ] JSON view shows syntax-highlighted code
- [ ] Markdown view generates from JSON hierarchy
- [ ] Can expand lesson template cards
- [ ] Publish button works and updates status
- [ ] After publishing, "Publish" button disappears
- [ ] Error messages appear for failed operations
- [ ] Back button navigates correctly
- [ ] Header admin link only shows for admins

## Support

For issues or questions:

1. Check console logs for error messages
2. Review database permissions in Appwrite console
3. Verify SOW/template data exists and is valid
4. Check that admin label is correctly applied to user
