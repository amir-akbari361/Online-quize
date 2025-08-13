// ===== OpenTDB integration (robust) =====
const API_BASE = "https://opentdb.com/api.php";
const TOKEN_ENDPOINT = "https://opentdb.com/api_token.php";
const LS_TOKEN_KEY = "opentdb_session_token";

// ===== App state =====
const state = {
  questions: [],
  index: 0,
  score: 0,
  answers: [],
  token: null,
  lock: false,
  timer: null,
  timePerQ: 30,
  timeLeft: 30,
  theme: null,
};

// ===== DOM =====
const el = {
  setupScreen: document.getElementById("setup-screen"),
  setupForm: document.getElementById("setup-form"),
  quizScreen: document.getElementById("quiz-screen"),
  questionText: document.getElementById("question-text"),
  options: document.getElementById("options"),
  submitBtn: document.getElementById("submit-btn"),
  nextBtn: document.getElementById("next-btn"),
  progressText: document.getElementById("progress-text"),
  timerCircle: document.getElementById("timer-circle"),
  timerLabel: document.getElementById("timer-label"),
  resultScreen: document.getElementById("result-screen"),
  scoreSummary: document.getElementById("score-summary"),
  review: document.getElementById("review"),
  loader: document.getElementById("loader"),
  toast: document.getElementById("toast"),
  themeToggle: document.getElementById("theme-toggle"),
};

// ===== Utils =====
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (n) => n.classList.remove("hidden");
const hide = (n) => n.classList.add("hidden");

function toast(message, timeout = 3500) {
  el.toast.textContent = message;
  show(el.toast);
  setTimeout(() => hide(el.toast), timeout);
}

function decodeHTML(str) {
  const t = document.createElement("textarea");
  t.innerHTML = str;
  return t.value;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function abortableFetch(url, { timeout = 12000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(t)
  );
}

// Confetti (lightweight, no libs)
function confettiBurst(count = 60) {
  const root = document.body;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 6;
    p.style.position = "fixed";
    p.style.left = Math.random() * 100 + "vw";
    p.style.top = "-10px";
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.background = `hsl(${Math.random() * 360}, 80%, 60%)`;
    p.style.borderRadius = "2px";
    p.style.opacity = "0.9";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    p.style.pointerEvents = "none";
    p.style.zIndex = "200";
    const duration = 1200 + Math.random() * 1200;
    p.animate(
      [
        { transform: `translateY(0) rotate(0deg)`, opacity: 0.9 },
        {
          transform: `translateY(${100 + Math.random() * 100}vh) rotate(${
            720 + Math.random() * 360
          }deg)`,
          opacity: 1,
        },
      ],
      { duration, easing: "cubic-bezier(.2,.7,.2,1)" }
    ).onfinish = () => p.remove();
    frag.appendChild(p);
  }
  root.appendChild(frag);
}

// ===== Token handling =====
async function getToken() {
  const cached = localStorage.getItem(LS_TOKEN_KEY);
  if (cached) return cached;

  const url = `${TOKEN_ENDPOINT}?command=request`;
  const res = await abortableFetch(url);
  if (!res.ok) throw new Error("Token HTTP " + res.status);
  const data = await res.json();
  if (data.response_code !== 0 || !data.token) throw new Error("Token error");
  localStorage.setItem(LS_TOKEN_KEY, data.token);
  return data.token;
}
async function resetToken(token) {
  const url = `${TOKEN_ENDPOINT}?command=reset&token=${encodeURIComponent(
    token
  )}`;
  const res = await abortableFetch(url);
  if (!res.ok) throw new Error("Token reset HTTP " + res.status);
  const data = await res.json();
  if (data.response_code !== 0) throw new Error("Token reset failed");
  return true;
}

