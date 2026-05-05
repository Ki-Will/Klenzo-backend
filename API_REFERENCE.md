# Klenzoo Backend API Reference

> All endpoints relative to `/backend/` base URL.  
> Authentication via HttpOnly cookies: `kz_at` (access token) and `kz_rt` (refresh token).  
> Content-Type: `application/json` for all POST/PATCH/PUT requests.

---

## 🔐 1. Authentication

### POST `/auth/login`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "string123"
}
```
**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "success": true
}
```
Sets HttpOnly cookies: `kz_at`, `kz_rt`

### POST `/auth/register`
**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "string123"
}
```
**Response (201):**
```json
{
  "message": "Registration successful",
  "success": true
}
```
After register, frontend auto-calls login to set cookies.

### POST `/auth/refresh`
No body required (reads `kz_rt` cookie).  
**Response (200):**
```json
{
  "accessToken": "eyJ..."
}
```
Refreshes `kz_at` cookie silently.

### GET `/auth/profile`
**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Alex Rivers",
  "phone": "+123456789",
  "avatar": "https://...",
  "isActive": true,
  "lastLogin": "2024-01-15T10:30:00Z"
}
```

### POST `/auth/profile/update`
**Request:**
```json
{
  "name": "New Name",
  "phone": "+987654321"
}
```
**Response (200):** Same as profile.

### POST `/auth/logout`
No body. Clears `kz_at` + `kz_rt` cookies.  
**Response (200):**
```json
{
  "success": true
}
```

### POST `/auth/forgot-password`
**Request:**
```json
{
  "email": "user@example.com"
}
```
**Response (200):**
```json
{
  "message": "Reset link sent"
}
```

### POST `/auth/reset-password`
**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "newPassword123"
}
```
**Response (200):**
```json
{
  "message": "Password reset successful"
}
```

### GET `/auth/sessions`
**Response (200):**
```json
[
  {
    "id": "session-uuid",
    "device": "Chrome on macOS",
    "location": "Kigali, Rwanda",
    "lastSeen": "2024-03-15T08:00:00Z",
    "isCurrent": true
  }
]
```

### POST `/auth/sessions/:id/revoke`
**Response (200):**
```json
{
  "success": true
}
```

---

## 💰 2. Finance

### GET `/finance/transactions/:userId`
**Response (200):**
```json
[
  {
    "id": 1,
    "userId": 1,
    "amount": 1299.00,
    "description": "Apple Store",
    "category": "shopping",
    "transactionType": "expense",
    "date": "2024-03-15T14:30:00Z",
    "createdAt": "2024-03-15T14:30:05Z"
  }
]
```
`transactionType` values: `"expense"` | `"income"`  
`category` values: `"dining"`, `"shopping"`, `"travel"`, `"utilities"`, `"fun"`, `"other"`, `"food"`, `"bills"`, `"entertainment"`, `"income"`, `"salary"`, `"payroll"`, `"health"`, `"retail"`, `"transport"`

### POST `/finance/transactions`
**Request:**
```json
{
  "userId": 1,
  "amount": 84.20,
  "description": "The Alchemist Bar",
  "category": "dining",
  "transactionType": "expense",
  "date": "2024-03-15T19:00:00Z"
}
```
**Response (201):** Same shape as transaction object above.

### GET `/finance/transactions/:id`
**Response (200):** Single transaction object.

### DELETE `/finance/transactions/:id`
**Response (204):** No content.

### GET `/finance/analytics/categories`
**Response (200):**
```json
[
  {
    "category": "dining",
    "amount": 2450.00,
    "percentage": 35,
    "count": 42
  },
  {
    "category": "shopping",
    "amount": 1800.00,
    "percentage": 25,
    "count": 18
  }
]
```
Sorted by amount descending. Frontend uses top 5.

### GET `/finance/groups`
**Response (200):**
```json
[
  {
    "id": "flatmates",
    "name": "Flatmates",
    "members": [
      {
        "id": 1,
        "name": "Alex",
        "email": "alex@example.com",
        "avatar": "https://..."
      },
      {
        "id": 2,
        "name": "Priya",
        "email": "priya@example.com"
      }
    ],
    "netBalance": -125.00,
    "createdAt": "2024-01-10T00:00:00Z"
  }
]
```
`netBalance` positive = you are owed; negative = you owe.

### GET `/finance/groups/:id`
**Response (200):** Single group with full member details.

### POST `/finance/groups`
**Request:**
```json
{
  "name": "Vacation 2025"
}
```
**Response (201):** Group object.

---

## ✅ 3. Habits

### GET `/habits`
**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Deep Meditation",
    "description": "20 Minutes / Session",
    "frequency": "daily",
    "currentStreak": 12,
    "longestStreak": 21,
    "lastCompletedDate": "2024-03-14T08:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```
