from typing import Annotated, TypedDict, List, Dict, Any
import operator
from pydantic import BaseModel, Field

# Pydantic schemas for structured outputs

class SubQuestions(BaseModel):
    questions: List[str] = Field(description="A list of 3-5 sub-questions covering different aspects of the original query.")

class CriticFeedback(BaseModel):
    sufficient: bool = Field(description="True if the evidence is sufficient to answer the sub-question, False otherwise.")
    reason: str = Field(description="Explanation of why the evidence is sufficient or insufficient.")
    refined_query: str = Field(default="", description="If insufficient, provide a refined query to search for more evidence.")

class EvaluatorScorecard(BaseModel):
    faithfulness: int = Field(description="Score from 0 to 100 indicating if the report is grounded in the retrieved evidence.")
    relevance: int = Field(description="Score from 0 to 100 indicating if the report answers the original user query.")
    citation_coverage: int = Field(description="Score from 0 to 100 indicating the percentage of claims that are properly cited.")
    feedback: str = Field(description="Qualitative feedback on the overall quality of the report.")

# State for LangGraph

class ResearchState(TypedDict):
    query: str
    sub_questions: List[str]
    
    # Dictionary mapping sub-question -> list of retrieved text chunks with metadata
    evidence: Dict[str, List[Dict[str, Any]]]
    
    # Dictionary mapping sub-question -> CriticFeedback
    critic_feedbacks: Dict[str, CriticFeedback]
    
    # Dictionary mapping sub-question -> number of retries
    retries: Dict[str, int]
    
    report: str
    scorecard: Dict[str, Any]
    
    # List of traces for observability
    traces: Annotated[List[Dict[str, str]], operator.add]
