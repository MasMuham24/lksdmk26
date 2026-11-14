const API_BASE = "http://127.0.0.1:8000/api";
const BACKEND_BASE = "http://127.0.0.1:8000";
const DEFAULT_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22250%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20250%22%3E%3Crect%20fill%3D%22%233d6b52%22%20width%3D%22400%22%20height%3D%22250%22%2F%3E%3Cpolygon%20fill%3D%22%23264634%22%20points%3D%220%2C250%20120%2C130%20240%2C210%20340%2C110%20400%2C170%20400%2C250%22%2F%3E%3Ctext%20fill%3D%22%23ffffff%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22bold%22%20x%3D%2220%22%20y%3D%2240%22%3EFoto%20Mading%20(Lokal)%3C%2Ftext%3E%3C%2Fsvg%3E";

const state = {
  user: null,
  csrfToken: "",
  posts: [],
  filterSearch: "",
  filterType: "",
  filterMine: 0,
};

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  if (state.csrfToken) {
    defaultHeaders["X-CSRF-TOKEN"] = state.csrfToken;
  }

  const config = {
    ...options,
    credentials: "include",
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, config);
  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.message || `Terjadi kesalahan (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function resolveImageUrl(post) {
  if (post.image_url) return post.image_url;
  if (!post.image) return DEFAULT_IMAGE;
  if (
    post.image.startsWith("http://") ||
    post.image.startsWith("https://") ||
    post.image.startsWith("data:")
  ) {
    return post.image;
  }
  return `${BACKEND_BASE}/${post.image.replace(/^\/+/, "")}`;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.backgroundColor = isError ? "#b91c1c" : "#1f2937";
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

function openModal(modalId) {
  const modal =
    document.getElementById("modal-" + modalId) ||
    document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal =
    document.getElementById("modal-" + modalId) ||
    document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    closeModal(btn.getAttribute("data-close"));
  });
});

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.add("hidden");
  }
});

async function checkSession() {
  try {
    const res = await apiRequest("/session", { method: "GET" });
    if (res && res.message) {
      state.user = res.message.user;
      state.csrfToken = res.message.csrf_token || "";
    }
  } catch (err) {
    state.user = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const userInfo = document.getElementById("user-info");
  const guestInfo = document.getElementById("guest-info");
  const userName = document.getElementById("user-name");

  if (state.user) {
    userInfo.classList.remove("hidden");
    guestInfo.classList.add("hidden");
    userName.textContent = state.user.name;
  } else {
    userInfo.classList.add("hidden");
    guestInfo.classList.remove("hidden");
    userName.textContent = "";
  }
}

document.getElementById("btn-login-modal").addEventListener("click", () => {
  document.getElementById("login-error").classList.add("hidden");
  document.getElementById("login-form").reset();
  openModal("login-modal");
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("login-error");
  errorBox.classList.add("hidden");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (res.success) {
      state.user = res.data.user;
      updateAuthUI();
      closeModal("login-modal");
      showToast(res.message || "Login berhasil.");
      await checkSession();
      loadPosts();
    }
  } catch (err) {
    errorBox.textContent = err.message || "Gagal masuk, periksa data Anda.";
    errorBox.classList.remove("hidden");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    await apiRequest("/logout", { method: "POST" });
  } catch (err) {}
  state.user = null;
  updateAuthUI();
  if (state.filterMine == 1) {
    state.filterMine = 0;
    document.getElementById("filter-mine").value = "0";
  }
  showToast("Anda telah keluar.");
  loadPosts();
});

async function loadPosts() {
  const loading = document.getElementById("board-loading");
  const empty = document.getElementById("board-empty");
  const grid = document.getElementById("cards-grid");

  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  grid.innerHTML = "";

  const params = new URLSearchParams();
  if (state.filterSearch) params.append("search", state.filterSearch);
  if (state.filterType) params.append("type", state.filterType);
  if (state.filterMine == 1) params.append("mine", "1");

  try {
    const res = await apiRequest(`/posts?${params.toString()}`, {
      method: "GET",
    });
    loading.classList.add("hidden");

    if (res && res.success) {
      state.posts = res.data || [];
      document.getElementById("stat-total").textContent =
        `${res.meta?.total_results ?? state.posts.length} tempelan ditampilkan`;
      document.getElementById("stat-mine").textContent =
        `${res.meta?.my_posts_count ?? 0} tempelan milik saya`;

      if (state.posts.length === 0) {
        empty.classList.remove("hidden");
      } else {
        renderCards(state.posts);
      }
    }
  } catch (err) {
    loading.classList.add("hidden");
    if (err.status === 401 && state.filterMine == 1) {
      state.filterMine = 0;
      document.getElementById("filter-mine").value = "0";
      showToast("Silakan login untuk melihat tempelan milik Anda.", true);
      openModal("login-modal");
      loadPosts();
      return;
    }
    empty.textContent = err.message || "Gagal memuat tempelan.";
    empty.classList.remove("hidden");
  }
}

function renderCards(posts) {
  const grid = document.getElementById("cards-grid");
  grid.innerHTML = "";
  const isMineFilter = state.filterMine == 1;

  posts.forEach((post, index) => {
    const card = document.createElement("div");
    card.className = `mading-card type-${post.type}`;
    card.dataset.id = post.id;
    card.dataset.index = index;

    if (isMineFilter) {
      card.classList.add("draggable");
      card.setAttribute("draggable", "true");
    }

    if (post.type === "note") {
      const color = post.color || "yellow";
      card.classList.add(`color-${color}`);
      const pin = document.createElement("div");
      pin.className = "pushpin";
      card.appendChild(pin);
    } else if (post.type === "announcement") {
      const tape = document.createElement("div");
      tape.className = "tape";
      card.appendChild(tape);
    }

    if (post.type === "photo") {
      const imgWrap = document.createElement("div");
      imgWrap.className = "card-image-wrap";
      const img = document.createElement("img");
      img.className = "card-image";
      img.src = resolveImageUrl(post);
      img.alt = post.title;
      img.onerror = () => {
        img.src = DEFAULT_IMAGE;
      };
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    if (post.type === "announcement") {
      const tag = document.createElement("div");
      tag.className = "card-tag";
      tag.textContent = "PENGUMUMAN";
      body.appendChild(tag);
    }

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = post.title;
    body.appendChild(title);

    if (post.type === "announcement" && post.event_date) {
      const dateEl = document.createElement("div");
      dateEl.className = "card-event-date";
      dateEl.textContent = formatDate(post.event_date);
      body.appendChild(dateEl);
    }

    if (post.content) {
      const content = document.createElement("div");
      content.className = "card-content";
      content.textContent = post.content;
      body.appendChild(content);
    }

    card.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const left = document.createElement("div");
    left.className = "footer-left";

    const author = document.createElement("span");
    author.className = "card-author";
    author.textContent = post.user ? post.user.name : "Warga Sekolah";
    left.appendChild(author);

    const detailBtn = document.createElement("a");
    detailBtn.className = "link-detail";
    detailBtn.href = "#";
    detailBtn.textContent = "Lihat detail";
    detailBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showDetail(post.id);
    });
    left.appendChild(detailBtn);

    footer.appendChild(left);

    const isOwner = state.user && post.user_id === state.user.id;
    if (isOwner) {
      const right = document.createElement("div");
      right.className = "footer-right";

      const editBtn = document.createElement("button");
      editBtn.className = "btn-link btn-edit";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openEditPost(post);
      });
      right.appendChild(editBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "btn-link btn-delete";
      delBtn.textContent = "Hapus";
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        deletePost(post.id);
      });
      right.appendChild(delBtn);

      footer.appendChild(right);
    }

    card.appendChild(footer);

    if (isMineFilter) {
      const orderControls = document.createElement("div");
      orderControls.className = "card-order-controls";
      orderControls.style.padding = "0 16px 10px 16px";
      orderControls.style.display = "flex";
      orderControls.style.justifyContent = "flex-end";
      orderControls.style.gap = "6px";

      if (index > 0) {
        const upBtn = document.createElement("button");
        upBtn.className = "btn-order";
        upBtn.textContent = "▲ Geser Kiri";
        upBtn.addEventListener("click", () => moveCard(index, index - 1));
        orderControls.appendChild(upBtn);
      }

      if (index < posts.length - 1) {
        const downBtn = document.createElement("button");
        downBtn.className = "btn-order";
        downBtn.textContent = "Geser Kanan ▼";
        downBtn.addEventListener("click", () => moveCard(index, index + 1));
        orderControls.appendChild(downBtn);
      }

      card.appendChild(orderControls);
    }

    grid.appendChild(card);
  });

  if (isMineFilter) {
    setupDragAndDrop();
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

async function showDetail(postId) {
  try {
    const res = await apiRequest(`/posts/${postId}`, { method: "GET" });
    if (!res || !res.success) throw new Error("Gagal mengambil detail.");
    const post = res.data;

    const detailBody = document.getElementById("detail-body");
    document.getElementById("detail-title").textContent = post.title;

    let contentHtml = "";

    if (post.type === "photo") {
      const imgUrl = resolveImageUrl(post);
      contentHtml += `
        <div style="margin-bottom: 16px; max-height: 320px; overflow: hidden; border-radius: 6px;">
          <img src="${imgUrl}" style="width: 100%; height: auto; display: block;" onerror="this.src='${DEFAULT_IMAGE}'">
        </div>
        ${post.image_caption ? `<p style="font-size: 13px; color: #6b7280; font-style: italic; margin-bottom: 12px;">${post.image_caption}</p>` : ""}
      `;
    }

    if (post.type === "announcement" && post.event_date) {
      contentHtml += `
        <div style="margin-bottom: 12px; font-weight: 600; color: #15803d; font-size: 14px;">
          📅 Tanggal: ${formatDate(post.event_date)}
        </div>
      `;
    }

    if (post.content) {
      contentHtml += `
        <div style="font-size: 14px; line-height: 1.6; color: #1f2937; margin-bottom: 16px; white-space: pre-line;">
          ${post.content}
        </div>
      `;
    }

    const typeLabels = {
      photo: "Foto",
      announcement: "Pengumuman",
      note: "Catatan / Ide",
    };

    contentHtml += `
      <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between;">
        <span>Penulis: <strong>${post.user ? post.user.name : "Warga Sekolah"}</strong></span>
        <span>Jenis: <strong>${typeLabels[post.type] || post.type}</strong></span>
      </div>
    `;

    detailBody.innerHTML = contentHtml;
    openModal("detail-modal");
  } catch (err) {
    showToast(err.message || "Gagal membuka detail tempelan.", true);
  }
}

document.getElementById("post-image-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const container = document.getElementById("image-preview-container");
  const preview = document.getElementById("image-preview");
  const note = document.getElementById("image-preview-note");

  if (file) {
    preview.src = URL.createObjectURL(file);
    note.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    container.classList.remove("hidden");
  } else {
    container.classList.add("hidden");
    preview.src = "";
  }
});

document.getElementById("btn-open-create").addEventListener("click", () => {
  if (!state.user) {
    showToast("Silakan masuk terlebih dahulu untuk menambah tempelan.");
    openModal("login-modal");
    return;
  }
  document.getElementById("post-modal-title").textContent = "Tambah Tempelan";
  document.getElementById("post-form").reset();
  document.getElementById("post-id").value = "";
  document.getElementById("group-type").classList.remove("hidden");
  document.getElementById("post-type").disabled = false;
  document.getElementById("post-error").classList.add("hidden");
  document.getElementById("image-preview-container").classList.add("hidden");
  adjustPostFormFields("photo");
  openModal("post-modal");
});

function openEditPost(post) {
  document.getElementById("post-modal-title").textContent = "Edit Tempelan";
  document.getElementById("post-form").reset();
  document.getElementById("post-id").value = post.id;
  document.getElementById("post-type").value = post.type;
  document.getElementById("post-type").disabled = true;
  document.getElementById("post-title").value = post.title || "";
  document.getElementById("post-content").value = post.content || "";
  document.getElementById("post-caption").value = post.image_caption || "";
  document.getElementById("post-event-date").value = post.event_date
    ? post.event_date.substring(0, 10)
    : "";

  const previewContainer = document.getElementById("image-preview-container");
  const previewImg = document.getElementById("image-preview");
  const previewNote = document.getElementById("image-preview-note");

  if (post.type === "photo" && (post.image || post.image_url)) {
    previewImg.src = resolveImageUrl(post);
    previewNote.textContent =
      "Foto saat ini (Pilih file baru jika ingin mengganti)";
    previewContainer.classList.remove("hidden");
  } else {
    previewContainer.classList.add("hidden");
    previewImg.src = "";
  }

  if (post.color) {
    const radio = document.querySelector(
      `input[name="post-color"][value="${post.color}"]`,
    );
    if (radio) radio.checked = true;
  }

  document.getElementById("post-error").classList.add("hidden");
  adjustPostFormFields(post.type);
  openModal("post-modal");
}

document.getElementById("post-type").addEventListener("change", (e) => {
  adjustPostFormFields(e.target.value);
});

function adjustPostFormFields(type) {
  const isPhoto = type === "photo";
  const isAnnouncement = type === "announcement";
  const isNote = type === "note";

  document.getElementById("field-image").classList.toggle("hidden", !isPhoto);
  document
    .getElementById("field-image-caption")
    .classList.toggle("hidden", !isPhoto);
  document.getElementById("field-content").classList.toggle("hidden", isPhoto);
  document
    .getElementById("field-event-date")
    .classList.toggle("hidden", !isAnnouncement);
  document.getElementById("field-color").classList.toggle("hidden", !isNote);
}

document.getElementById("post-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("post-error");
  errorBox.classList.add("hidden");

  const postId = document.getElementById("post-id").value;
  const isEdit = Boolean(postId);
  const type = document.getElementById("post-type").value;
  const title = document.getElementById("post-title").value.trim();

  const formData = new FormData();
  formData.append("type", type);
  formData.append("title", title);

  if (type === "photo") {
    const fileInput = document.getElementById("post-image-file");
    if (fileInput.files.length > 0) {
      formData.append("image", fileInput.files[0]);
    }
    const caption = document.getElementById("post-caption").value.trim();
    if (caption) formData.append("image_caption", caption);
  } else if (type === "announcement") {
    formData.append(
      "content",
      document.getElementById("post-content").value.trim(),
    );
    const eventDate = document.getElementById("post-event-date").value;
    if (eventDate) formData.append("event_date", eventDate);
  } else if (type === "note") {
    formData.append(
      "content",
      document.getElementById("post-content").value.trim(),
    );
    const checkedColor = document.querySelector(
      'input[name="post-color"]:checked',
    );
    formData.append("color", checkedColor ? checkedColor.value : "yellow");
  }

  try {
    let res;
    if (isEdit) {
      formData.append("_method", "PATCH");
      res = await apiRequest(`/posts/${postId}`, {
        method: "POST",
        body: formData,
      });
    } else {
      res = await apiRequest("/posts", {
        method: "POST",
        body: formData,
      });
    }

    if (res && res.success) {
      closeModal("post-modal");
      showToast(res.message || "Tempelan berhasil disimpan.");
      loadPosts();
    }
  } catch (err) {
    if (err.data && err.data.errors) {
      const messages = Object.values(err.data.errors).flat().join(" ");
      errorBox.textContent = messages;
    } else {
      errorBox.textContent = err.message || "Gagal menyimpan tempelan.";
    }
    errorBox.classList.remove("hidden");
  }
});

async function deletePost(postId) {
  if (!confirm("Apakah Anda yakin ingin menghapus tempelan ini?")) return;

  try {
    const res = await apiRequest(`/posts/${postId}`, { method: "DELETE" });
    if (res && res.success) {
      showToast(res.message || "Tempelan berhasil dihapus.");
      loadPosts();
    }
  } catch (err) {
    showToast(err.message || "Gagal menghapus tempelan.", true);
  }
}

async function moveCard(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.posts.length) return;
  const items = [...state.posts];
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  state.posts = items;
  renderCards(state.posts);

  const ids = items.map((p) => p.id);
  await saveOrder(ids);
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll(".mading-card.draggable");
  let draggedEl = null;

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedEl = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      if (draggedEl) draggedEl.classList.remove("dragging");
      draggedEl = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      if (!draggedEl || draggedEl === card) return;

      const grid = document.getElementById("cards-grid");
      const cardArray = Array.from(grid.querySelectorAll(".mading-card"));
      const fromIndex = cardArray.indexOf(draggedEl);
      const toIndex = cardArray.indexOf(card);

      if (fromIndex !== -1 && toIndex !== -1) {
        const items = [...state.posts];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        state.posts = items;
        renderCards(state.posts);

        const ids = items.map((p) => p.id);
        await saveOrder(ids);
      }
    });
  });
}

async function saveOrder(ids) {
  try {
    const res = await apiRequest("/posts/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
    if (res && res.success) {
      showToast(res.message || "Urutan tempelan diperbarui.");
    }
  } catch (err) {
    showToast(err.message || "Gagal memperbarui urutan.", true);
    loadPosts();
  }
}

document.getElementById("btn-search").addEventListener("click", () => {
  state.filterSearch = document.getElementById("search-input").value.trim();
  loadPosts();
});

document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    state.filterSearch = e.target.value.trim();
    loadPosts();
  }
});

document.getElementById("filter-type").addEventListener("change", (e) => {
  state.filterType = e.target.value;
  loadPosts();
});

document.getElementById("filter-mine").addEventListener("change", (e) => {
  state.filterMine = parseInt(e.target.value, 10);
  if (state.filterMine == 1 && !state.user) {
    showToast("Silakan masuk untuk melihat tempelan milik Anda.");
    openModal("login-modal");
    state.filterMine = 0;
    e.target.value = "0";
    return;
  }
  loadPosts();
});

document.getElementById("btn-refresh").addEventListener("click", () => {
  loadPosts();
});

window.addEventListener("DOMContentLoaded", async () => {
  await checkSession();
  loadPosts();
});