// ===== Fetch questions (with backoff & codes) =====
async function fetchQuestions({
  amount,
  category,
  difficulty,
  type = "multiple",
}) {
  state.token = await getToken();

  const params = new URLSearchParams();
  params.set("amount", String(amount));
  if (category) params.set("category", String(category));
  if (difficulty) params.set("difficulty", difficulty);
  if (type) params.set("type", type);
  params.set("token", state.token);

  const url = `${API_BASE}?${params.toString()}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await abortableFetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.response_code === 0) {
      const results = (data.results || []).map((q) => ({
        question: decodeHTML(q.question),
        correct: decodeHTML(q.correct_answer),
        options: shuffle([
          decodeHTML(q.correct_answer),
          ...q.incorrect_answers.map(decodeHTML),
        ]),
        raw: q,
      }));
      if (!results.length) throw new Error("No questions returned.");
      return results;
    }
    if (data.response_code === 4) {
      await resetToken(state.token);
      continue;
    }
    if (data.response_code === 1) {
      throw new Error(
        "Not enough questions for the selected filters. Try different settings."
      );
    }
    if (data.response_code === 2) {
      throw new Error("Invalid parameters. Please review your settings.");
    }
    if (data.response_code === 3) {
      localStorage.removeItem(LS_TOKEN_KEY);
      state.token = await getToken();
      continue;
    }

    await sleep(1200 * (attempt + 1));
  }

  throw new Error("Failed to fetch questions. Please try again.");
}

// ===== Rendering & timer =====
function updateProgress() {
  el.progressText.textContent = `Q ${state.index + 1} / ${
    state.questions.length
  }`;
}

function startTimer() {
  clearInterval(state.timer);
  state.timeLeft = state.timePerQ;
  updateTimerUI();

  state.timer = setInterval(() => {
    state.timeLeft--;
    updateTimerUI();
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      autoSubmit();
    }
  }, 1000);
}

function updateTimerUI() {
  const pct = Math.max(
    0,
    Math.min(100, Math.round((state.timeLeft / state.timePerQ) * 100))
  );
  el.timerCircle.style.setProperty("--angle", `${pct * 3.6}deg`);
  el.timerLabel.textContent = `${state.timeLeft}s`;
}

function buildOptionNode(text, idx) {
  const li = document.createElement("li");
  li.className = "option";
  li.setAttribute("role", "option");

  const input = document.createElement("input");
  const id = `opt-${idx}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  input.type = "radio";
  input.name = "answer";
  input.id = id;
  input.value = text;

  const label = document.createElement("label");
  label.setAttribute("for", id);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = String.fromCharCode(65 + idx);

  const txt = document.createElement("span");
  txt.textContent = text;

  label.appendChild(badge);
  label.appendChild(txt);

  li.appendChild(input);
  li.appendChild(label);
  return li;
}

function renderQuestion() {
  const q = state.questions[state.index];
  updateProgress();

  el.questionText.textContent = q.question;
  el.options.innerHTML = "";

  q.options.forEach((op, i) => el.options.appendChild(buildOptionNode(op, i)));

  el.submitBtn.disabled = false;
  el.nextBtn.disabled = true;
  state.lock = false;

  startTimer();
}

// ===== Interaction =====
function getSelected() {
  return el.options.querySelector('input[name="answer"]:checked');
}

function markOptions(userValue, correctValue) {
  const nodes = [...el.options.querySelectorAll(".option")];
  nodes.forEach((li) => {
    const input = li.querySelector("input");
    const label = li.querySelector("label");
    const val = input.value;

    li.classList.add("disabled");
    input.disabled = true;

    if (val === correctValue) {
      li.classList.add("correct");
      label.insertAdjacentText("beforeend", "  ✓");
    } else if (userValue && val === userValue) {
      li.classList.add("incorrect");
      label.insertAdjacentText("beforeend", "  ✗");
    }
  });
}

function onSubmit() {
  if (state.lock) return;
  const sel = getSelected();
  clearInterval(state.timer);

  const q = state.questions[state.index];
  const user = sel ? sel.value : null;
  const correct = q.correct;
  const isCorrect = user === correct;

  if (!sel) {
    toast("No option selected — recorded as unanswered.");
  }

  if (isCorrect) state.score++;
  state.answers.push({ q: q.question, your: user, correct, isCorrect });

  markOptions(user, correct);
  state.lock = true;

  el.submitBtn.disabled = true;
  el.nextBtn.disabled = false;
}

function autoSubmit() {
  if (state.lock) return;
  onSubmit();
}

