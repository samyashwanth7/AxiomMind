import os

def setup_environment():
    """Validates the environment variables needed for the project."""
    from dotenv import load_dotenv
    load_dotenv()
    
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Neither GEMINI_API_KEY nor GROQ_API_KEY is set. Please add it to your .env file.")
    if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]
        
def format_trace_for_ui(traces):
    """Formats the LangGraph agent traces for the Streamlit UI."""
    formatted = ""
    for idx, trace in enumerate(traces):
        agent = trace.get("agent", "System")
        action = trace.get("action", "")
        formatted += f"**Step {idx + 1}: {agent}**\n{action}\n\n---\n"
    return formatted
