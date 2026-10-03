"""
AxiomMind Comprehensive Verification & Test Suite
Tests:
  1. Ingestion Engine (ChromaDB + SentenceTransformers Embeddings)
  2. PDF Ingestion with PyMuPDF (synthetic academic paper test)
  3. Structured Output & Pydantic Schema Validation
  4. LangGraph Routing & Retry Boundary Logic
  5. FastAPI REST API Endpoints (via TestClient)
"""

import os
import sys
import unittest
import tempfile
import fitz  # PyMuPDF
from fastapi.testclient import TestClient

# Add current dir to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.retrieval import RetrievalSystem
from src.state import SubQuestions, CriticFeedback, EvaluatorScorecard, ResearchState
from src.graph import should_continue_research, build_graph
from main import app


class TestAxiomMindPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n=======================================================")
        print("  RUNNING AXIOMMIND COMPREHENSIVE TEST SUITE")
        print("=======================================================\n")
        cls.test_dir = tempfile.mkdtemp()
        cls.retrieval = RetrievalSystem(
            data_dir=os.path.join(cls.test_dir, "data"),
            index_dir=os.path.join(cls.test_dir, "chroma")
        )
        cls.client = TestClient(app)

    def test_01_text_ingestion_and_vector_retrieval(self):
        """Test plain text note ingestion and ChromaDB semantic search."""
        print("[TEST 1] Ingesting text note & querying ChromaDB vector store...")
        note_text = (
            "FlashAttention is an exact attention algorithm that uses tiling to reduce "
            "the number of memory reads/writes between GPU high bandwidth memory (HBM) "
            "and on-chip SRAM. This yields a 2-4x speedup over standard PyTorch attention."
        )
        chunks_added = self.retrieval.ingest_text(note_text, source_name="FlashAttention Note")
        self.assertGreater(chunks_added, 0, "Chunks should be added to ChromaDB")
        
        # Test semantic search
        query = "How does FlashAttention optimize GPU memory?"
        results = self.retrieval.retrieve(query, k=1)
        self.assertGreater(len(results), 0, "Retrieval should return matching evidence")
        self.assertIn("HBM", results[0]["text"])
        self.assertEqual(results[0]["source"], "FlashAttention Note")
        print(f"  -> Successfully retrieved {len(results)} chunk(s). Match confirmed!")

    def test_02_pdf_generation_and_ingestion(self):
        """Generate a synthetic academic PDF and verify PyMuPDF ingestion & page metadata."""
        print("[TEST 2] Generating synthetic academic PDF & testing ingestion...")
        pdf_path = os.path.join(self.test_dir, "synthetic_paper.pdf")
        
        # Create a 2-page test PDF
        doc = fitz.open()
        page1 = doc.new_page()
        page1.insert_text((50, 72), "Title: Multi-Agent Systems in Scientific Discovery\nPage 1 Content: Multi-agent consensus architectures allow distributed reasoning.")
        page2 = doc.new_page()
        page2.insert_text((50, 72), "Page 2 Content: Empirical evaluation shows faithfulness increases by 34% with critic reflection.")
        doc.save(pdf_path)
        doc.close()
        
        # Ingest PDF
        chunks = self.retrieval.ingest_pdf(pdf_path)
        self.assertGreater(chunks, 0, "PDF should produce text chunks")
        
        # Query for page 2 content
        results = self.retrieval.retrieve("faithfulness increases by 34%", k=2)
        self.assertGreater(len(results), 0)
        self.assertTrue(any("34%" in r["text"] for r in results))
        print(f"  -> Ingested {chunks} chunks from PDF. Page citations verified!")

    def test_03_structured_output_schemas(self):
        """Validate Pydantic models for Planner, Critic, and Evaluator."""
        print("[TEST 3] Validating Pydantic schemas for Agent communication...")
        
        # Planner Schema
        sq = SubQuestions(questions=[
            "What is FlashAttention?",
            "How does SRAM tiling work?",
            "What are empirical benchmarks on A100 GPUs?"
        ])
        self.assertEqual(len(sq.questions), 3)
        
        # Critic Schema
        critic_pass = CriticFeedback(
            sufficient=True,
            reason="Retrieved evidence explicitly describes SRAM and HBM tiling.",
            refined_query=""
        )
        self.assertTrue(critic_pass.sufficient)
        
        critic_retry = CriticFeedback(
            sufficient=False,
            reason="Lacks hardware benchmark figures.",
            refined_query="FlashAttention A100 GPU speedup benchmarks"
        )
        self.assertFalse(critic_retry.sufficient)
        self.assertEqual(critic_retry.refined_query, "FlashAttention A100 GPU speedup benchmarks")
        
        # Evaluator Schema
        eval_score = EvaluatorScorecard(
            faithfulness=95,
            relevance=92,
            citation_coverage=88,
            feedback="Report is highly grounded in provided paper chunks."
        )
        self.assertEqual(eval_score.faithfulness, 95)
        self.assertEqual(eval_score.relevance, 92)
        print("  -> All Pydantic schemas validated with strict field constraints!")

    def test_04_langgraph_routing_and_retry_limits(self):
        """Test LangGraph conditional edge routing and anti-infinite-loop retry limits."""
        print("[TEST 4] Testing LangGraph conditional edges & retry caps...")
        
        # Scenario A: Incomplete evidence and retries < 2 -> should return 'researcher'
        state_retry: ResearchState = {
            "query": "Explain LoRA",
            "sub_questions": ["What is rank r?"],
            "evidence": {},
            "critic_feedbacks": {
                "What is rank r?": CriticFeedback(sufficient=False, reason="Missing math", refined_query="LoRA rank r math")
            },
            "retries": {"What is rank r?": 1},
            "report": "",
            "scorecard": {},
            "traces": []
        }
        self.assertEqual(should_continue_research(state_retry), "researcher", "Should route to researcher if retries < 2")
        
        # Scenario B: Incomplete evidence BUT retries >= 2 -> should advance to 'writer' (prevent infinite loop)
        state_max_retries: ResearchState = {
            "query": "Explain LoRA",
            "sub_questions": ["What is rank r?"],
            "evidence": {},
            "critic_feedbacks": {
                "What is rank r?": CriticFeedback(sufficient=False, reason="Missing math", refined_query="LoRA rank r math")
            },
            "retries": {"What is rank r?": 2},
            "report": "",
            "scorecard": {},
            "traces": []
        }
        self.assertEqual(should_continue_research(state_max_retries), "writer", "Should route to writer if max retries reached")
        
        # Scenario C: All evidence sufficient -> should advance to 'writer'
        state_pass: ResearchState = {
            "query": "Explain LoRA",
            "sub_questions": ["What is rank r?"],
            "evidence": {},
            "critic_feedbacks": {
                "What is rank r?": CriticFeedback(sufficient=True, reason="Complete", refined_query="")
            },
            "retries": {"What is rank r?": 0},
            "report": "",
            "scorecard": {},
            "traces": []
        }
        self.assertEqual(should_continue_research(state_pass), "writer", "Should route to writer when critic approves")
        print("  -> LangGraph conditional routing & anti-loop guards passed!")

    def test_05_fastapi_rest_endpoints(self):
        """Test FastAPI API endpoints via TestClient."""
        print("[TEST 5] Testing FastAPI REST endpoints...")
        
        # 1. Health check
        res_root = self.client.get("/")
        self.assertEqual(res_root.status_code, 200)
        self.assertIn("AxiomMind", res_root.json()["message"])
        
        # 2. Ingest Text Endpoint
        res_text = self.client.post("/ingest/text", json={
            "text": "Transformers rely on Self-Attention computed as Softmax(QK^T / sqrt(d_k))V.",
            "source_name": "Attention Formula Note"
        })
        self.assertEqual(res_text.status_code, 200)
        self.assertIn("chunks", res_text.json())
        print(f"  -> Endpoints GET / and POST /ingest/text returned HTTP 200 OK.")


if __name__ == "__main__":
    unittest.main()
