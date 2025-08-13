# Pro-Grade Quiz App (English UI/UX)

A modern, responsive, and accessible quiz application with a polished UI/UX, built with vanilla HTML/CSS/JS. It features light/dark themes, a circular timer, keyboard shortcuts, robust OpenTDB integration (with session token & retries), detailed results review, and CSV export — all with zero server code.

## Features
- **Modern UI/UX**
  - Glassmorphism & soft shadows
  - Smooth micro-interactions & subtle animations
  - Loading skeletons to avoid layout shifts
- **Light/Dark Theme** (persisted in `localStorage`)
- **Circular Timer** with conic-gradient progress
- **Keyboard Shortcuts**
  - `1`–`4` select options, `Enter` submit/continue, `N` next, `T` toggle theme
- **Robust OpenTDB Integration**
  - Session Token to reduce duplicates
  - Smart retries with backoff & full response-code handling
  - Safe HTML decoding for question text
- **Answer Review**
  - Per-question breakdown with correct/your answer & correctness
  - **CSV Export** of results
- **Celebration Confetti** on high scores
- **Offline Fallback**
  - Minimal built-in sample items if API is unreachable

---

## Screenshots
> Add your own images to `/docs` and update paths below.

- Setup Screen: `docs/setup.png`  
- Quiz Screen: `docs/quiz.png`  
- Results Review: `docs/results.png`

~~~markdown
![Setup](docs/setup.png)
![Quiz](docs/quiz.png)
![Results](docs/results.png)
~~~

---

## Quick Start

### Run Locally
Just open `index.html` in a modern browser.

Optionally serve over a local HTTP server (recommended for a realistic environment):

~~~bash
# Python 3
python -m http.server 5173

# Node (if you have it)
npx http-server -p 5173
~~~

Then visit `http://localhost:5173`.

---

## Project Structure
~~~text
pro-quiz-app/
├─ index.html        # App shell: setup screen, quiz screen, results screen
├─ style.css         # Modern, responsive styles + light/dark theme variables
├─ script.js         # App logic: state, API calls, rendering, timer, review, CSV export
├─ README.md         # You're reading it
└─ docs/             # (optional) screenshots, assets for README
~~~

---

## Configuration

Most defaults are sensible out of the box. If you want to tweak behavior, open `script.js` and look for the `state` and config constants:

- **Time per question**: `state.timePerQ` (default: `30` seconds)
- **OpenTDB endpoints**: `API_BASE`, `TOKEN_ENDPOINT`
- **LocalStorage keys**: e.g., session token and theme key

No API keys are required for OpenTDB. All endpoints are HTTPS.

---

## Usage

### Keyboard Shortcuts
| Action               | Shortcut     |
|----------------------|--------------|
| Select Option A–D    | `1`–`4`      |
| Submit / Continue    | `Enter`      |
| Next Question        | `N`          |
| Toggle Theme         | `T`          |

### Flow
1. Choose category/difficulty/amount.
2. Answer each question before the timer ends.
3. Submit to lock in your choice (or auto-submit on timeout).
4. Review results at the end; download CSV if you like.

### CSV Export
Click **Download CSV** on the results screen to save a file containing: index, question, your answer, correct answer, correctness.

---

## Theming

- Theme is stored in `localStorage` and follows user preference on first visit (`prefers-color-scheme`).
- CSS variables are defined for both light and dark themes (e.g. `--bg`, `--text`, `--card`, `--accent`).
- Toggle via the UI button or press `T`.

---

## Error Handling & Resilience

- **Abortable fetch** with timeouts to avoid hanging requests.
- **Session token** is retrieved and cached; auto-reset when invalid.
- **Response codes** from OpenTDB are fully handled (e.g., not enough questions, invalid token).
- **Retries with backoff** on transient network errors.
- **Offline fallback**: small local question set allows testing without network.

---

## Accessibility

- Focus states and roles are provided for interactive controls.
- Keyboard navigation and shortcuts improve operability.
- Color contrast optimized for both themes.
- Motion is kept subtle; consider reducing or toggling if needed (extendable with `prefers-reduced-motion`).

---

## Performance Notes

- Minimal JS; no frameworks required.
- DOM queries cached; rendering done per question.
- Lightweight animations using CSS and the Web Animations API.
- Avoids layout thrashing by using CSS variables and batching changes.

---

## Privacy & Data

- No personal data is collected.
- Local storage is used only for theme preference and OpenTDB session token.
- CSV export is generated locally in the browser.

---

## Roadmap
- Question pool caching
- True/False and open-ended modes
- Animated transitions between questions
- Category badges & basic analytics
- Optional GA4 integration (opt-in)

---
