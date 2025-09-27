from langchain_ollama import ChatOllama
from langgraph_supervisor import create_supervisor
from .tools import DocumentRetrieverTool, WebSearchTool, WebScraperTool, SaveContentTool
from langchain_google_genai import ChatGoogleGenerativeAI
from .subagents import ReActSubAgent
from .prompts import contentResearcherPrompt, worksheetGeneratorPrompt, supervisorPrompt
from langchain_groq import ChatGroq
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient
from envconfig import GOOGLE_API_KEY, GOOGLE_MODEL_NAME, OLLAMA_MODEL, MODEL_PROVIDER, GROQ_API_KEY, GROQ_MODEL_NAME, MONGO_DB_URI, OLLAMA_THINKING

class SUDARAgent:
    def __init__(self, model_provider: str = None, model_name: str = None):
        
        # Use provided parameters or fallback to environment variables
        provider = model_provider or MODEL_PROVIDER
        
        if provider == 'groq':
            model = model_name or GROQ_MODEL_NAME
            self.llm_model = ChatGroq(model=model)
        elif provider == 'google':
            model = model_name or GOOGLE_MODEL_NAME
            self.llm_model = ChatGoogleGenerativeAI(model=model)
        else:  # default to ollama
            model = model_name or OLLAMA_MODEL
            self.llm_model = ChatOllama(model=model, reasoning=True if OLLAMA_THINKING == 'true' else False)

        self.client = MongoClient(MONGO_DB_URI)
        self.memory = MongoDBSaver(
            client=self.client,
            connection_string=MONGO_DB_URI,
            db_name="SUDAR"
        )
   
        self.AGENT_CONFIG = {
            "temperature": 0.7,
            "max_tokens": 2048,
            "system_name": "Sudar AI Educational Assistant",
            "version": "1.0.0"
        }

        self.content_researcher = ReActSubAgent()
        self.worksheet_generator = ReActSubAgent()
    
        self.orchestrator = create_supervisor(
            agents = [self.content_researcher(self.llm_model, "ContentResearcher",[DocumentRetrieverTool, WebScraperTool, WebSearchTool], contentResearcherPrompt), self.worksheet_generator(self.llm_model, "WorksheetGenerator", [SaveContentTool], worksheetGeneratorPrompt)],
            model = self.llm_model,
            tools=[SaveContentTool],
            prompt = supervisorPrompt,
            add_handoff_back_messages=True,
            output_mode="full_history"
        )

    def get_agent(self):
        return self.orchestrator.compile(checkpointer=self.memory)








