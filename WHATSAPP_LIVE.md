# WhatsApp (Twilio) — Sandbox → Live Cutover

This project ships with a single WhatsApp sender at
`src/app/api/whatsapp/route.js`. It supports two modes:

| Mode      | Outbound messages                              | When to use                                           |
| --------- | ---------------------------------------------- | ----------------------------------------------------- |
| `sandbox` | Freeform text body + media attachment          | Local dev / Twilio WhatsApp sandbox number            |
| `live`    | **Content Template** (`contentSid` + vars)     | Production (approved WABA sender, real phone number)  |

Meta/WhatsApp rules: once you leave sandbox, any outbound message started by
the business (not a reply within the 24h customer-care window) **must** use a
pre-approved template. That's why live mode routes everything through Twilio
Content Templates.

---

## 1. Twilio Console — one-time setup

1. **Register a WhatsApp Business Account (WABA)** in the Twilio Console:
   `Messaging → Try it out → Send a WhatsApp Message → Senders / Register a WhatsApp sender`.
2. Complete business verification with Meta. Wait for approval.
3. Buy/port a phone number and attach it as the WhatsApp sender. This is your
   new production `from` number, in the form `whatsapp:+923001234567`.
4. Create the **Content Templates** listed below in
   `Messaging → Content Template Builder`. After Meta approves each one,
   copy its `HXxxxxxxxx` SID — that goes into the matching env var.

### Template variable convention

All templates used by this app should accept **four body variables**, in this
order (Twilio Content Builder lets you reference them as `{{1}}` … `{{4}}`):

| Placeholder | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| `{{1}}`     | Customer / supplier / recipient name                          |
| `{{2}}`     | Reference number (invoice, sale, order, payment, tab label)   |
| `{{3}}`     | Amount or item count (human readable, e.g. `PKR 12,500`)      |
| `{{4}}`     | Date (`YYYY-MM-DD`)                                           |

Each template should use a **DOCUMENT (PDF)** or **IMAGE** header. The API
uploads the generated PDF/image to Cloudinary and sends the URL on the
message as `mediaUrl`, which Twilio uses to fill the template's header.
Either `media[0]` type works — pick whichever your operations prefer.

### Templates to create

| `templateKey`             | Suggested template name        | Env var                                      |
| ------------------------- | ------------------------------ | -------------------------------------------- |
| `sale_receipt`            | `itefaq_sale_receipt`          | `TWILIO_CONTENT_SID_SALE_RECEIPT`            |
| `sale_return_receipt`     | `itefaq_sale_return_receipt`   | `TWILIO_CONTENT_SID_SALE_RETURN_RECEIPT`     |
| `purchase_receipt`        | `itefaq_purchase_receipt`      | `TWILIO_CONTENT_SID_PURCHASE_RECEIPT`        |
| `purchase_return_receipt` | `itefaq_purchase_return`       | `TWILIO_CONTENT_SID_PURCHASE_RETURN_RECEIPT` |
| `order_receipt`           | `itefaq_order_receipt`         | `TWILIO_CONTENT_SID_ORDER_RECEIPT`           |
| `finance_receipt`         | `itefaq_finance_receipt`       | `TWILIO_CONTENT_SID_FINANCE_RECEIPT`         |
| `stock_report`            | `itefaq_stock_report`          | `TWILIO_CONTENT_SID_STOCK_REPORT`            |
| `customer_list`           | `itefaq_customer_list`         | `TWILIO_CONTENT_SID_CUSTOMER_LIST`           |

### Example template body

For `sale_receipt` (utility category):

```
Hi {{1}}, your invoice {{2}} has been generated.
Amount: {{3}}
Date: {{4}}
Please find the receipt attached. — Itefaq Iron & Cement
```

Keep every template's body identical across apps so only `{{1}}..{{4}}` need
to be swapped at runtime.

---

## 2. Environment variables

Add to your production `.env` (Vercel / server / etc.):

```env
# Required for both modes
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+923001234567    # your approved sender

# Cloudinary (used to host the PDF/image for media header)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Force the mode (optional; auto-detected if omitted)
# TWILIO_WHATSAPP_MODE=live      # or `sandbox`

# Live-mode template SIDs (fill the ones you use)
TWILIO_CONTENT_SID_SALE_RECEIPT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_SALE_RETURN_RECEIPT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_PURCHASE_RECEIPT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_PURCHASE_RETURN_RECEIPT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_ORDER_RECEIPT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_FINANCE_RECEIPT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_STOCK_REPORT=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CONTENT_SID_CUSTOMER_LIST=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Mode auto-detection

`src/app/api/whatsapp/route.js` resolves the mode like this:

1. `TWILIO_WHATSAPP_MODE=sandbox|live` → forced.
2. `TWILIO_WHATSAPP_FROM === whatsapp:+14155238886` → `sandbox`.
3. Otherwise → `live` if any `TWILIO_CONTENT_SID_*` is set, else `sandbox`.

Set `TWILIO_WHATSAPP_MODE=sandbox` on dev/staging to keep using freeform
messages against the sandbox number without touching code.

---

## 3. How callers pass template info

Every page that sends WhatsApp has been updated to pass:

```js
fetch('/api/whatsapp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageBase64,                       // PNG receipt or PDF (datauristring)
    phone: '03001234567',
    bill: { /* sale / purchase / return / payment / report meta */ },
    caption: '…',                      // used in sandbox mode
    templateKey: 'sale_receipt',       // maps to env var above
    templateVariables: {               // stringified server-side
      1: 'Customer Name',
      2: 'INV-1234',
      3: 'PKR 12,500',
      4: '2026-04-23',
    },
  }),
});
```

If a legacy caller doesn't send `templateKey`, the API tries to infer one
from `bill.bill_type` / `bill.is_return` / `bill.sale_id` prefix
(`stock-…`, `store-stock-…`, `customers-…`). If it still can't resolve one
in live mode, the request fails with a clear error listing supported keys.

---

## 4. Test plan before flipping live

1. Run locally on sandbox (`TWILIO_WHATSAPP_MODE=sandbox`) and confirm each
   flow still sends freeform media as today.
2. In Twilio Console, use `Messaging → Try it → Send a test content template`
   to confirm each `HX…` SID renders the 4 variables correctly.
3. In staging, set `TWILIO_WHATSAPP_FROM` to your new production number,
   `TWILIO_WHATSAPP_MODE=live`, and fill all `TWILIO_CONTENT_SID_*`. Send one
   message from each flow (sale, sale return, purchase, purchase return,
   order, finance IN, finance OUT, stock report, store stock, customer list)
   to a real test phone opted in to receive business messages.
4. Inspect `Messaging → Monitor → Logs` for `errorCode`. Common failures:
   - `63016` Template not found → wrong SID in env var.
   - `63017` Paused / quality issue → Meta quality score dropped.
   - `63024` Variables don't match template → mismatch between `{{n}}`
     placeholders in the template and keys in `templateVariables`.
5. Once green, flip production env vars and deploy.

---

## 5. Extending

Adding a new template:

1. Add a new entry to `TEMPLATE_ENV_KEYS` in
   `src/app/api/whatsapp/route.js`.
2. Create the template in Twilio, grab its `HX…` SID, and set the new env
   var in production.
3. From the page that triggers it, pass `templateKey: '<new_key>'` and the
   four string variables.
