# WhatsApp Cloud API setup

The website integration supports two flows:

- Messages sent to the business WhatsApp number receive a short automatic reply through a signed Meta webhook.
- Website service inquiries receive a WhatsApp confirmation only when the person enters a WhatsApp number and checks the consent box. The business-initiated confirmation uses an approved template.

The job application page currently opens the visitor's email app; it does not submit an application to the website and does not send an application confirmation.

## 1. Find the correct IDs and create a test message

In Meta for Developers, open the **People Pursuit** app and go to **Use cases → Connect with customers through WhatsApp → API Setup** (the exact menu label can vary).

- Use the **Phone Number ID** shown in WhatsApp API Setup for `WHATSAPP_PHONE_NUMBER_ID`. The App ID is not the Phone Number ID.
- Use the test number and a verified recipient to check Meta's sample send first.
- Create or connect the People Pursuit WhatsApp Business account and business phone number before production use.

## 2. Create and approve the inquiry template

In WhatsApp Manager, create a utility template with:

- Name: `website_inquiry_confirmation`
- Language: `English (US)` (`en_US`)
- Body: `Thanks for contacting People Pursuit. We received your inquiry and will be in touch soon.`
- No variables

Wait for Meta to approve it. The site sends this template only after an inquiry submitter explicitly opts in. Do not send messages to people who have not agreed to receive them.

## 3. Add Vercel environment variables

Set these in the Vercel project settings for the environment you are deploying:

- `WHATSAPP_ACCESS_TOKEN`: a server-side access token with the required WhatsApp permissions. Use a production/system-user token for production, not a temporary setup token.
- `WHATSAPP_PHONE_NUMBER_ID`: the business phone number ID from API Setup.
- `WHATSAPP_GRAPH_API_VERSION`: a currently supported version from Meta's API Setup/documentation, in the form `vNN.0`.
- `WHATSAPP_APP_SECRET`: the app secret from **App settings → Basic**; keep it private.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: a random secret value you create and use for both Vercel and Meta's webhook verification.
- `WHATSAPP_TEMPLATE_NAME`: `website_inquiry_confirmation`.
- `WHATSAPP_TEMPLATE_LANGUAGE`: `en_US`.

Never put these values in browser code or commit them to the repository. Redeploy after setting or changing environment variables.

## 4. Configure the Meta webhook

After deploying the site, in Meta's WhatsApp webhook configuration set:

- Callback URL: `https://YOUR_DEPLOYED_DOMAIN/api/whatsapp-webhook`
- Verify token: the same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Subscribe to the `messages` field

The endpoint verifies Meta's `X-Hub-Signature-256` using the app secret. It sends a simple reply to incoming messages for the configured business number. Replies to inbound chats are sent within the customer-service window opened by the person's message.

## 5. Test both flows

1. Use Meta's test recipient to send an inbound message to the business/test number and confirm the automatic reply.
2. Submit the website inquiry with a phone number in international format (for example `+91...`) and check the WhatsApp consent box.
3. Confirm the approved template confirmation arrives. Submit without consent and confirm no WhatsApp message is sent.
4. Check Vercel function logs and Meta's WhatsApp API dashboard for delivery errors.

The endpoint reports when an inquiry is received but its WhatsApp confirmation cannot be sent. Meta acceptance is not proof of final delivery; use delivery-status webhooks if delivery tracking is needed.