`frequency` values: `"daily"` | `"weekly"`  
`lastCompletedDate` is `null` if never completed.

### POST `/habits`
**Request:**
```json
{
  "name": "Morning Yoga",
  "description": "30 min flow",
  "frequency": "daily"
}
```
**Response (201):** Habit object.

### POST `/habits/:id/complete`
**Response (200):**
```json
{
  "id": 1,
  "name": "Deep Meditation",
  "currentStreak": 13,
  "longestStreak": 21,
  "lastCompletedDate": "2024-03-15T08:00:00Z",
  "...": "..."
}
```
Completing a habit for today. Should increment streak if last completion was yesterday (daily) or last week (weekly).

### DELETE `/habits/:id`
**Response (204):** No content.

---

## 🔔 4. Notifications

### GET `/notifications`
**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Sarah added an expense",
    "body": "Weekly Groceries — $180.00 in Flatmates",
    "type": "group",
    "read": false,
    "createdAt": "2024-03-15T14:28:00Z"
  }
]
```
`type` values: `"group"`, `"spending"`, `"security"`, `"ai"`, `"warning"`, `"default"`

### POST `/notifications/:id/read`
**Response (204):** No content.

### DELETE `/notifications/:id`
**Response (204):** No content.

### POST `/notifications/read-all`
**Response (204):** No content.

---

## 📋 5. Productivity (Tasks)

### GET `/productivity/tasks`
**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Design System Overhaul",
    "description": "Integrate semantic tokens",
    "status": "in_progress",
    "dueDate": "2024-03-12T00:00:00Z",
    "priority": 3,
    "createdAt": "2024-02-01T00:00:00Z"
  }
]
```
`status` values: `"todo"` | `"in_progress"` | `"done"` | `"cancelled"`  
`priority` values: `1` = Low, `2` = Standard, `3` = High, `4` = Critical

### POST `/productivity/tasks`
**Request:**
```json
{
  "title": "New Feature Design",
  "description": "Optional details",
  "status": "todo",
  "priority": 2,
  "dueDate": "2024-03-20T00:00:00Z"
}
```
**Response (201):** Task object.

### PATCH `/productivity/tasks/:id`
**Request:**
```json
{
  "status": "in_progress",
  "priority": 3
}
```
All fields optional. **Response (200):** Updated task object.

### DELETE `/productivity/tasks/:id`
**Response (204):** No content.

---

## 📣 6. Banners (User-facing)

### GET `/banners/active`
Returns only active banners (where `active === true` and within date range).  
**Response (200):**
```json
[
  {
    "id": 1,
    "message": "System maintenance scheduled for Sunday 2 AM UTC",
    "color": "warning",
    "active": true,
    "dismissible": true,
    "link": "/settings",
    "linkText": "Learn More",
    "startDate": "2024-03-14T00:00:00Z",
    "endDate": "2024-03-17T00:00:00Z"
  }
]
```
`color` values: `"info"` | `"success"` | `"warning"` | `"error"`  
`dismissible`: if true, users can hide the banner (frontend persists in localStorage).  
`link` + `linkText`: optional CTA button.

---

## 🛡️ 7. Admin

> All admin endpoints require `kz_at` cookie with admin/superadmin role.

### GET `/admin/stats`
**Response (200):**
```json
{
  "totalUsers": 24891,
  "activeUsers": 1204,
  "totalTransactions": 142530,
  "transactionVolume": 4200000,
  "activeSessions": 387,
  "systemHealth": 99.9,
  "userGrowth": 8.2,
  "revenueGrowth": 12.5,
  "monthlyRevenue": [30000, 45000, 35000, 60000, 55000, 75000, 65000, 80000, 70000, 90000, 85000, 95000]
}
```
- `transactionVolume`: total USD volume (not cents)
- `userGrowth`: percentage change (positive = growth)
- `revenueGrowth`: percentage change
- `monthlyRevenue`: array of 12 values (Jan→Dec) in USD

