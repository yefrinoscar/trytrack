# Expense API

Public API to create and delete expenses without a browser session.

- **Base URL**: `https://trytrack.underlabs.dev`
- **Path**: `/api/v1/expenses`
- **Auth**: shared key in the `EXPENSES_API_KEY` Worker secret
- **Key file (local)**: `secrets/expenses-api-key.txt`

## Authentication

Every request needs:

```http
Authorization: Bearer <EXPENSES_API_KEY>
```

Notes:

- The header must be `Authorization`. `x-api-key` **does not work**.
- The prefix `Bearer ` is required, with a capital `B` and a single space.
- Comparison is constant-time; a wrong key always returns `401`.
- If `EXPENSES_API_KEY` is missing on the Worker, every request returns `503`
  so the endpoint can never run unprotected.

---

## POST /api/v1/expenses

Creates one expense.

### Request body

`Content-Type: application/json`

| Field         | Type   | Required | Rules                                                               |
| ------------- | ------ | -------- | ------------------------------------------------------------------- |
| `email`       | string | yes      | Account that owns the expense. Lower-cased, then must match a user. |
| `amount`      | number | yes      | Finite and greater than `0`. Rounded to 2 decimals.                 |
| `currency`    | string | yes      | Exactly 3 letters. Upper-cased (`pen` → `PEN`).                     |
| `description` | string | yes      | Trimmed. Cannot be empty.                                           |
| `spentAt`     | string | yes      | `YYYY-MM-DD`.                                                       |
| `category`    | string | no       | Trimmed. Defaults to `API` when empty.                              |
| `merchant`    | string | no       | Trimmed. Omitted from the row when empty.                           |

### Example

```bash
curl -X POST https://trytrack.underlabs.dev/api/v1/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{
    "email": "you@example.com",
    "amount": 42.5,
    "currency": "PEN",
    "description": "Lunch",
    "category": "Food",
    "merchant": "Cafe",
    "spentAt": "2026-09-22"
  }'
```

### Responses

| Status | Body                                                                           | When                       |
| ------ | ------------------------------------------------------------------------------ | -------------------------- |
| `201`  | `{"ok":true,"id":"<expenseId>"}`                                               | Created                    |
| `400`  | `{"error":"Body must be valid JSON."}`                                         | Body is not JSON           |
| `401`  | `{"error":"Unauthorized."}`                                                    | Missing or wrong key       |
| `404`  | `{"error":"No account found for <email>."}`                                    | `email` matches no user    |
| `422`  | `{"error":"Validation failed.","fields":{...}}`                                | One or more fields invalid |
| `503`  | `{"error":"The expense API is disabled: EXPENSES_API_KEY is not configured."}` | Key not set on the Worker  |
| `204`  | _(empty)_                                                                      | `OPTIONS` preflight        |

> `405` is never returned in practice. Only `POST`, `DELETE` and `OPTIONS` are
> routed here; any other method (`GET`, `PUT`, `PATCH`) falls through to the
> app router and returns the HTML page with `200`.

`422` includes one entry per invalid field:

```json
{
  "error": "Validation failed.",
  "fields": {
    "amount": "Required. Must be a number greater than 0.",
    "currency": "Must be a 3-letter code, for example USD or PEN.",
    "spentAt": "Must use YYYY-MM-DD format."
  }
}
```

---

## DELETE /api/v1/expenses

Deletes expenses. Same key and header as `POST`.

### Mode A — one expense by id

```http
DELETE /api/v1/expenses?id=<expenseId>
```

| Status | Body                                         | When              |
| ------ | -------------------------------------------- | ----------------- |
| `200`  | `{"ok":true,"deleted":1}`                    | Deleted           |
| `404`  | `{"error":"No expense found with id <id>."}` | Id does not exist |

### Mode B — many by account + filter

```http
DELETE /api/v1/expenses?email=<account>&<filter>=<value>
```

