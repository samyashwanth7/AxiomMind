import streamlit as st
import os
import tempfile
from src.retrieval import RetrievalSystem
from src.graph import build_graph
from src.utils import setup_environment, format_trace_for_ui

st.set_page_config(page_title="AxiomMind", page_icon="🧠", layout="wide")

try:
    setup_environment()
except ValueError as e:
    st.error(str(e))
    st.stop()

st.title("🧠 AxiomMind — Multi-Agent Academic Research Assistant")
st.markdown("A LangGraph-orchestrated system that plans, retrieves, critiques, writes, and evaluates research reports.")

# Initialize session state
if "retrieval_system" not in st.session_state:
    st.session_state.retrieval_system = RetrievalSystem()
if "graph" not in st.session_state:
    st.session_state.graph = build_graph()
if "run_result" not in st.session_state:
    st.session_state.run_result = None

# Sidebar for PDF Upload
with st.sidebar:
    st.header("1. Upload Documents")
    uploaded_files = st.file_uploader("Upload PDF papers", type="pdf", accept_multiple_files=True)
    if st.button("Process PDFs"):
        if not uploaded_files:
            st.warning("Please upload at least one PDF.")
        else:
            with st.spinner("Chunking and building FAISS index..."):
                total_chunks = 0
                for file in uploaded_files:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                        tmp.write(file.getvalue())
                        tmp_path = tmp.name
                    chunks_added = st.session_state.retrieval_system.ingest_pdf(tmp_path)
                    total_chunks += chunks_added
                    os.unlink(tmp_path)
                st.success(f"Successfully processed {len(uploaded_files)} files into {total_chunks} chunks.")

# Main area tabs
tab1, tab2, tab3 = st.tabs(["Ask Question & Report", "Agent Trace", "Scorecard"])

with tab1:
    st.header("2. Ask a Research Question")
    query = st.text_area("Enter your research query (e.g., 'What are the main mechanisms of attention in transformers?'):")
    
    if st.button("Run Research Agent Workflow"):
        if not query:
            st.warning("Please enter a query.")
        else:
            with st.spinner("Agents are researching... (This may take a minute)"):
                initial_state = {
                    "query": query,
                    "sub_questions": [],
                    "evidence": {},
                    "critic_feedbacks": {},
                    "retries": {},
                    "report": "",
                    "scorecard": {},
                    "traces": []
                }
                
                # Run LangGraph workflow
                result = st.session_state.graph.invoke(initial_state)
                st.session_state.run_result = result
                st.success("Workflow completed!")

    if st.session_state.run_result:
        st.subheader("Final Report")
        st.markdown(st.session_state.run_result.get("report", "No report generated."))

with tab2:
    st.header("Agent Execution Trace")
    if st.session_state.run_result:
        traces = st.session_state.run_result.get("traces", [])
        st.markdown(format_trace_for_ui(traces))
    else:
        st.info("Run a query to see the agent trace here.")

with tab3:
    st.header("Evaluator Scorecard")
    if st.session_state.run_result:
        scorecard = st.session_state.run_result.get("scorecard", {})
        if scorecard:
            col1, col2, col3 = st.columns(3)
            col1.metric("Faithfulness", f"{scorecard.get('faithfulness', 0)}/100")
            col2.metric("Relevance", f"{scorecard.get('relevance', 0)}/100")
            col3.metric("Citation Coverage", f"{scorecard.get('citation_coverage', 0)}/100")
            
            st.subheader("Feedback")
            st.write(scorecard.get('feedback', 'No feedback.'))
        else:
            st.info("No scorecard available.")
    else:
        st.info("Run a query to see the evaluation scorecard here.")
