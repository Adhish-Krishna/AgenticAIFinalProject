from .Retrieve import RetrieveChunks
from rich import print as rprint
from typing import Union
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

def RAG(object_key: str, query: str) -> Union[str, None]:
  '''
  Retrieves context from the vector database based on the given query.
  Assumes the document has already been chunked and embedded by the ingestion pipeline.
  Arguments:
    object_key: str - the object key of the document in MinIO to query about
    query : str - the query from the user
  Output:
    context : str | None - the retrieved context from the vector database or else return None
  '''

  try:
    retrieve = RetrieveChunks(object_key, query)
    chunks: list = retrieve.retrieveChunks()

    if not chunks:
      rprint("[yellow]No relevant chunks retrieved for query.[/yellow]")
      return None

    context = ""
    for j, chunk in enumerate(chunks):
      content = chunk.get("content", "")
      context += f"Document: {j + 1}\n{content}\n"

    return context

  except Exception as e:
    rprint(f"[red]Unexpected error in RAG: {str(e)}[/red]")
    return None

def _rag_wrapper(object_key: str, query: str) -> str:
        try:
            context = RAG(object_key, query)
            return context if context else "No relevant content found in document"
        except Exception as e:
            return f"Document processing error: {str(e)}"

class DocumentQueryInput(BaseModel):
    object_key: str = Field(..., description="The object key of the document in MinIO")
    query: str = Field(..., description="Specific question or task for the document")

DocumentRetrieverTool = StructuredTool.from_function(
                func=_rag_wrapper,
                name="DocumentRetrieval",
                description="""ONLY use for questions about SPECIFIC DOCUMENTS stored in the object store.
                Requires both object_key and query.
                Input format: {{"object_key": "key-of-object", "query": "your question"}}""",
                args_schema=DocumentQueryInput
            )
