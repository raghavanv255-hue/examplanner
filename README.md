# ExamEdge — AI-Powered Last-Minute Exam Preparation

## Features
- **Study Planner** — Enter days/hours remaining, get a full personalized schedule
- **AI Chatbot** — RAG-powered Q&A grounded in your uploaded PDFs
- **Quiz & Revision** — MCQs generated per unit from your study material

## Setup (Local)
```bash
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # Mac/Linux
pip install -r requirements.txt
cp .env.example .env        # Add your GEMINI_API_KEY
python app.py
```

## Deploy to Render
1. Push to GitHub
2. Create new Web Service on render.com
3. Set environment variables: GEMINI_API_KEY, SECRET_KEY
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app`
