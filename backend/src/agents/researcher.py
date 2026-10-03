import concurrent.futures
from src.retrieval import RetrievalSystem
from src.state import ResearchState

# Instantiate global retrieval system
retrieval_system = RetrievalSystem()

def retrieve_for_sub_question(sq, evidence_dict, critic_feedbacks, retries):
    traces_for_sq = []
    
    # First time retrieving for this sub-question
    if sq not in evidence_dict:
        chunks = retrieval_system.retrieve(sq, k=4)
        traces_for_sq.append({"agent": "Researcher", "action": f"Retrieved {len(chunks)} chunks for sub-question: '{sq}'"})
        return sq, chunks, 0, traces_for_sq
        
    # Retrieval triggered by Critic due to insufficient evidence
    elif sq in critic_feedbacks and not critic_feedbacks[sq].sufficient:
        current_retries = retries.get(sq, 0)
        if current_retries < 2:
            refined_query = critic_feedbacks[sq].refined_query
            traces_for_sq.append({"agent": "Researcher", "action": f"Retrieving MORE evidence using refined query: '{refined_query}'"})
            
            new_chunks = retrieval_system.retrieve(refined_query, k=3)
            
            # Deduplicate based on text
            existing_texts = set([chunk["text"] for chunk in evidence_dict[sq]])
            unique_new_chunks = [c for c in new_chunks if c["text"] not in existing_texts]
            
            combined_chunks = evidence_dict[sq] + unique_new_chunks
            
            traces_for_sq.append({"agent": "Researcher", "action": f"Added {len(unique_new_chunks)} unique new chunks. Retry count: {current_retries + 1}/2"})
            return sq, combined_chunks, current_retries + 1, traces_for_sq
        else:
            traces_for_sq.append({"agent": "Researcher", "action": f"Max retries (2) reached for sub-question: '{sq}'. Using available evidence."})
            return sq, evidence_dict[sq], current_retries, traces_for_sq
            
    # If no action needed, return existing
    return sq, evidence_dict.get(sq, []), retries.get(sq, 0), traces_for_sq


def researcher_node(state: ResearchState):
    evidence_dict = state.get("evidence", {})
    critic_feedbacks = state.get("critic_feedbacks", {})
    retries = state.get("retries", {})
    sub_questions = state.get("sub_questions", [])
    
    all_traces = []
    
    # Parallelize the retrieval process
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(retrieve_for_sub_question, sq, evidence_dict, critic_feedbacks, retries): sq 
            for sq in sub_questions
        }
        
        for future in concurrent.futures.as_completed(futures):
            sq, chunks, new_retries, traces = future.result()
            evidence_dict[sq] = chunks
            retries[sq] = new_retries
            all_traces.extend(traces)
                
    return {
        "evidence": evidence_dict,
        "retries": retries,
        "traces": all_traces
    }