| Query param   | Match                    | Example                             |
| ------------- | ------------------------ | ----------------------------------- |
| `spentAt`     | exact                    | `?spentAt=2026-09-22`               |
| `category`    | exact, case-sensitive    | `?category=Other`                   |
| `currency`    | exact, upper-cased first | `?currency=pen` → `PEN`             |
| `description` | exact                    | `?description=Compra%20en%20Amazon` |

All filters are **exact matches**, not partial. Combining them narrows the
result (logical AND).

| Status | Body                                                                                                   | When                                        |
| ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `200`  | `{"ok":true,"deleted":<n>}`                                                                            | Deleted `n` rows (`0` when nothing matched) |
| `404`  | `{"error":"No account found for <email>."}`                                                            | `email` matches no user                     |
| `422`  | `{"error":"Deleting by email needs at least one filter: spentAt, category, currency or description."}` | Filter missing                              |

### Response codes shared by both DELETE modes

| Status | Body                                                                        | When                           |
| ------ | --------------------------------------------------------------------------- | ------------------------------ |
| `401`  | `{"error":"Unauthorized."}`                                                 | Missing or wrong key           |
| `422`  | `{"error":"Provide ?id= to delete one expense, or ?email= plus a filter."}` | Neither `id` nor `email` given |
| `503`  | disabled message                                                            | Key not set on the Worker      |

### Bulk-delete safety

Deleting by `email` **requires at least one filter**. `?email=x` alone returns
`422`, so a typo cannot wipe every expense on the account.

### Email imports

When a deleted expense was created by confirming an email import, that import
is marked `dismissed` at the same time, so it stops counting and disappears
from the review list.

### Example

```bash
# Delete one
curl -X DELETE "https://trytrack.underlabs.dev/api/v1/expenses?id=abc123" \
  -H "Authorization: Bearer $KEY"

# Delete a whole day
curl -X DELETE "https://trytrack.underlabs.dev/api/v1/expenses?email=you@example.com&spentAt=2026-09-22" \
  -H "Authorization: Bearer $KEY"

# Delete a category
curl -X DELETE "https://trytrack.underlabs.dev/api/v1/expenses?email=you@example.com&category=Other" \
  -H "Authorization: Bearer $KEY"
```

---

## Common mistakes

| Symptom                           | Cause                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `401` with a key that looks right | Using `x-api-key` instead of `Authorization`                                                      |
| `401`                             | Missing the `Bearer ` prefix                                                                      |
| `401`                             | Key copied with a trailing newline (`echo` without `-n`)                                          |
| `401`                             | Signed in as another account in the app; the key is global, the `email` field selects the account |
| `404`                             | `email` does not match a registered account                                                       |
| `422`                             | `amount`, `currency`, `description` or `spentAt` missing or malformed                             |
| `503`                             | `EXPENSES_API_KEY` was never set on the Worker                                                    |

## Rotating the key

```bash
NEW="tk_$(openssl rand -hex 24)"
printf '%s' "$NEW" | npx wrangler secret put EXPENSES_API_KEY --name trytrack
printf '%s\n' "$NEW" > secrets/expenses-api-key.txt
```

The old key stops working immediately.

## Verified against production

| Case                          | Result                       |
| ----------------------------- | ---------------------------- |
| `POST` valid                  | `201`                        |
| `POST` invalid JSON           | `400`                        |
| `POST` missing fields         | `422`                        |
| `POST` unknown account        | `404`                        |
| `POST` with `x-api-key`       | `401`                        |
| `DELETE ?id=`                 | `200` `deleted:1`            |
| `DELETE ?id=` unknown         | `404`                        |
| `DELETE` no key               | `401`                        |
| `DELETE` no id/email          | `422`                        |
| `DELETE ?email=` no filter    | `422`                        |
| `DELETE` filter with no match | `200` `deleted:0`            |
| `OPTIONS`                     | `204`                        |
| `GET` / `PUT` / `PATCH`       | `200` HTML (app fallthrough) |