function onNext() {
  if (state.index < state.questions.length - 1) {
    state.index++;
    renderQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  hide(el.quizScreen);
  show(el.resultScreen);

  const total = state.questions.length;
  const percent = Math.round((state.score / total) * 100);
  el.scoreSummary.textContent = `Your score: ${state.score} / ${total} (${percent}%)`;

  if (percent >= 80) confettiBurst(80);

  const rows = state.answers
    .map(
      (a, i) => `
    <tr>
      <td class="q">${i + 1}. ${a.q}</td>
      <td class="your">${a.your ?? "—"}</td>
      <td class="correct">${a.correct}</td>
    </tr>
  `
    )
    .join("");

  el.review.innerHTML = `
    <table class="review-table" aria-label="Review answers">
      <tbody>${rows}</tbody>
    </table>
  `;
}

function resetGame() {
  clearInterval(state.timer);
  state.questions = [];
  state.index = 0;
  state.score = 0;
  state.answers = [];
  state.lock = false;
  el.options.innerHTML = "";
  el.questionText.textContent = "...";
  el.timerCircle.style.setProperty("--angle", `0deg`);
  el.timerLabel.textContent = `${state.timePerQ}s`;
}

// ===== CSV download =====
function downloadCSV() {
  const header = ["#", "Question", "Your Answer", "Correct Answer"];
  const lines = [header.join(",")];
  state.answers.forEach((a, i) => {
    const esc = (s) => (s == null ? "" : String(s)).replace(/"/g, '""');
    lines.push(
      [
        i + 1,
        `"${esc(a.q)}"`,
        `"${esc(a.your ?? "")}"`,
        `"${esc(a.correct)}"`,
      ].join(",")
    );
  });
  const csv = lines.join("");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quiz-results.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===== Theme handling =====
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") root.classList.add("light");
  else root.classList.remove("light");
  state.theme = theme;
  localStorage.setItem("quiz_theme", theme);
}
function initTheme() {
  const saved = localStorage.getItem("quiz_theme");
  if (saved) applyTheme(saved);
  else {
    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }
}

// ===== Bootstrapping =====
el.setupForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const fd = new FormData(ev.currentTarget);
  const amount = Number(fd.get("amount") || 10);
  const category = String(fd.get("category") || "");
  const difficulty = String(fd.get("difficulty") || "");
  const perQuestion = Number(fd.get("perQuestion") || 30);

  state.timePerQ = perQuestion;

  hide(el.resultScreen);
  hide(el.setupScreen);
  show(el.loader);

  try {
    const questions = await fetchQuestions({
      amount,
      category,
      difficulty,
      type: "multiple",
    });
    state.questions = questions;
    state.index = 0;
    state.score = 0;
    state.answers = [];

    hide(el.loader);
    show(el.quizScreen);
    renderQuestion();
  } catch (err) {
    hide(el.loader);
    toast("Failed to fetch questions: " + err.message);

    state.questions = [
      {
        question: "Where can JavaScript run?",
        correct: "In the browser and Node.js",
        options: shuffle([
          "Only in the browser",
          "Only in Node.js",
          "In the browser and Node.js",
          "Nowhere",
        ]),
      },
      {
        question: "What is 2 ** 3 in JavaScript?",
        correct: "8",
        options: shuffle(["6", "8", "9", "2**3 is not defined"]),
      },
    ];
    state.index = 0;
    show(el.quizScreen);
    renderQuestion();
  }
});

el.submitBtn.addEventListener("click", onSubmit);
el.nextBtn.addEventListener("click", onNext);
document.getElementById("restart-btn").addEventListener("click", () => {
  resetGame();
  hide(el.resultScreen);
  show(el.setupScreen);
});
document.getElementById("download-btn").addEventListener("click", downloadCSV);

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "t") {
    applyTheme(state.theme === "light" ? "dark" : "light");
    return;
  }
  if (el.quizScreen.classList.contains("hidden")) return;

  if (["1", "2", "3", "4"].includes(e.key)) {
    const idx = Number(e.key) - 1;
    const input = el.options.querySelectorAll("input")[idx];
    if (input && !input.disabled) {
      input.checked = true;
    }
  } else if (e.key === "Enter") {
    if (!el.submitBtn.disabled) onSubmit();
    else if (!el.nextBtn.disabled) onNext();
  } else if (e.key.toLowerCase() === "n") {
    if (!el.nextBtn.disabled) onNext();
  }
});

el.themeToggle.addEventListener("click", () => {
  applyTheme(state.theme === "light" ? "dark" : "light");
});

initTheme();
