(function () {
  var carousel = document.querySelector("[data-contact-carousel]");
  if (!carousel) return;

  var image = carousel.querySelector("[data-carousel-image]");
  var count = carousel.querySelector("[data-carousel-count]");
  var previousButton = carousel.querySelector("[data-carousel-previous]");
  var nextButton = carousel.querySelector("[data-carousel-next]");
  var toggleButton = carousel.querySelector("[data-carousel-toggle]");
  var toggleIcon = toggleButton.querySelector("i");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var slides = [
    {
      src: "assets/img/people-pursuit-launch.png",
      alt: "People Pursuit launch announcement celebrating our mission to connect talent and opportunity."
    },
    {
      src: "assets/img/contact-carousel/team-planning.jpg",
      alt: "Colleagues collaborating around a laptop in a workplace."
    },
    {
      src: "assets/img/contact-carousel/collaborative-team.jpg",
      alt: "A team working together around a table."
    },
    {
      src: "assets/img/contact-carousel/team-training.jpg",
      alt: "Colleagues taking part in a workplace learning session."
    },
    {
      src: "assets/img/contact-carousel/team-meeting.jpg",
      alt: "A group of colleagues sharing ideas in a meeting."
    },
    {
      src: "assets/img/contact-carousel/office-team.jpg",
      alt: "Coworkers working together in a bright office."
    },
    {
      src: "assets/img/contact-carousel/team-discussion.jpg",
      alt: "A team having a collaborative discussion."
    },
    {
      src: "assets/img/contact-carousel/workshop-team.jpg",
      alt: "Colleagues working together during a team workshop."
    },
    {
      src: "assets/img/contact-carousel/business-meeting.jpg",
      alt: "Professionals meeting around a table."
    },
    {
      src: "assets/img/contact-carousel/office-collaboration.jpg",
      alt: "Coworkers collaborating in a modern workspace."
    },
    {
      src: "assets/img/contact-carousel/modern-office.jpg",
      alt: "A contemporary office workspace."
    },
    {
      src: "assets/img/contact-carousel/office-interior.jpg",
      alt: "A welcoming office interior with shared work areas."
    },
    {
      src: "assets/img/contact-carousel/workspace-team.jpg",
      alt: "A shared workplace designed for collaboration."
    },
    {
      src: "assets/img/contact-carousel/office-design.jpg",
      alt: "A thoughtfully designed modern office."
    },
    {
      src: "assets/img/contact-carousel/professional-team.jpg",
      alt: "Professionals connecting and working together."
    }
  ];
  var activeIndex = 0;
  var timer;
  var transitionTimer;
  var pointerInside = false;
  var focusInside = false;
  var inView = false;
  var paused = reducedMotion.matches;

  function updateToggle() {
    var label = paused ? "Start slideshow" : "Pause slideshow";
    toggleButton.setAttribute("aria-label", label);
    toggleButton.title = label;
    toggleIcon.className = paused ? "lni lni-play" : "lni lni-pause";
  }

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    window.clearTimeout(transitionTimer);
    image.classList.add("is-changing");
    transitionTimer = window.setTimeout(function () {
      image.src = slides[activeIndex].src;
      image.alt = slides[activeIndex].alt;
      count.textContent = (activeIndex + 1) + " / " + slides.length;
      image.classList.remove("is-changing");
    }, 140);
  }

  function stopRotation() {
    window.clearInterval(timer);
    timer = null;
  }

  function startRotation() {
    stopRotation();
    if (!paused && !document.hidden && inView && !pointerInside && !focusInside) {
      timer = window.setInterval(function () {
        showSlide(activeIndex + 1);
      }, 3000);
    }
  }

  previousButton.addEventListener("click", function () {
    showSlide(activeIndex - 1);
  });

  nextButton.addEventListener("click", function () {
    showSlide(activeIndex + 1);
  });

  toggleButton.addEventListener("click", function () {
    paused = !paused;
    if (!paused) {
      pointerInside = false;
      focusInside = false;
    }
    updateToggle();
    startRotation();
  });

  carousel.addEventListener("mouseenter", function () {
    pointerInside = true;
    stopRotation();
  });
  carousel.addEventListener("mouseleave", function () {
    pointerInside = false;
    startRotation();
  });
  carousel.addEventListener("focusin", function () {
    focusInside = true;
    stopRotation();
  });
  carousel.addEventListener("focusout", function (event) {
    focusInside = carousel.contains(event.relatedTarget);
    if (!focusInside) startRotation();
  });
  document.addEventListener("visibilitychange", startRotation);
  reducedMotion.addEventListener("change", function (event) {
    paused = event.matches;
    updateToggle();
    startRotation();
  });

  updateToggle();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      startRotation();
    }, { threshold: 0.15 }).observe(carousel);
  } else {
    inView = true;
    startRotation();
  }
}());
