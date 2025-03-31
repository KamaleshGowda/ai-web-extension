# summarize/views.py
import os
import tempfile
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
from io import BytesIO

load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

llm = ChatGroq(model="gemma2-9b-it", api_key=GROQ_API_KEY)

text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

def extract_video_id(url):
    patterns = [
        r"v=([a-zA-Z0-9_-]+)",
        r"youtu\.be/([a-zA-Z0-9_-]+)",
        r"embed/([a-zA-Z0-9_-]+)"
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

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

def load_pdf(pdf_source):
    try:
        loader = PyPDFLoader(pdf_source)
        docs = loader.load_and_split()
        return docs
    except Exception as e:
        return f"Error loading PDF: {e}"

def load_documents(source=None, uploaded_file=None):
    docs = list()
    if uploaded_file:
        if uploaded_file.name.endswith(".pdf"):
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                    for chunk in uploaded_file.chunks():
                        tmp_file.write(chunk)
                    temp_file_path = tmp_file.name
                loader = PyPDFLoader(temp_file_path)
                docs = loader.load_and_split()
                os.unlink(temp_file_path)
            except Exception as e:
                if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                return f"Error processing uploaded PDF: {e}"
        else:
            try:
                content = uploaded_file.read().decode("utf-8")
                docs = [Document(page_content=content)]
            except UnicodeDecodeError:
                return "Error decoding the uploaded file. Please ensure it's a valid text-based file."
    elif source:
        if (
            "youtube.com" in source
            or "youtu.be" in source
        ):
            transcript_text = get_youtube_transcript(source)
            if "Error" in transcript_text or "Transcript unavailable" in transcript_text:
                return transcript_text
            docs = [Document(page_content=transcript_text)]
        elif source.endswith(".pdf"):
            try:
                loader = PyPDFLoader(source)
                docs = loader.load_and_split()
            except Exception as e:
                return f"Error loading PDF from URL: {e}"
        elif validators.url(source):
            loader = UnstructuredURLLoader(urls=[source])
            docs = loader.load()
    return docs

def summarize(docs):
    if not docs:
        return "No valid content found to summarize."
    chunk_prompt = PromptTemplate(template="Summarize the below text:\n{text}\nSummary:", input_variables=["text"])
    final_prompt = PromptTemplate(template="Provide final summary with key points and a title:\n{text}", input_variables=["text"])
    chain = load_summarize_chain(llm, chain_type="map_reduce", map_prompt=chunk_prompt, combine_prompt=final_prompt, verbose=True)
    return chain.run(docs)

@csrf_exempt
def summarize_view(request):
    if request.method == 'POST':
        source = request.POST.get('source', '').strip()
        uploaded_file = request.FILES.get('file')

        if not source and not uploaded_file:
            return JsonResponse({"error": "No source or file provided."}, status=400)

        docs = load_documents(source=source, uploaded_file=uploaded_file)
        if isinstance(docs, str):
            return JsonResponse({"error": docs}, status=400)

        summary = summarize(docs)
        return JsonResponse({"summary": summary})

    return JsonResponse({"error": "Invalid request"}, status=400)
