# Basketball Shot Tracking System

A web app that watches a video of someone taking a jump shot, measures their shooting form frame by frame with pose estimation, and tells them what to change. Coaches can link players to their account, review every upload, leave feedback and export progress reports.

I built it as my IB Computer Science Internal Assessment: a solo project for a real client, taken from requirements through design, development and evaluation.

---

## How the analysis works

`server/scripts/analyze_shot.py` is the core. For an uploaded video it:

1. **Samples every 5th frame** with OpenCV. Form changes slowly relative to 24–30 fps, so this cuts compute about 5× and loses little.
2. **Estimates pose** with MediaPipe Pose (33 body landmarks), then works out three joint angles on the shooting arm:
   - **Elbow**: shoulder → elbow → wrist
   - **Shoulder**: hip → shoulder → elbow (how high the shooting arm is raised)
   - **Wrist**: elbow → wrist → palm centre (mean of the index, thumb and pinky landmarks)
3. **Scores each frame** as the absolute deviation from target angles (elbow 130°, shoulder 30°, wrist 120°), and sums them into a *collective error*. That number is what the progress charts track over time.
4. **Gives per-frame advice** when an angle falls outside the coaching range (for example "Raise your shooting arm" when the shoulder angle is under 45°).
5. **Finds the ball without a trained detector**: HSV thresholding for basketball orange, a Gaussian blur, then a Hough circle transform; the largest circle is taken as the ball.
6. **Finds the release frame**: the last frame where the ball is within 60 px of the wrist. If the ball is never found, it falls back to the frame with the largest wrist angle. Angles at release are reported separately because release is the moment that matters most for accuracy.
7. **Classifies the shot** as a set shot, small hop or jump shot from the vertical travel of the hip landmark, measured against a median baseline from the first frames.

The script writes **only JSON to stdout**. It sends all logging to stderr by swapping `sys.stdout` for the duration of the run, so the Node server can `JSON.parse` the output reliably.

```
Video ─► OpenCV (every 5th frame) ─┬─► MediaPipe Pose ─► joint angles ─► errors + advice
                                   └─► HSV mask + Hough circles ─► ball position
                                             │
            ball-to-wrist distance ──────────┴─► release frame ─► release angles
            hip vertical travel ─────────────────► set shot / hop / jump shot
```

## Features

**Players**
- Upload a shot video and run the analysis
- Frame-by-frame breakdown: angles, errors and advice next to the video
- Progress chart of average collective error across uploads (Chart.js)
- Downloadable PDF progress report (PDFKit)
- Accept or decline a coach's invitation

**Coaches**
- Invite players by email and manage the roster
- See every player's uploads and analyses
- Leave written feedback on a specific video
- Per-player analysis view and a coach report

**Access control**: JWT auth with two roles. Coach-only routes are guarded by `verifyCoach`, and a player can only view or analyse their own videos.

## Architecture

```
client/  React 19 (Create React App), React Router, Chart.js, axios
  components/Auth.js                 login / register (player or coach)
  components/PlayerDashboard.jsx     uploads, analyses, coach invitations
  components/VideoUpload.jsx         upload → save → trigger analysis
  components/VideoAnalysis.jsx       per-frame results next to the video
  components/CoachDashboard.jsx      roster, invitations, player videos
  components/MetricsPage.jsx         error-over-time chart
  components/StudentReport.jsx, CoachReport.jsx

server/  Node.js, Express 5, Sequelize + SQLite, Multer, PDFKit
  index.js            app setup, static /uploads, route mounting
  routes/auth.js      register, login, coach ↔ player invitations, roster
  routes/videos.js    upload, list (player / coach), progress, PDF report
  routes/video.js     run analysis (spawns Python), feedback, per-frame errors
  models/             User (self-referencing coach → players), Video, Feedback, ShotError
  scripts/analyze_shot.py   the computer-vision pipeline above
```

**Why Node spawns Python** instead of one language for everything: the web side (auth, uploads, PDFs) is simplest in Express, and the CV side needs MediaPipe and OpenCV, which are best supported in Python. The boundary is one process call with JSON over stdout, so either side can change without touching the other. Analysis results go into `Video.analysisResults` (JSON), and per-frame errors are also written to a `ShotError` table, which the progress chart and PDF report average per video.

## Running it locally

Requires **Node 22** (see `.nvmrc`; Node 26 removed `buffer.SlowBuffer`, which `jsonwebtoken`'s dependency chain still uses) and **Python 3.9–3.12** (MediaPipe's supported range).

```bash
# 1. Python environment for the analysis script
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. API on http://localhost:3001
npm ci
PYTHON=.venv/bin/python npm start      # PYTHON defaults to "python"

# 3. Web app on http://localhost:3000 (new terminal)
cd ../client
npm ci
npm start
```

Register one coach and one player, upload a short clip of a shot (side-on works best) from the player account, then open the analysis.

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port (the client expects 3001). |
| `JWT_SECRET` | dev value + warning | Token signing key. Set it for anything non-local. |
| `PYTHON` | `python` | Interpreter used to run `analyze_shot.py`. |
| `DEBUG_FRAMES` | off | `1` writes annotated ball/wrist frames for tuning the ball detector. |

SQLite (`server/database.sqlite`) and uploaded videos (`server/uploads/`) are created on first run and are git-ignored.

## Limitations and what I'd do next

- **Ball detection is colour-based.** It's fast and needs no training data, but it's sensitive to lighting, orange clothing and backgrounds. A small fine-tuned object detector (e.g. YOLO) would be more robust. The colour bounds and the 60 px release radius are tunable constants, and `DEBUG_FRAMES=1` exists to tune them.
- **Single-camera 2D angles.** Angles are measured in the image plane, so they depend on camera position. A side-on view gives the most meaningful elbow and shoulder angles.
- **Right-handed shooters only.** The pipeline reads the right arm's landmarks.
- **Hand-picked target angles.** The ideals and advice ranges came from coaching guidance, not fitted to data, and some of the ranges overlap. Learning them from labelled made and missed shots would be the principled next step.
- **Coach scope is coarse.** Any coach account can open any video; checks should be tied to the coach's own roster.
- **API URLs are hard-coded** to `localhost:3001` in the client, and analysis runs synchronously inside the request. A job queue would be needed beyond a single user.

## Tech stack

React · React Router · Chart.js · Node.js · Express · Sequelize · SQLite · JWT · Multer · PDFKit · Python · MediaPipe Pose · OpenCV · NumPy
