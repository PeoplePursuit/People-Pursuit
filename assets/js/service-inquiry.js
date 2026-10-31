(function () {
  var form = document.getElementById("service-inquiry-form");
  if (!form) return;

  var feedback = document.getElementById("inquiry-feedback");
  var submitButton = document.getElementById("inquiry-submit");
  var serviceTitle = document.getElementById("service-title");
  var serviceInput = document.getElementById("inquiry-service");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    feedback.className = "form-feedback";
    feedback.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    if (serviceTitle && serviceInput) {
      serviceInput.value = serviceTitle.textContent.trim();
    }

    var inquiry = Object.fromEntries(new FormData(form).entries());
    fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiry)
    })
      .then(function (response) {
        return response.json().catch(function () {
          throw new Error("The server returned an invalid response. Please try again later.");
        }).then(function (result) {
          if (!response.ok) {
            throw new Error(result.error || "We couldn’t send your inquiry. Please try again.");
          }
          window.location.assign("thank-you.html");
        });
      })
      .catch(function (error) {
        feedback.className = "form-feedback error";
        feedback.textContent = error.message;
      })
      .finally(function () {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit Inquiry <i class="lni lni-arrow-right" aria-hidden="true"></i>';
      });
  });
}());