### GET `/admin/users?page=1&limit=100&search=alex`
**Response (200):**
```json
{
  "users": [
    {
      "id": 1,
      "email": "alex@klenzoo.com",
      "name": "Alex Rivers",
      "isActive": true,
      "role": "user",
      "lastLogin": "2024-03-15T10:30:00Z",
      "createdAt": "2024-01-15T00:00:00Z",
      "transactionCount": 342,
      "totalVolume": 18500
    }
  ],
  "total": 24891
}
```
`role` values: `"user"`, `"admin"`, `"superadmin"`  
Query params: `page` (default 1), `limit` (default 50), `search` (matches email or name, optional)

### POST `/admin/users/:id/toggle-active`
**Request:**
```json
{
  "active": false
}
```
**Response (200):**
```json
{
  "success": true
}
```

### DELETE `/admin/users/:id`
**Response (200):**
```json
{
  "success": true
}
```
⚠️ Cannot delete superadmins or self.

### GET `/admin/admins`
**Response (200):**
```json
[
  {
    "id": 1,
    "email": "root@klenzoo.com",
    "name": "System Root",
    "role": "superadmin",
    "isActive": true,
    "lastLogin": "2024-03-15T08:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### POST `/admin/admins`
**Request:**
```json
{
  "email": "newadmin@klenzoo.com",
  "password": "secure123",
  "name": "New Admin",
  "role": "admin"
}
```
`role` values: `"admin"` | `"superadmin"`  
**Response (201):** AdminUser object.  
⚠️ Only superadmin can create other superadmins.

### DELETE `/admin/admins/:id`
**Response (200):**
```json
{
  "success": true
}
```
⚠️ Cannot delete superadmin or self.

### POST `/admin/broadcast`
**Request:**
```json
{
  "message": "New feature: AI spending insights are now live!",
  "color": "success",
  "dismissible": true,
  "link": "/analytics",
  "linkText": "Try Now",
  "startDate": "2024-03-15T00:00:00Z",
  "endDate": "2024-03-22T00:00:00Z"
}
```
**Response (201):** Banner object.  
`startDate`/`endDate` optional — if omitted, banner is active immediately/indefinitely.

### GET `/admin/broadcast`
**Response (200):**
```json
[
  {
    "id": 1,
    "message": "System maintenance scheduled",
    "color": "warning",
    "active": true,
    "dismissible": true,
    "link": null,
    "linkText": null,
    "startDate": "2024-03-14T00:00:00Z",
    "endDate": "2024-03-17T00:00:00Z"
  }
]
```
Returns ALL broadcasts (active and inactive). Admin can see history.

### DELETE `/admin/broadcast/:id`
**Response (200):**
```json
{
  "success": true
}
```
Deactivates/removes the broadcast permanently.

---

## 📐 Error Response Format

All errors return appropriate HTTP status codes with this shape:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

Or for validation errors (422):

```json
{
  "statusCode": 422,
  "message": ["Email is required", "Password must be at least 8 characters"]
}
```

The frontend handles array messages by joining them: `"Email is required, Password must be at least 8 characters"`.

---

## 🍪 Cookie Configuration

Backend should set cookies as follows:

| Cookie | Purpose | Attributes |
|--------|---------|------------|
| `kz_at` | Access token (JWT) | `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`, `Max-Age=900` (15 min) |
| `kz_rt` | Refresh token | `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/backend/auth`, `Max-Age=604800` (7 days) |

The proxy (`src/proxy.ts`) checks for `kz_at` presence on protected routes.

---

## 🚦 Priority Order for Implementation

1. **Auth** (`/auth/*`) — Required for everything else
2. **Finance transactions** — Core app feature
3. **Habits** — Standalone feature
4. **Productivity (Tasks)** — Standalone feature
5. **Notifications** — Works with seed data if API unavailable
6. **Groups** — Optional social feature
7. **Admin** — Required for platform control
8. **Banners** — Admin broadcasts + user banner display