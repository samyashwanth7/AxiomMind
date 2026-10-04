from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from src.state import SubQuestions
import os

def build_planner():
    llm = ChatGoogleGenerativeAI(temperature=0, model="gemini-3.5-flash-lite")
    structured_llm = llm.with_structured_output(SubQuestions)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert academic research planner. Given a user's research query, break it down into 3-5 specific, distinct sub-questions that need to be answered to fully address the query. Ensure the questions are focused and cover different angles (e.g., definitions, mechanisms, impacts, evidence)."),
        ("human", "Research query: {query}")
    ])
    
    return prompt | structured_llm

def planner_node(state):
    planner = build_planner()
    result = planner.invoke({"query": state["query"]})
    
    trace_msg = f"Planner decomposed query into {len(result.questions)} sub-questions:\n" + "\n".join([f"- {q}" for q in result.questions])
    
    return {
        "sub_questions": result.questions,
        "traces": [{"agent": "Planner", "action": trace_msg}]
    }
