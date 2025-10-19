# Admin Panel - Quick Start Guide

## 📋 TL;DR - Setup in 3 Steps

### Step 1: Create Admin API Key with Users Scope
From https://cloud.appwrite.io/console:
1. Go to **Settings** (bottom left) → **API Keys**
2. Click **Create API Key**
3. **IMPORTANT**: Enable these scopes:
   - ✅ `users.read`
   - ✅ `users.write`
4. Click **Create**
5. Copy the **entire key** (it's very long!)

### Step 2: Get User ID
From https://cloud.appwrite.io/console:
1. Go to **Auth** → **Users**
2. Find your user account
3. Copy the **User ID**

### Step 3: Install Node Appwrite SDK
```bash
npm install -g node-appwrite
# OR add to your project dependencies
npm install node-appwrite
```

### Step 4: Run Setup Script
```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons
node scripts/setAdminLabel.js YOUR_USER_ID YOUR_API_KEY
```

**Example:**
```bash
node scripts/setAdminLabel.js 68d28b6b0028ea8966c9 standard_929c5f632b2d4e1e4e787dddb6e4fa2dfc185d1ed56c573ed8e8b563790cfa6bf2b380eb0ab45875053a1c69c00e970e34e4bb9d21f076149e3ea04b7b22bf38427d9e05c74c3c7168618f5894b628a3c76c0987f7a4926ed853640637da1eb0e799a1a7b85ddc44933d2b6318e9a93fc9e14ab9bec7b1b579233adc7f490acd
```

Done! Your user is now admin. You should see: ✅ User is now an admin!

---

## 🎯 Using the Admin Panel

### Access the Panel
1. Start the app: `cd langgraph-agent && ./start.sh`
2. Login with your admin account
3. Click your profile → **Admin Panel**
4. Or go to: `http://localhost:3000/admin`

### View SOWs
- See all SOWs (draft, review, published)
- Click any SOW to see full details
- Status shown as badge

### View Details
- Click SOW to see: JSON view, Markdown view, Lesson templates
- Expand templates to see individual cards
- View cards with JSON or Markdown

### Publish Content
- Click **Publish** button (red/blue button on SOW or template)
- Confirm in dialog
- Status changes to ✓ published
- Button disappears (already published)

---

## 📁 File Locations

### Setup
```
scripts/setAdminLabel.js        ← Run this script (JavaScript version)
scripts/setAdminLabel.ts        ← TypeScript version (optional)
```

### Admin Panel Route
```
/admin                          ← Main admin page
/admin/sow/[id]               ← Individual SOW view
```

### Components
```
components/admin/              ← All admin UI components
  ├── JsonViewer.tsx
  ├── MarkdownPreview.tsx
  ├── SOWListView.tsx
  ├── SOWDetailView.tsx
  └── LessonTemplateCard.tsx
```

### Backend
```
lib/appwrite/driver/
  ├── AuthoredSOWDriver.ts     ← Extended with admin methods
  └── LessonDriver.ts          ← Extended with admin methods

lib/utils/
  ├── adminCheck.ts            ← Auth utilities
  └── jsonToMarkdown.ts        ← JSON→Markdown conversion
```

---

## 🔍 Troubleshooting

### "Admin Panel" not in menu?
- User doesn't have admin label
- Run `setAdminLabel.js` script
- Clear browser cache (Cmd+Shift+R)

### Can't run setAdminLabel.js?
- Make sure `node-appwrite` is installed: `npm install -g node-appwrite`
- Make sure API key has "Users" scope
- Verify userId is correct (copy from Appwrite console exactly)
- Verify API key is correct (it's very long!)
- Set environment if using custom Appwrite:
  ```bash
  export APPWRITE_API_ENDPOINT=https://your-endpoint.com/v1
  export APPWRITE_PROJECT_ID=your_project_id
  ```

### Access denied to `/admin`?
- User redirected to dashboard = not admin
- Run setup script again
- Check that label was added: `setAdminLabel.js` should say "✅ User is now an admin!"

### JSON viewer not rendering?
- Check browser console for errors
- Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
- Try different browser

### Markdown preview looks wrong?
- Normal - some formatting may differ
- Use JSON view for accurate data inspection

---

## ⚡ Common Tasks

### Publish a SOW
1. Go to `/admin`
2. Find SOW in list
3. Click **Publish** button
4. Confirm dialog
5. Done! Status now shows as published

### View SOW in Markdown
1. Click SOW in list
2. Click **Markdown** tab
3. See structured markdown view
4. Copy text if needed

### Inspect Lesson Template
1. Click SOW detail link
2. Scroll to "Associated Lesson Templates"
3. Click template card to expand
4. Click **JSON** or **Markdown** to toggle view

### Publish a Lesson Template
1. Expand template card (see above)
2. Click **Publish** button
3. Confirm dialog
4. Done!

---

## 🎨 UI Quick Reference

### Colors & Badges
- **Green** = Published ✓
- **Gray** = Draft
- **Blue** = Review

### Buttons
- **Publish** = Click to publish (changes status)
- **Back** = Go back to list
- **JSON/Markdown** = Toggle view

### Views
- **JSON**: Syntax-highlighted code
- **Markdown**: Formatted document preview

---

## 🔒 Remember

- Only admins can see `/admin`
- Only admins can publish
- Publishing can't be undone (no delete/unpublish yet)
- All data is read-only except publish button

---

## 📞 Need Help?

See full documentation: `ADMIN_PANEL_SETUP.md`
See implementation details: `ADMIN_PANEL_IMPLEMENTATION_SUMMARY.md`
