# summarize/views.py
import os
import re
import validators
from dotenv import load_dotenv
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from langchain.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains.summarize import load_summarize_chain
from langchain_community.document_loaders import UnstructuredURLLoader, PyPDFLoader
from langchain.docstore.document import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from io import BytesIO  # Import BytesIO for handling uploaded PDF files

# Load API keys from environment variables
load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

# Initialize LLM
llm = ChatGroq(model="gemma2-9b-it", api_key=GROQ_API_KEY)

# Text Splitter
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

# Extract YouTube Video ID (handles multiple formats)
def extract_video_id(url):
    patterns = [
        r"v=([a-zA-Z0-9_-]+)",          # youtube.com/watch?v=xyz123
        r"youtu\.be/([a-zA-Z0-9_-]+)",   # youtu.be/xyz123
        r"embed/([a-zA-Z0-9_-]+)"        # youtube.com/embed/xyz123
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

# Function to extract YouTube transcript
def get_youtube_transcript(video_url):
    try:
        video_id = extract_video_id(video_url)
        if not video_id:
            return "Invalid YouTube URL."

        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        transcript_text = "\n".join([line["text"] for line in transcript])
        return transcript_text
    except (TranscriptsDisabled, NoTranscriptFound):
        return "Transcript unavailable."
    except Exception as e:
        return f"Error: {e}"

# Function to load documents
def load_documents(source=None, uploaded_file=None):
    docs = list() # Initialize docs list
    if uploaded_file:
        # Handle different file types here
        if uploaded_file.name.endswith(".pdf"):
            try:
                pdf_file = BytesIO(uploaded_file.read())
                loader = PyPDFLoader(pdf_file)
                docs = loader.load_and_split()
            except Exception as e:
                return f"Error loading PDF: {e}"
        else:
            try:
                content = uploaded_file.read().decode('utf-8')
                docs = [Document(page_content=content)]
            except UnicodeDecodeError:
                return "Error decoding the uploaded file. Please ensure it's a valid text-based file."
    elif source:
        if "youtube.com" in source or "youtu.be" in source:
            transcript_text = get_youtube_transcript(source)
            if "Error" in transcript_text or "Transcript unavailable" in transcript_text:
                return transcript_text
            docs = [Document(page_content=transcript_text)]
        elif source.endswith(".pdf"):
            loader = PyPDFLoader(source)
            docs = loader.load_and_split()
        elif validators.url(source):
            loader = UnstructuredURLLoader(urls=[source])
            docs = loader.load()
        return docs

# Function to summarize documents
def summarize(docs):
    if not docs:
        return "No valid content found to summarize."

    chunk_prompt = PromptTemplate(template="Summarize the below text:\n{text}\nSummary:", input_variables=["text"])
    final_prompt = PromptTemplate(template="Provide final summary with key points and a title:\n{text}", input_variables=["text"])

    chain = load_summarize_chain(llm, chain_type="map_reduce", map_prompt=chunk_prompt, combine_prompt=final_prompt, verbose=True)
    return chain.run(docs)

# API endpoint for summarization
@csrf_exempt
def summarize_view(request):
    if request.method == 'POST':
        source = request.POST.get('source', '').strip()
        uploaded_file = request.FILES.get('file')  # Get the uploaded file

        if not source and not uploaded_file:
            return JsonResponse({"error": "No source or file provided."}, status=400)

        docs = load_documents(source=source, uploaded_file=uploaded_file)
        if isinstance(docs, str):  # Error message
            return JsonResponse({"error": docs}, status=400)

        summary = summarize(docs)
        return JsonResponse({"summary": summary})

    return JsonResponse({"error": "Invalid request"}, status=400)