import os

def setup_environment():
    """Validates the environment variables needed for the project."""
    from dotenv import load_dotenv
    load_dotenv()
    
    if not os.environ.get("GROQ_API_KEY"):
        raise ValueError("GROQ_API_KEY environment variable is not set. Please add it to your .env file.")
        
def format_trace_for_ui(traces):
    """Formats the LangGraph agent traces for the Streamlit UI."""
    formatted = ""
    for idx, trace in enumerate(traces):
        agent = trace.get("agent", "System")
        action = trace.get("action", "")
        formatted += f"**Step {idx + 1}: {agent}**\n{action}\n\n---\n"
    return formatted
