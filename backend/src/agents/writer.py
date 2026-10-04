from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from src.state import ResearchState
from src.retrieval import RetrievalSystem

def build_compressor():
    llm = ChatGroq(temperature=0, model_name="openai/gpt-oss-120b", max_tokens=350)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert context compressor. Your job is to extract ONLY the sentences and facts relevant to the sub-question from the provided evidence. 
        You MUST retain the original citations/metadata (e.g., [Source: X, Page: Y]) attached to the facts you extract.
        If the evidence is irrelevant, output 'No relevant evidence found.'
        Be concise."""),
        ("human", "Sub-question: {sub_question}\n\nRaw Evidence:\n{evidence}")
    ])
    return prompt | llm | StrOutputParser()

def build_writer():
    llm = ChatGroq(temperature=0.2, model_name="openai/gpt-oss-120b")
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert academic writer. Your task is to write a comprehensive, well-structured research report based ONLY on the provided extracted evidence. 
        
Requirements:
1. Synthesize the findings clearly.
2. Structure the report with an Introduction, sections for each sub-question/topic, and a Conclusion.
3. You MUST cite your claims using the metadata provided in the evidence (e.g., [Source: filename, Page: X]). Place citations inline at the end of the relevant sentence.
4. If the evidence is insufficient to answer a part of the query, explicitly state that the uploaded documents do not provide enough information. DO NOT hallucinate external knowledge.
5. Format the output in Markdown.
"""),
        ("human", "Original Query: {query}\n\nExtracted Evidence across sub-questions:\n{evidence}")
    ])
    
    return prompt | llm | StrOutputParser()

def writer_node(state: ResearchState):
    compressor = build_compressor()
    writer = build_writer()
    retrieval_sys = RetrievalSystem()
    
    traces = []
    
    # 1. Compress Evidence
    compressed_evidence = ""
    for sq in state.get("sub_questions", []):
        chunks = state.get("evidence", {}).get(sq, [])
        formatted_raw = retrieval_sys.format_evidence(chunks)
        
        extracted = compressor.invoke({
            "sub_question": sq,
            "evidence": formatted_raw
        })
        
        compressed_evidence += f"### Evidence for: {sq}\n{extracted}\n\n"
        
    traces.append({"agent": "Writer (Compressor)", "action": "Extracted key facts from raw evidence to reduce context noise."})
        
    # 2. Write Report
    report = writer.invoke({
        "query": state["query"],
        "evidence": compressed_evidence
    })
    
    traces.append({"agent": "Writer", "action": "Drafted final markdown report with citations based on compressed context."})
    
    return {
        "report": report,
        "traces": traces
    }
