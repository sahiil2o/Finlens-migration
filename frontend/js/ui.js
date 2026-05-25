let loaderTimeout = null;

// ===============================
// LOADING OVERLAY
// ===============================

export function showLoader(
  message = "Loading..."
) {

  loaderTimeout = setTimeout(() => {

    let loader =
      document.getElementById(
        "global-loader"
      );

    if (!loader) {

      loader = document.createElement(
        "div"
      );

      loader.id = "global-loader";

      loader.innerHTML = `
        <div class="loader-box">

          <div class="loader-spinner"></div>

          <p id="loader-message">
            ${message}
          </p>

        </div>
      `;

      document.body.appendChild(loader);
    }

    const msg =
      document.getElementById(
        "loader-message"
      );

    if (msg) {
      msg.textContent = message;
    }

    loader.style.display = "flex";

  }, 150);
}

export function hideLoader() {

  clearTimeout(loaderTimeout);

  const loader =
    document.getElementById(
      "global-loader"
    );

  if (loader) {
    loader.style.display = "none";
  }
}

// ===============================
// TOASTS
// ===============================

export function showToast(
  message,
  type = "success"
) {

  const toast =
    document.createElement("div");

  toast.className =
    `toast toast-${type}`;

  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  setTimeout(() => {

    toast.classList.remove("visible");

    setTimeout(() => {
      toast.remove();
    }, 300);

  }, 3000);
}

// ===============================
// EMPTY STATES
// ===============================

export function showEmptyState(
  element,
  message
) {

  element.innerHTML = `
    <div class="empty-state">
      ${message}
    </div>
  `;
}