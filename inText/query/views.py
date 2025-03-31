# query/views.py
import os
from django.http import JsonResponse
from dotenv import load_dotenv
from django.views.decorators.csrf import csrf_exempt
from langchain_groq import ChatGroq
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from summarize.views import load_documents

load_dotenv()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

llm = ChatGroq(model="gemma2-9b-it", api_key=GROQ_API_KEY)

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

def process_and_store_documents(docs):
    if not docs:
        return None
    splits = text_splitter.split_documents(docs)
    if not splits:
        return None
    try:
        vector_db = Chroma.from_documents(documents=splits, embedding=embeddings)
        return vector_db.as_retriever()
    except Exception as e:
        return None

def query_documents(retriever, user_query):
    system_prompt = (
        "You are an assistant for question-answering tasks. "
        "Use the retrieved context to answer the question. If unknown, say so. "
        "Keep answers concise, max three sentences.\n\n{context}"
    )
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}")
    ])
    qa_chain = create_stuff_documents_chain(llm, chat_prompt)
    rag_chain = create_retrieval_chain(retriever, qa_chain)
    response = rag_chain.invoke({"input": user_query})
    return response['answer']

@csrf_exempt
def query_view(request):
    if request.method == 'POST':
        source = request.POST.get('source', '').strip()
        user_query = request.POST.get('query', '').strip()
        uploaded_file = request.FILES.get('file')

        if not source and not uploaded_file:
            return JsonResponse({"error": "Source or file and query are required."}, status=400)
        if not user_query:
            return JsonResponse({"error": "Query is required."}, status=400)

        docs = load_documents(source=source, uploaded_file=uploaded_file)
        if isinstance(docs, str):
            return JsonResponse({"error": docs}, status=400)

        if docs:
            retriever = process_and_store_documents(docs)
            if retriever:
                answer = query_documents(retriever, user_query)
                return JsonResponse({"answer": answer})
            else:
                return JsonResponse({"error": "Could not process documents for querying."}, status=400)
        else:
            return JsonResponse({"error": "Could not load documents for querying."}, status=400)

    return JsonResponse({"error": "Invalid request"}, status=400)
