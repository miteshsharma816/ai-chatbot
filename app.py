from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
import google.generativeai as genai
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import PyPDF2
import docx

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, fall back to os.environ

app = Flask(__name__)
# Use environment variable for secret key in production
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')  # Change this in production!

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Configure the Gemini API (use env var in production)
API_KEY = os.environ.get('AIzaSyAUaKJWU0gsNJ_DkC91fBSJ3riH2M_0B7Q')
model = None

def get_genai_model():
    """Lazy-load Gemini model, handle missing API key gracefully."""
    global model
    if model is not None:
        return model
    
    if not API_KEY:
        return None
    
    try:
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        return model
    except Exception as e:
        print(f"Error initializing Gemini model: {e}")
        return None

# Database configuration (use environment variables in production)
DB_CONFIG = {
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'chatbot_db')
}

def get_db():
    """Get database connection"""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(filepath):
    """Extract text from PDF file"""
    text = ""
    try:
        with open(filepath, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text()
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def extract_text_from_docx(filepath):
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(filepath)
        return '\n'.join([para.text for para in doc.paragraphs])
    except Exception as e:
        print(f"Error reading DOCX: {e}")
        return ""

# ==================== AUTHENTICATION ROUTES ====================

@app.route("/")
def index():
    if 'user_id' in session:
        return redirect(url_for('chatbot'))
    return render_template("login.html")

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500
    
    cursor = conn.cursor()
    
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"success": False, "message": "Username or email already exists"}), 400
    
    # Create new user
    password_hash = generate_password_hash(password)
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
            (username, email, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()
        
        # Auto-login after registration
        session['user_id'] = user_id
        session['username'] = username
        
        return jsonify({"success": True, "message": "Registration successful"})
    except Exception as e:
        cursor.close()
        conn.close()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s OR email = %s", (username, username))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({"success": True, "message": "Login successful"})
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('index'))

# ==================== CHATBOT ROUTES ====================

@app.route("/chatbot")
def chatbot():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template("chatbot.html", username=session['username'])

@app.route("/get-conversations", methods=["GET"])
def get_conversations():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, title, created_at FROM conversations WHERE user_id = %s ORDER BY created_at DESC",
        (session['user_id'],)
    )
    conversations = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # Convert datetime to string
    for conv in conversations:
        conv['created_at'] = conv['created_at'].isoformat()
    
    return jsonify({"success": True, "conversations": conversations})

@app.route("/new-conversation", methods=["POST"])
def new_conversation():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
    
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (user_id, title) VALUES (%s, %s)",
        (session['user_id'], 'New Chat')
    )
    conn.commit()
    conversation_id = cursor.lastrowid
    cursor.close()
    conn.close()
    
    return jsonify({"success": True, "conversation_id": conversation_id})

