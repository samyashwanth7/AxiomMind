from langgraph.graph import StateGraph, END
from src.state import ResearchState
from src.agents.planner import planner_node
from src.agents.researcher import researcher_node
from src.agents.critic import critic_node
from src.agents.writer import writer_node
from src.agents.evaluator import evaluator_node

def should_continue_research(state: ResearchState):
    """
    Conditional edge logic after Critic.
    If all sub-questions are sufficient OR have reached max retries, go to Writer.
    Otherwise, route back to Researcher.
    """
    critic_feedbacks = state.get("critic_feedbacks", {})
    sub_questions = state.get("sub_questions", [])
    retries = state.get("retries", {})
    
    for sq in sub_questions:
        feedback = critic_feedbacks.get(sq)
        if feedback is None:
            # Hasn't been critiqued yet (shouldn't happen with our current logic, but safety first)
            return "researcher"
            
        if not feedback.sufficient and retries.get(sq, 0) < 2:
            return "researcher"
            
    return "writer"

def build_graph():
    workflow = StateGraph(ResearchState)
    
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("evaluator", evaluator_node)
    
    workflow.set_entry_point("planner")
    
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("researcher", "critic")
    
    # Conditional edge after critic
    workflow.add_conditional_edges(
        "critic",
        should_continue_research,
        {
            "researcher": "researcher",
            "writer": "writer"
        }
    )
    
    workflow.add_edge("writer", "evaluator")
    workflow.add_edge("evaluator", END)
    
    return workflow.compile()
