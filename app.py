import os
import base64
import uuid
import pymupdf
from flask import Flask, request, jsonify, render_template, send_from_directory
from PyPDF2 import PdfReader
from dotenv import load_dotenv

# LangChain / RAG Components
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

# Load environment variables (from .env file if present)
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

# In-memory storage for vector stores to keep backend clean and stateless
# Key: session_id, Value: FAISS vector database
vector_stores = {}

def extract_text_from_pdfs(pdf_files_data):
    """Extracts raw text from list of PDF file bytes."""
    text = ""
    for file_bytes in pdf_files_data:
        # Wrap bytes in a pymupdf Document or use PyPDF2
        # PyPDF2 is safer for extracting text from raw bytes
        import io
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def convert_pdf_to_images(pdf_files_data):
    """Converts pages of uploaded PDFs into PNG bytes."""
    pages_png = []
    for file_bytes in pdf_files_data:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            png_bytes = pix.tobytes("png")
            pages_png.append(png_bytes)
        doc.close()
    return pages_png

def build_vector_store(text):
    """Splits text and builds a FAISS vector store with HuggingFace embeddings."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_text(text)
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return FAISS.from_texts(chunks, embeddings)

@app.route('/')
def index():
    """Serve the main application HTML page."""
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Endpoint to handle uploading PDF files, rendering slides, and building vector database."""
    session_id = request.form.get('session_id')
    if not session_id:
        session_id = str(uuid.uuid4())

    uploaded_files = request.files.getlist('files')
    if not uploaded_files or len(uploaded_files) == 0:
        return jsonify({"error": "No files uploaded"}), 400

    try:
        pdf_data = []
        for file in uploaded_files:
            pdf_data.append(file.read())

        # Extract text for QA
        text = extract_text_from_pdfs(pdf_data)
        
        # Build FAISS vector store in a background variable if text is present
        if text.strip():
            vector_stores[session_id] = build_vector_store(text)
        else:
            return jsonify({"error": "No extractable text found in the uploaded PDFs."}), 400

        # Convert PDF pages to images
        png_pages = convert_pdf_to_images(pdf_data)
        base64_slides = []
        for pg in png_pages:
            b64_str = base64.b64encode(pg).decode('utf-8')
            base64_slides.append(f"data:image/png;base64,{b64_str}")

        return jsonify({
            "status": "success",
            "session_id": session_id,
            "slides": base64_slides,
            "message": f"Successfully processed {len(base64_slides)} slides."
        })

    except Exception as e:
        return jsonify({"error": f"Failed to process files: {str(e)}"}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Endpoint to ask questions about the uploaded PDF."""
    data = request.json or {}
    session_id = data.get('session_id')
    question = data.get('question')
    history = data.get('history', [])

    if not question:
        return jsonify({"error": "Question is required."}), 400

    if not session_id or session_id not in vector_stores:
        return jsonify({"error": "No active document session. Please upload PDFs first."}), 400

    # Determine Groq API Key
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return jsonify({"error": "Groq API key not configured. Please set the GROQ_API_KEY environment variable or place it in a .env file."}), 400

    try:
        vector_store = vector_stores[session_id]
        
        # Similarity search on FAISS
        docs = vector_store.similarity_search(question, k=3)
        context = "\n\n".join(d.page_content for d in docs)

        # Format conversation history for the prompt
        # We only keep the last 6 messages to avoid bloating the context window
        history_str = ""
        for msg in history[-6:]:
            role = msg.get('role', 'user').capitalize()
            content = msg.get('content', '')
            history_str += f"{role}: {content}\n"

        template = """You are a helpful assistant for a PDF document.
Use the context below to answer the user's question accurately.
If the question is unrelated to the document, politely say so.
Do not make up information not in the context.

Context:
{context}

Conversation history:
{history}

Question: {question}
Answer (Be concise and conversational. Do NOT copy the context verbatim):"""

        prompt_template = PromptTemplate.from_template(template)
        llm = ChatGroq(
            groq_api_key=api_key,
            model_name="openai/gpt-oss-20b",
            temperature=0.4,
        )
        chain = prompt_template | llm
        
        response = chain.invoke({
            "context": context,
            "question": question,
            "history": history_str
        })
        
        # Clean up any thinking/reasoning tags if generated by models
        import re
        answer = response.content
        answer = re.sub(r'<think>.*?</think>', '', answer, flags=re.DOTALL).strip()
        
        return jsonify({
            "status": "success",
            "answer": answer
        })

    except Exception as e:
        return jsonify({"error": f"AI Response failed: {str(e)}"}), 500

@app.route('/api/unload', methods=['POST'])
def unload():
    """Unloads the session's vector store and free memory."""
    data = request.json or {}
    session_id = data.get('session_id')
    if session_id and session_id in vector_stores:
        del vector_stores[session_id]
        return jsonify({"status": "success", "message": "Document unloaded successfully."})
    return jsonify({"status": "error", "message": "No active session to unload."})

if __name__ == '__main__':
    # Get port from environment or default to 5000 (standard for local development)
    port = int(os.environ.get("PORT", 5000))
    # Run server
    app.run(host='0.0.0.0', port=port, debug=True)