@app.route("/load-conversation/<int:conv_id>", methods=["GET"])
def load_conversation(conv_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    # Verify conversation belongs to user
    cursor.execute(
        "SELECT * FROM conversations WHERE id = %s AND user_id = %s",
        (conv_id, session['user_id'])
    )
    conversation = cursor.fetchone()
    
    if not conversation:
        cursor.close()
        conn.close()
        return jsonify({"success": False, "message": "Conversation not found"}), 404
    
    # Get messages
    cursor.execute(
        "SELECT sender, content, created_at FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
        (conv_id,)
    )
    messages = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # Convert datetime to string
    for msg in messages:
        msg['created_at'] = msg['created_at'].isoformat()
    
    return jsonify({"success": True, "messages": messages, "title": conversation['title']})

@app.route("/send-message", methods=["POST"])
def send_message():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    data = request.get_json()
    conversation_id = data.get('conversation_id')
    user_message = data.get('message')
    
    if not conversation_id or not user_message:
        return jsonify({"success": False, "message": "Missing data"}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    # Verify conversation belongs to user
    cursor.execute(
        "SELECT * FROM conversations WHERE id = %s AND user_id = %s",
        (conversation_id, session['user_id'])
    )
    conversation = cursor.fetchone()
    
    if not conversation:
        cursor.close()
        conn.close()
        return jsonify({"success": False, "message": "Conversation not found"}), 404
    
    # Save user message
    cursor.execute(
        "INSERT INTO messages (conversation_id, sender, content) VALUES (%s, %s, %s)",
        (conversation_id, 'user', user_message)
    )
    
    # Update conversation title if it's "New Chat"
    if conversation['title'] == 'New Chat':
        title = user_message[:50] + ('...' if len(user_message) > 50 else '')
        cursor.execute(
            "UPDATE conversations SET title = %s WHERE id = %s",
            (title, conversation_id)
        )
    
    conn.commit()
    
    # Get AI response
    try:
        # Check if Gemini API is configured
        current_model = get_genai_model()
        if not current_model:
            cursor.close()
            conn.close()
            return jsonify({
                "success": False, 
                "message": "Gemini API not configured. Please set GENAI_API_KEY environment variable. See README.md for setup instructions."
            }), 503
        
        # Get conversation history for context
        cursor.execute(
            "SELECT sender, content FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
            (conversation_id,)
        )
        history = cursor.fetchall()
        
        # Build chat with history
        chat = current_model.start_chat(history=[])
        for msg in history[:-1]:  # Exclude the message we just added
            if msg['sender'] == 'user':
                chat.send_message(msg['content'])
        
        response = chat.send_message(user_message)
        bot_message = response.text
        
        # Save bot response
        cursor.execute(
            "INSERT INTO messages (conversation_id, sender, content) VALUES (%s, %s, %s)",
            (conversation_id, 'bot', bot_message)
        )
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({"success": True, "response": bot_message})
    except Exception as e:
        cursor.close()
        conn.close()
        return jsonify({"success": False, "message": f"AI Error: {str(e)}"}), 500

# ==================== RESUME ANALYZER ROUTES ====================

@app.route("/resume-analyzer")
def resume_analyzer():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    return render_template("resume_analyzer.html", username=session['username'])

@app.route("/upload-resume", methods=["POST"])
def upload_resume():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    job_description = request.form.get('job_description', '')
    
    if 'resumes' not in request.files:
        return jsonify({"success": False, "message": "No files uploaded"}), 400
    
    files = request.files.getlist('resumes')
    
    if len(files) == 0:
        return jsonify({"success": False, "message": "No files selected"}), 400
    
    results = []
    
    for file in files:
        if file.filename == '':
            continue
            
        if not allowed_file(file.filename):
            continue
        
        # Save file
        original_filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{session['user_id']}_{timestamp}_{original_filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Extract text
        if original_filename.endswith('.pdf'):
            resume_text = extract_text_from_pdf(filepath)
        else:
            resume_text = extract_text_from_docx(filepath)
        
        if not resume_text.strip():
            results.append({
                "filename": original_filename,
                "error": "Could not extract text from resume"
            })
            continue
        
        # Analyze with AI
        try:
            # Check if Gemini API is configured
            current_model = get_genai_model()
            if not current_model:
                results.append({
                    "filename": original_filename,
                    "error": "Gemini API not configured. Please set GENAI_API_KEY environment variable."
                })
                continue
            
            if job_description:
                # Score resume against job description
                prompt = f"""Analyze this resume against the job description and provide:
1. **Match Score** (0-100): How well the candidate matches the job
2. **Key Matching Skills**: Skills that align with the job
3. **Missing Skills**: Required skills not present
4. **Strengths**: What makes this candidate suitable
5. **Concerns**: Potential gaps or issues
6. **Recommendation**: Hire/Interview/Reject with justification

Job Description:
{job_description}

Resume:
{resume_text}

Format your response in clear sections."""
            else:
                # General resume analysis
                prompt = f"""Analyze this resume and provide:
1. **Overall Score** (out of 100)
2. **Key Skills Identified** (bullet list)
3. **Experience Summary**
4. **Education Summary**
5. **Strengths**
6. **Areas for Improvement**
7. **ATS Compatibility** (keywords, formatting)

Resume Text:
{resume_text}

Format your response in clear sections."""

            response = current_model.generate_content(prompt)
            analysis = response.text
            
            # Extract score from analysis (look for number out of 100)
            import re
            score_match = re.search(r'(\d{1,3})(?:/100|%|\s*out of 100)', analysis, re.IGNORECASE)
            score = float(score_match.group(1)) if score_match else 50.0
            
            # Save to database
            conn = get_db()
            if conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO resumes (user_id, filename, original_filename, analysis_result, score, job_description) VALUES (%s, %s, %s, %s, %s, %s)",
                    (session['user_id'], filename, original_filename, analysis, score, job_description or "N/A")
                )
                conn.commit()
                cursor.close()
                conn.close()
            
            results.append({
                "filename": original_filename,
                "score": score,
                "analysis": analysis
            })
        except Exception as e:
            results.append({
                "filename": original_filename,
                "error": f"Analysis error: {str(e)}"
            })
    
    # Sort by score (highest first)
    results_sorted = sorted([r for r in results if 'score' in r], key=lambda x: x['score'], reverse=True)
    errors = [r for r in results if 'error' in r]
    
    return jsonify({
        "success": True,
        "results": results_sorted,
        "errors": errors
    })

@app.route("/download-csv", methods=["POST"])
def download_csv():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    data = request.get_json()
    results = data.get('results', [])
    
    if not results:
        return jsonify({"success": False, "message": "No results to download"}), 400
    
    # Create CSV content
    import io
    import csv
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Rank', 'Resume', 'Score', 'AI Feedback Summary'])
    
    # Rows
    for idx, result in enumerate(results, 1):
        # Extract first 200 chars of analysis as summary
        summary = result.get('analysis', '')[:200].replace('\n', ' ') + '...'
        writer.writerow([
            idx,
            result.get('filename', 'Unknown'),
            result.get('score', 0),
            summary
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    return jsonify({
        "success": True,
        "csv": csv_content,
        "filename": f"resume_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    })

@app.route("/get-resume-history", methods=["GET"])
def get_resume_history():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    
    conn = get_db()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, original_filename, uploaded_at FROM resumes WHERE user_id = %s ORDER BY uploaded_at DESC LIMIT 10",
        (session['user_id'],)
    )
    resumes = cursor.fetchall()
    cursor.close()
    conn.close()
    
    for resume in resumes:
        resume['uploaded_at'] = resume['uploaded_at'].isoformat()
    
    return jsonify({"success": True, "resumes": resumes})

if __name__ == "__main__":
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() in ('1', 'true', 'yes')
    app.run(host=host, port=port, debug=debug)
