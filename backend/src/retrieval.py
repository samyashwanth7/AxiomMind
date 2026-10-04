import os
import uuid
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Ensure GOOGLE_API_KEY is populated if GEMINI_API_KEY is provided
if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

from langchain_community.document_loaders import PyMuPDFLoader, WebBaseLoader
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

class RetrievalSystem:
    def __init__(self, data_dir: str = "data", index_dir: str = "chroma_db"):
        self.data_dir = data_dir
        self.index_dir = index_dir
        
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            api_key=api_key
        )
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        
        # Ensure directories exist
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.index_dir, exist_ok=True)
        
        # Initialize Chroma
        self.vectorstore = Chroma(
            collection_name="axiommind_gemini",
            embedding_function=self.embeddings,
            persist_directory=self.index_dir
        )

    def _add_to_chroma(self, documents: List[Document]):
        chunks = self.text_splitter.split_documents(documents)
        if chunks:
            self.vectorstore.add_documents(chunks)
        return len(chunks)

    def ingest_pdf(self, file_path: str):
        """Loads a PDF, chunks it, and adds to Chroma."""
        loader = PyMuPDFLoader(file_path)
        documents = loader.load()
        filename = os.path.basename(file_path)
        for doc in documents:
            doc.metadata['source'] = filename
        return self._add_to_chroma(documents)

    def ingest_url(self, url: str):
        """Loads a webpage, chunks it, and adds to Chroma."""
        loader = WebBaseLoader(url)
        documents = loader.load()
        for doc in documents:
            doc.metadata['source'] = url
            doc.metadata['page'] = 1
        return self._add_to_chroma(documents)
        
    def ingest_text(self, text: str, source_name: str = "Pasted Note"):
        """Loads raw text, chunks it, and adds to Chroma."""
        doc = Document(page_content=text, metadata={"source": source_name, "page": 1})
        return self._add_to_chroma([doc])

    def retrieve(self, query: str, k: int = 4) -> List[Dict[str, Any]]:
        """Retrieves top-k chunks for a given query."""
        results = self.vectorstore.similarity_search(query, k=k)
        
        formatted_results = []
        for res in results:
            formatted_results.append({
                "text": res.page_content,
                "source": res.metadata.get("source", "Unknown"),
                "page": res.metadata.get("page", 1)
            })
        return formatted_results

    def format_evidence(self, chunks: List[Dict[str, Any]]) -> str:
        """Formats retrieved chunks into a string for the LLM."""
        formatted = ""
        for i, chunk in enumerate(chunks):
            formatted += f"[Evidence {i+1}] (Source: {chunk['source']}, Page: {chunk['page']})\n"
            formatted += f"{chunk['text']}\n\n"
        return formatted
