import os, re, json, time, sqlite3
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from google import genai
import pdfplumber
from dotenv import load_dotenv

# ── Load Environment ──────────────────────────────────────────────────────────
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY)
MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"]

# ── Flask Setup ───────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "examedge_pro_2024")
CORS(app)

UPLOAD_FOLDER = "uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

rag_store = {}

# ── AI Helper ─────────────────────────────────────────────────────────────────
def ask_ai(prompt, retries=2):
    for model in MODELS:
        for attempt in range(retries):
            try:
                return client.models.generate_content(model=model, contents=prompt).text
            except Exception as e:
                err = str(e)
                if '503' in err or 'UNAVAILABLE' in err:
                    if attempt < retries - 1:
                        time.sleep(4)
                        continue
                    else:
                        break
                elif '429' in err or 'quota' in err.lower():
                    break
                else:
                    raise e
    raise Exception("AI service temporarily unavailable. Please try again.")

def strip_json(raw):
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    return re.sub(r"\s*```$", "", raw)

# ── Database ──────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect("examedge.db")
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
    c.execute("""CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        hours_left REAL,
        schedule TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
    c.execute("""CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
    c.execute("""CREATE TABLE IF NOT EXISTS quiz_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        unit_name TEXT,
        score INTEGER,
        total INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully")

def get_db():
    conn = sqlite3.connect("examedge.db")
    conn.row_factory = sqlite3.Row
    return conn

def allowed_file(f):
    return "." in f and f.rsplit(".", 1)[1].lower() == "pdf"

# ── RAG Helpers ───────────────────────────────────────────────────────────────
def chunk_text(text, size=800, overlap=150):
    words, chunks, step = text.split(), [], size - overlap
    for i in range(0, len(words), step):
        c = " ".join(words[i:i+size])
        if c.strip():
            chunks.append(c)
    return chunks

def retrieve(query, chunks, top=5):
    qw = set(re.findall(r'\w+', query.lower()))
    scored = sorted([(len(qw & set(re.findall(r'\w+', c.lower()))), i, c)
                     for i, c in enumerate(chunks)], reverse=True)
    return [s[2] for s in scored[:top] if s[0] > 0] or chunks[:top]

def get_context(query, uid, unit_idx=None):
    store = rag_store.get(uid)
    if not store:
        return None, None
    if unit_idx is not None and unit_idx < len(store["units"]):
        u = store["units"][unit_idx]
        return "\n\n---\n\n".join(retrieve(query, u["chunks"])), u["name"]
    return "\n\n---\n\n".join(retrieve(query, store["all_chunks"])), \
           ", ".join(u["name"] for u in store["units"])

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return render_template("home.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name  = request.form["name"].strip()
        email = request.form["email"].strip().lower()
        pwd   = generate_password_hash(request.form["password"])
        conn  = get_db()
        try:
            if conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
                flash("Email already registered.", "error")
                conn.close()
                return redirect(url_for("register"))
            conn.execute("INSERT INTO users (name,email,password) VALUES (?,?,?)",
                         (name, email, pwd))
            conn.commit()
            conn.close()
            flash("Account created! Please log in.", "success")
            return redirect(url_for("login"))
        except Exception as e:
            conn.close()
            flash("Registration failed. Please try again.", "error")
            return redirect(url_for("register"))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        session.clear()
        email = request.form["email"].strip().lower()
        pwd   = request.form["password"]
        conn  = get_db()
        try:
            user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            conn.close()
            if user and check_password_hash(user["password"], pwd):
                session["user_id"]   = user["id"]
                session["user_name"] = user["name"]
                return redirect(url_for("dashboard"))
            flash("Invalid email or password.", "error")
        except Exception as e:
            conn.close()
            flash("Login failed. Please try again.", "error")
    return render_template("login.html")

@app.route("/logout")
def logout():
    uid = session.get("user_id")
    if uid in rag_store:
        del rag_store[uid]
    session.clear()
    return redirect(url_for("home"))

# ── Dashboard ─────────────────────────────────────────────────────────────────
@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    uid  = session["user_id"]
    conn = get_db()
    sessions = conn.execute(
        "SELECT * FROM study_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 5",
        (uid,)).fetchall()
    results = conn.execute(
        "SELECT * FROM quiz_results WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
        (uid,)).fetchall()
    conn.close()
    store = rag_store.get(uid)
    return render_template("dashboard.html",
                           user=session["user_name"],
                           sessions=sessions,
                           results=results,
                           has_doc=bool(store),
                           units=store["units"] if store else [])

# ── PDF Upload ────────────────────────────────────────────────────────────────
@app.route("/upload_pdf", methods=["POST"])
def upload_pdf():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    files = request.files.getlist("pdf")
    if not files or files[0].filename == "":
        return jsonify({"error": "No files selected"}), 400
    uid = session["user_id"]
    if uid not in rag_store:
        rag_store[uid] = {"units": [], "all_chunks": [], "all_text": ""}
    uploaded = []
    for file in files:
        if not allowed_file(file.filename):
            continue
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)
        text = ""
        try:
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text += t + "\n\n"
        except Exception as e:
            return jsonify({"error": f"Error reading {filename}: {e}"}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
        if not text.strip():
            continue
        uname  = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").title()
        chunks = chunk_text(text)
        rag_store[uid]["units"].append({"name": uname, "chunks": chunks, "text": text})
        rag_store[uid]["all_chunks"].extend(chunks)
        rag_store[uid]["all_text"] += text + "\n\n"
        uploaded.append(uname)
    if not uploaded:
        return jsonify({"error": "No readable text found."}), 400
    return jsonify({"success": True, "units": uploaded,
                    "total": len(rag_store[uid]["units"])})

@app.route("/clear_docs", methods=["POST"])
def clear_docs():
    uid = session.get("user_id")
    if uid in rag_store:
        del rag_store[uid]
    return jsonify({"success": True})

# ── Study Planner ─────────────────────────────────────────────────────────────
@app.route("/planner")
def planner():
    if "user_id" not in session:
        return redirect(url_for("login"))
    uid   = session["user_id"]
    store = rag_store.get(uid)
    return render_template("planner.html", user=session["user_name"],
                           units=store["units"] if store else [])

@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    data      = request.get_json()
    subject   = data.get("subject", "")
    days      = int(data.get("days", 0))
    hours     = float(data.get("hours", 5))
    total     = (days * 24) + hours
    exam_type = data.get("exam_type", "University Exam")
    topics    = data.get("topics", "")
    uid       = session["user_id"]

    doc_ctx = ""
    if uid in rag_store:
        ctx, name = get_context(f"important topics {subject}", uid)
        if ctx:
            doc_ctx = f"\n\nUse this uploaded material to prioritize:\n{ctx[:2000]}"

    prompt = f"""You are an expert academic study coach for last-minute exam preparation.
Student has {days} days and {hours} hours ({total}h total) before {exam_type} on: {subject}.
Topics: {topics if topics else 'Infer from subject'}{doc_ctx}

Return ONLY valid JSON, no markdown:
{{
  "subject": "{subject}",
  "total_hours": {total},
  "priority_level": "high or medium or low",
  "strategy": "2-3 sentence strategy",
  "schedule": [
    {{
      "slot": 1,
      "time_block": "Day 1 - 9:00 to 10:00",
      "duration_mins": 60,
      "topic": "Topic name",
      "activity": "Exact activity",
      "why_important": "Reason",
      "tips": "Exam tip"
    }}
  ],
  "quick_revision_checklist": ["item1","item2","item3","item4","item5"],
  "exam_day_tips": ["tip1","tip2","tip3"],
  "stress_note": "Short motivational note"
}}
Cover all {total} hours. Add 10min break every 50mins. Prioritize high-weightage topics first."""

    try:
        plan = json.loads(strip_json(ask_ai(prompt)))
        conn = get_db()
        conn.execute(
            "INSERT INTO study_sessions (user_id,subject,hours_left,schedule) VALUES (?,?,?,?)",
            (uid, subject, total, json.dumps(plan)))
        conn.commit()
        conn.close()
        return jsonify({"plan": plan})
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Parse error: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Chatbot ───────────────────────────────────────────────────────────────────
@app.route("/chatbot")
def chatbot():
    if "user_id" not in session:
        return redirect(url_for("login"))
    uid  = session["user_id"]
    conn = get_db()
    history = list(reversed(conn.execute(
        "SELECT role,message FROM chat_history WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
        (uid,)).fetchall()))
    conn.close()
    store = rag_store.get(uid)
    return render_template("chatbot.html", user=session["user_name"],
                           history=history, has_doc=bool(store),
                           units=store["units"] if store else [])

@app.route("/ask", methods=["POST"])
def ask():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    data     = request.get_json()
    question = data.get("question", "").strip()
    fmt      = data.get("format", "detailed")
    unit_idx = data.get("unit_index", None)
    uid      = session["user_id"]

    if not question:
        return jsonify({"error": "Empty question"}), 400

    context, doc_name = get_context(question, uid,
                                    int(unit_idx) if unit_idx is not None else None)

    rag_note = f'Expert AI exam tutor. Answer ONLY from "{doc_name}".\nIf not found say so.\n\nMATERIAL:\n{context}\n\n' \
               if context else "Expert AI exam tutor. Answer from general knowledge.\n\n"

    formats = {
        "short":      "Give a SHORT ANSWER in 2-4 sentences for a short-answer exam.",
        "detailed":   "Give a DETAILED answer for a long-answer/essay exam with examples.",
        "bullet":     "Give answer as BULLET POINTS — key facts and definitions clearly listed.",
        "definition": "Give a precise DEFINITION with key characteristics and a brief example.",
    }

    prompt = f"{rag_note}FORMAT: {formats.get(fmt, formats['detailed'])}\n\nQUESTION: {question}\n\nAnswer:"

    try:
        answer = ask_ai(prompt).strip()
        conn   = get_db()
        conn.execute("INSERT INTO chat_history (user_id,role,message) VALUES (?,?,?)",
                     (uid, "user", question))
        conn.execute("INSERT INTO chat_history (user_id,role,message) VALUES (?,?,?)",
                     (uid, "assistant", answer))
        conn.commit()
        conn.close()
        return jsonify({"answer": answer, "source": doc_name or "General Knowledge"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/clear_chat", methods=["POST"])
def clear_chat():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    conn = get_db()
    conn.execute("DELETE FROM chat_history WHERE user_id=?", (session["user_id"],))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/doc_action", methods=["POST"])
def doc_action():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    uid  = session["user_id"]
    if uid not in rag_store:
        return jsonify({"error": "No document uploaded"}), 400
    data     = request.get_json()
    mode     = data.get("mode", "overview")
    unit_idx = data.get("unit_index", None)

    if unit_idx is not None:
        u    = rag_store[uid]["units"][int(unit_idx)]
        text, name = u["text"][:6000], u["name"]
    else:
        text, name = rag_store[uid]["all_text"][:6000], "All Units"

    prompts = {
        "overview":   f"Write a comprehensive overview summary for exam preparation:\n\n{text}",
        "key_points": f"Extract the 10 most important exam-likely key points:\n\n{text}",
        "exam_focus": f"Identify top exam topics, likely questions, must-know facts:\n\n{text}",
    }
    try:
        result = ask_ai(prompts.get(mode, prompts["overview"])).strip()
        return jsonify({"result": result, "source": name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Quiz ──────────────────────────────────────────────────────────────────────
@app.route("/quiz")
def quiz():
    if "user_id" not in session:
        return redirect(url_for("login"))
    uid   = session["user_id"]
    store = rag_store.get(uid)
    conn  = get_db()
    results = conn.execute(
        "SELECT * FROM quiz_results WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
        (uid,)).fetchall()
    conn.close()
    return render_template("quiz.html", user=session["user_name"],
                           has_doc=bool(store),
                           units=store["units"] if store else [],
                           results=results)

@app.route("/generate_quiz", methods=["POST"])
def generate_quiz():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    data       = request.get_json()
    topic      = data.get("topic", "General Knowledge")
    difficulty = data.get("difficulty", "medium")
    num_q      = min(int(data.get("num_questions", 10)), 15)
    unit_idx   = data.get("unit_index", None)
    uid        = session["user_id"]

    context, doc_name = get_context(topic, uid,
                                    int(unit_idx) if unit_idx is not None else None)
    src = f'From "{doc_name}":\n{context[:3000]}\n\n' if context else ""

    prompt = f"""{src}Generate exactly {num_q} {difficulty}-difficulty MCQ questions on: {topic}

Return ONLY a valid JSON array, no markdown:
[{{
  "question": "Clear question text",
  "options": {{"A":"...","B":"...","C":"...","D":"..."}},
  "correct": "A",
  "explanation": "Why this answer is correct"
}}]

Make questions test real understanding."""

    try:
        questions = json.loads(strip_json(ask_ai(prompt)))
        return jsonify({"questions": questions,
                        "source": doc_name or "General Knowledge",
                        "unit_name": doc_name or topic})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/save_result", methods=["POST"])
def save_result():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json()
    uid  = session["user_id"]
    conn = get_db()
    conn.execute(
        "INSERT INTO quiz_results (user_id,unit_name,score,total) VALUES (?,?,?,?)",
        (uid, data.get("unit_name", ""), data.get("score", 0), data.get("total", 0)))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# ── Init DB and Run ───────────────────────────────────────────────────────────
with app.app_context():
    init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)