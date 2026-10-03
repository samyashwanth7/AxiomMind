from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from src.state import EvaluatorScorecard, ResearchState
from src.retrieval import RetrievalSystem

def build_evaluator():
    llm = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile")
    structured_llm = llm.with_structured_output(EvaluatorScorecard)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert evaluator. Score the provided research report based on the evidence provided and the original query.
        
Calculate the following scores (0-100):
- Faithfulness: Are the claims in the report supported by the retrieved evidence? (If it includes external unverified info, score lower).
- Relevance: Does the report directly answer the original user query?
- Citation Coverage: What percentage of factual claims in the report have an explicit citation (e.g., [Source: X, Page: Y])?

Provide qualitative feedback summarizing the strengths and weaknesses.
"""),
        ("human", "Original Query: {query}\n\nEvidence:\n{evidence}\n\nReport to Evaluate:\n{report}")
    ])
    
    return prompt | structured_llm

def evaluator_node(state: ResearchState):
    evaluator = build_evaluator()
    retrieval_sys = RetrievalSystem()
    
    compiled_evidence = ""
    for sq in state.get("sub_questions", []):
        chunks = state.get("evidence", {}).get(sq, [])
        compiled_evidence += retrieval_sys.format_evidence(chunks)
        compiled_evidence += "\n"
        
    scorecard = evaluator.invoke({
        "query": state["query"],
        "evidence": compiled_evidence,
        "report": state["report"]
    })
    
    # Store scorecard as dict for easy serialization
    scorecard_dict = scorecard.dict()
    
    traces = [{"agent": "Evaluator", "action": f"Evaluated report. Faithfulness: {scorecard_dict['faithfulness']}, Relevance: {scorecard_dict['relevance']}"}]
    
    return {
        "scorecard": scorecard_dict,
        "traces": traces
    }
