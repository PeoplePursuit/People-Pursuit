(() => {
  const phoneNumber = "919964757111";
  const message = "Hello, People Pursuit. I would like to know more about your services.";
  const icon = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16.04 3C8.88 3 3.06 8.78 3.06 15.9c0 2.28.61 4.5 1.77 6.47L3 29l6.83-1.78a13.1 13.1 0 0 0 6.2 1.57h.01c7.16 0 12.98-5.78 12.98-12.89 0-3.45-1.35-6.69-3.81-9.13A12.91 12.91 0 0 0 16.04 3Zm0 23.6h-.01c-1.9 0-3.76-.51-5.39-1.48l-.39-.23-4.05 1.06 1.08-3.93-.25-.4a10.63 10.63 0 0 1-1.65-5.72c0-5.88 4.8-10.66 10.68-10.66 2.85 0 5.53 1.11 7.55 3.12a10.56 10.56 0 0 1 3.13 7.54c0 5.88-4.8 10.66-10.68 10.66Zm5.86-7.98c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.51-.16-.73.16-.21.32-.84 1.05-1.03 1.27-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.6-1.6-.96-.85-1.61-1.9-1.8-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.22.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.1 1.32 3.32c.16.21 2.28 3.47 5.53 4.86.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.14-.3-.22-.62-.38Z"/></svg>';

  const dialog = document.createElement("dialog");
  dialog.className = "whatsapp-chat-dialog";
  dialog.id = "whatsapp-chat-dialog";
  dialog.setAttribute("aria-labelledby", "whatsapp-dialog-title");
  dialog.innerHTML = `
    <div class="whatsapp-dialog-heading">
      <div>
        <p>CHAT WITH PEOPLE PURSUIT</p>
        <h2 id="whatsapp-dialog-title">Start a WhatsApp chat</h2>
      </div>
      <button class="whatsapp-dialog-close" type="button" aria-label="Close dialog">&times;</button>
    </div>
    <p class="whatsapp-dialog-intro">Share your details and question. We’ll open WhatsApp with your message ready to send.</p>
    <form class="whatsapp-chat-form">
      <label for="whatsapp-name">Name</label>
      <input id="whatsapp-name" name="name" type="text" autocomplete="name" maxlength="120" required />
      <label for="whatsapp-email">Email address</label>
      <input id="whatsapp-email" name="email" type="email" autocomplete="email" maxlength="254" required />
      <label for="whatsapp-phone">Contact number</label>
      <input id="whatsapp-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" required />
      <label for="whatsapp-query">How can we help?</label>
      <textarea id="whatsapp-query" name="query" rows="3" maxlength="1500" required></textarea>
      <p class="whatsapp-chat-status" role="status" aria-live="polite"></p>
      <button class="whatsapp-chat-submit" type="submit">${icon}<span>Continue to WhatsApp</span></button>
    </form>`;

  const trigger = document.createElement("a");
  trigger.className = "whatsapp-chat-button";
  trigger.href = "#whatsapp-chat-dialog";
  trigger.setAttribute("aria-label", "Start a WhatsApp chat with People Pursuit");
  trigger.title = "Start a WhatsApp chat";
  trigger.innerHTML = icon;

  document.body.append(trigger, dialog);

  const form = dialog.querySelector(".whatsapp-chat-form");
  const status = dialog.querySelector(".whatsapp-chat-status");
  const closeButton = dialog.querySelector(".whatsapp-dialog-close");

  const openDialog = (event) => {
    event.preventDefault();
    status.textContent = "";
    dialog.showModal();
  };

  trigger.addEventListener("click", openDialog);
  document.querySelectorAll(".whatsapp-chat-trigger").forEach((link) => {
    link.addEventListener("click", openDialog);
  });

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const chatMessage = [
      "Hello, People Pursuit. I would like to get in touch.",
      `Name: ${formData.get("name")}`,
      `Email: ${formData.get("email")}`,
      `Contact number: ${formData.get("phone")}`,
      `Query: ${formData.get("query")}`,
    ].join("\n");
    const chatUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(chatMessage)}`;
    const fallbackLink = document.createElement("a");

    fallbackLink.href = chatUrl;
    fallbackLink.target = "_blank";
    fallbackLink.rel = "noopener noreferrer";
    fallbackLink.textContent = "If WhatsApp did not open, tap here to start your chat.";
    fallbackLink.className = "whatsapp-chat-fallback";

    window.open(chatUrl, "_blank", "noopener,noreferrer");
    status.replaceChildren("Your message is ready in WhatsApp. ", fallbackLink);
  });
})();
