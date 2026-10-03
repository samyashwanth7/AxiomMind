from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import tempfile
import shutil

from src.retrieval import RetrievalSystem
from src.graph import build_graph
from src.utils import setup_environment

# Ensure environment is set
setup_environment()

app = FastAPI(title="AxiomMind API", description="Autonomous Multi-Agent Academic Research Backend")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

retrieval_system = RetrievalSystem()
graph = build_graph()

class QueryRequest(BaseModel):
    query: str

class IngestUrlRequest(BaseModel):
    url: str

class IngestTextRequest(BaseModel):
    text: str
    source_name: str = "Pasted Note"

@app.get("/")
def read_root():
    return {"message": "AxiomMind API is running!"}

@app.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        # Save temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        chunks = retrieval_system.ingest_pdf(tmp_path)
        os.unlink(tmp_path)
        return {"message": f"Successfully ingested PDF: {file.filename}", "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/url")
def ingest_url(request: IngestUrlRequest):
    try:
        chunks = retrieval_system.ingest_url(request.url)
        return {"message": f"Successfully ingested URL: {request.url}", "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/text")
def ingest_text(request: IngestTextRequest):
    try:
        chunks = retrieval_system.ingest_text(request.text, request.source_name)
        return {"message": f"Successfully ingested text note: {request.source_name}", "chunks": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research")
def run_research(request: QueryRequest):
    try:
        initial_state = {
            "query": request.query,
            "sub_questions": [],
            "evidence": {},
            "critic_feedbacks": {},
            "retries": {},
            "report": "",
            "scorecard": {},
            "traces": []
        }
        
        result = graph.invoke(initial_state)
        
        return {
            "report": result.get("report"),
            "scorecard": result.get("scorecard"),
            "traces": result.get("traces")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
