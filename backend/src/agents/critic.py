import concurrent.futures
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from src.state import CriticFeedback, ResearchState
from src.retrieval import RetrievalSystem

def build_critic():
    llm = ChatGroq(temperature=0, model_name="qwen/qwen3.8-27b", max_tokens=150, max_retries=2)
    structured_llm = llm.with_structured_output(CriticFeedback)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert fact-checker and research critic. Your job is to evaluate if the provided evidence is sufficient to answer the sub-question. \n"
                   "If sufficient, return sufficient=True. \n"
                   "If insufficient, return sufficient=False and provide a refined_query that a search engine could use to find the missing information."),
        ("human", "Sub-question: {sub_question}\n\nEvidence:\n{evidence}")
    ])
    
    return prompt | structured_llm

def evaluate_sub_question(sq, evidence_dict, critic_feedbacks, retries, critic_chain, retrieval_sys):
    is_already_sufficient = sq in critic_feedbacks and critic_feedbacks[sq].sufficient
    max_retries_reached = retries.get(sq, 0) >= 2
    
    if is_already_sufficient or max_retries_reached:
        return sq, critic_feedbacks.get(sq), []
        
    chunks = evidence_dict.get(sq, [])
    formatted_evidence = retrieval_sys.format_evidence(chunks)
    
    feedback = critic_chain.invoke({
        "sub_question": sq,
        "evidence": formatted_evidence
    })
    
    status_msg = "SUFFICIENT" if feedback.sufficient else f"INSUFFICIENT (Refined Query: {feedback.refined_query})"
    trace = {"agent": "Critic", "action": f"Critique for '{sq}': {status_msg}"}
    
    return sq, feedback, [trace]

def critic_node(state: ResearchState):
    critic = build_critic()
    retrieval_sys = RetrievalSystem()
    
    sub_questions = state.get("sub_questions", [])
    evidence_dict = state.get("evidence", {})
    critic_feedbacks = state.get("critic_feedbacks", {})
    retries = state.get("retries", {})
    
    all_traces = []
    
    # Parallelize the critic LLM calls
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(evaluate_sub_question, sq, evidence_dict, critic_feedbacks, retries, critic, retrieval_sys): sq 
            for sq in sub_questions
        }
        
        for future in concurrent.futures.as_completed(futures):
            sq, feedback, traces = future.result()
            if feedback:
                critic_feedbacks[sq] = feedback
            all_traces.extend(traces)

    return {
        "critic_feedbacks": critic_feedbacks,
        "traces": all_traces
    }
