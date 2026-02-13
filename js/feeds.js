(function () {
  const STORAGE_KEY = "fw_feed_v1";
  const MAX_MESSAGE = 500;

  const form = document.getElementById("fw-feed-form");
  const typeInput = document.getElementById("fw-feed-type");
  const titleInput = document.getElementById("fw-feed-title");
  const messageInput = document.getElementById("fw-feed-message");
  const locationInput = document.getElementById("fw-feed-location");
  const charCount = document.getElementById("fw-feed-char-count");
  const formError = document.getElementById("fw-feed-form-error");
  const listEl = document.getElementById("fw-feed-list");
  const emptyEl = document.getElementById("fw-feed-empty");
  const toastEl = document.getElementById("fw-feed-toast");

  if (!form || !typeInput || !messageInput || !listEl || !emptyEl) return;

  function readPosts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function savePosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  function postId() {
    return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function commentId() {
    return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function typeMeta(type) {
    if (type === "weather") return { label: "Weather Update", badge: "bg-info text-dark", icon: "fa-cloud" };
    if (type === "event") return { label: "Event Attendance", badge: "bg-warning text-dark", icon: "fa-calendar" };
    return { label: "Activity", badge: "bg-secondary text-light", icon: "fa-bolt" };
  }

  function formatLocal(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (_err) {
      return iso;
    }
  }

  function updateCounter() {
    if (!charCount) return;
    const count = (messageInput.value || "").length;
    charCount.textContent = count + "/" + MAX_MESSAGE;
  }

  function setFormError(text) {
    if (!formError) return;
    formError.textContent = text || "";
  }

  function showToast() {
    if (!toastEl) return;
    toastEl.classList.remove("d-none");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toastEl.classList.add("d-none");
    }, 2000);
  }
  showToast.timer = 0;

  function render() {
    const posts = readPosts().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    emptyEl.classList.toggle("d-none", posts.length > 0);
    listEl.innerHTML = "";

    posts.forEach(function (post) {
      const meta = typeMeta(post.type);
      const comments = Array.isArray(post.comments) ? post.comments : [];
      const safeTitle = escapeHtml(post.title || "");
      const safeMessage = escapeHtml(post.message || "");
      const safeLocation = escapeHtml(post.location || "");

      const item = document.createElement("article");
      item.className = "p-30 rounded-1 bg-dark border border-dark-subtle";
      item.setAttribute("data-post-id", post.id);

      const commentsHtml = comments
        .map(function (comment) {
          return (
            '<li class="mb-2"><div class="small">' +
            escapeHtml(comment.text) +
            '</div><div class="small text-muted">' +
            formatLocal(comment.createdAt) +
            "</div></li>"
          );
        })
        .join("");

      item.innerHTML =
        '<div class="d-flex justify-content-between align-items-start gap-3">' +
        '<div class="d-flex flex-column gap-2">' +
        '<span class="badge ' +
        meta.badge +
        '"><i class="fa ' +
        meta.icon +
        ' me-1" aria-hidden="true"></i>' +
        meta.label +
        "</span>" +
        '<div class="small text-muted">' +
        formatLocal(post.createdAt) +
        "</div>" +
        "</div>" +
        '<button class="btn-main btn-line btn-small fw-feed-delete" type="button" aria-label="Delete post">' +
        '<span><i class="fa fa-trash me-1" aria-hidden="true"></i>Delete</span></button>' +
        "</div>" +
        (safeTitle ? '<h4 class="mt-3 mb-2">' + safeTitle + "</h4>" : "") +
        '<p class="mb-2">' + safeMessage + "</p>" +
        (safeLocation
          ? '<div class="small text-muted mb-3"><i class="fa fa-map-marker me-1" aria-hidden="true"></i>' +
            safeLocation +
            "</div>"
          : "") +
        '<div class="d-flex flex-wrap gap-2 mb-3">' +
        '<button class="btn-main btn-line btn-small fw-feed-like" type="button"><span><i class="fa fa-heart me-1" aria-hidden="true"></i>Like (' +
        Number(post.likes || 0) +
        ")</span></button>" +
        '<button class="btn-main btn-line btn-small fw-feed-comment-toggle" type="button" aria-expanded="false"><span><i class="fa fa-comment me-1" aria-hidden="true"></i>Comment (' +
        comments.length +
        ")</span></button>" +
        "</div>" +
        '<div class="fw-feed-comments d-none">' +
        '<label class="form-label" for="comment-' +
        post.id +
        '">Add Comment</label>' +
        '<div class="d-flex gap-2 align-items-start">' +
        '<input id="comment-' +
        post.id +
        '" type="text" class="form-control" maxlength="280" placeholder="Write a comment">' +
        '<button class="btn-main btn-small fw-feed-comment-add" type="button"><span>Add</span></button>' +
        "</div>" +
        '<ul class="list-unstyled mt-3 mb-0">' +
        commentsHtml +
        "</ul>" +
        "</div>";

      listEl.appendChild(item);
    });
  }

  function addPost() {
    const message = (messageInput.value || "").trim();
    if (!message) {
      setFormError("Message is required.");
      return;
    }
    if (message.length > MAX_MESSAGE) {
      setFormError("Message cannot exceed 500 characters.");
      return;
    }

    const posts = readPosts();
    posts.push({
      id: postId(),
      type: typeInput.value || "activity",
      title: (titleInput.value || "").trim(),
      message: message,
      location: (locationInput.value || "").trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: []
    });
    savePosts(posts);
    form.reset();
    typeInput.value = "weather";
    setFormError("");
    updateCounter();
    render();
    showToast();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    addPost();
  });

  messageInput.addEventListener("input", function () {
    updateCounter();
    if ((messageInput.value || "").length <= MAX_MESSAGE) {
      setFormError("");
    }
  });

  listEl.addEventListener("click", function (event) {
    const target = event.target;
    const postContainer = target.closest("[data-post-id]");
    if (!postContainer) return;
    const postIdValue = postContainer.getAttribute("data-post-id");
    const posts = readPosts();
    const index = posts.findIndex(function (post) {
      return post.id === postIdValue;
    });
    if (index < 0) return;

    if (target.closest(".fw-feed-delete")) {
      posts.splice(index, 1);
      savePosts(posts);
      render();
      return;
    }

    if (target.closest(".fw-feed-like")) {
      posts[index].likes = Number(posts[index].likes || 0) + 1;
      savePosts(posts);
      render();
      return;
    }

    if (target.closest(".fw-feed-comment-toggle")) {
      const section = postContainer.querySelector(".fw-feed-comments");
      const button = postContainer.querySelector(".fw-feed-comment-toggle");
      if (!section || !button) return;
      const willShow = section.classList.contains("d-none");
      section.classList.toggle("d-none");
      button.setAttribute("aria-expanded", willShow ? "true" : "false");
      return;
    }

    if (target.closest(".fw-feed-comment-add")) {
      const input = postContainer.querySelector("input[type='text']");
      if (!input) return;
      const text = (input.value || "").trim();
      if (!text) return;
      if (!Array.isArray(posts[index].comments)) posts[index].comments = [];
      posts[index].comments.push({
        id: commentId(),
        text: text,
        createdAt: new Date().toISOString()
      });
      savePosts(posts);
      render();
    }
  });

  updateCounter();
  render();
})();
