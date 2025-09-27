from qdrant_client import QdrantClient
from qdrant_client.http.models import Filter, FieldCondition, MatchValue
from envconfig import QDRANT_URL
from rich.console import Console

console = Console()

class VectorService:
    def __init__(self):
        self.client = QdrantClient(url=QDRANT_URL)
        self.collection_name = "sudar-ai"
    
    def delete_chat_embeddings(self, user_id: str, chat_id: str) -> int:
        """Delete all vector embeddings for a specific chat"""
        try:
            # Check if collection exists
            if not self.client.collection_exists(collection_name=self.collection_name):
                console.print(f"Vector DB collection '{self.collection_name}' does not exist!", style="yellow")
                return 0
            
            # Create filter for user_id and chat_id
            query_filter = Filter(
                must=[
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                    FieldCondition(key="chat_id", match=MatchValue(value=chat_id))
                ]
            )
            
            # First, get the points to count them
            points_info = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=10000,  # Large limit to get all matching points
                with_payload=False,
                with_vectors=False
            )
            
            point_ids = [point.id for point in points_info[0]]
            points_count = len(point_ids)
            
            if points_count > 0:
                # Delete the points by IDs
                self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=point_ids
                )
                console.print(f"Deleted {points_count} vector embeddings for chat {chat_id}", style="green")
            else:
                console.print(f"No vector embeddings found for chat {chat_id}", style="yellow")
            
            return points_count
            
        except Exception as e:
            console.print(f"Error deleting vector embeddings for chat {chat_id}: {str(e)}", style="red")
            return 0
    
    def delete_user_embeddings(self, user_id: str) -> int:
        """Delete all vector embeddings for a specific user"""
        try:
            # Check if collection exists
            if not self.client.collection_exists(collection_name=self.collection_name):
                console.print(f"Vector DB collection '{self.collection_name}' does not exist!", style="yellow")
                return 0
            
            # Create filter for user_id
            query_filter = Filter(
                must=[
                    FieldCondition(key="user_id", match=MatchValue(value=user_id))
                ]
            )
            
            # First, get the points to count them
            points_info = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=10000,  # Large limit to get all matching points
                with_payload=False,
                with_vectors=False
            )
            
            point_ids = [point.id for point in points_info[0]]
            points_count = len(point_ids)
            
            if points_count > 0:
                # Delete the points by IDs
                self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=point_ids
                )
                console.print(f"Deleted {points_count} vector embeddings for user {user_id}", style="green")
            else:
                console.print(f"No vector embeddings found for user {user_id}", style="yellow")
            
            return points_count
            
        except Exception as e:
            console.print(f"Error deleting vector embeddings for user {user_id}: {str(e)}", style="red")
            return 0
    
    def get_embeddings_count(self, user_id: str, chat_id: str = None) -> int:
        """Get count of embeddings for a user or specific chat"""
        try:
            # Check if collection exists
            if not self.client.collection_exists(collection_name=self.collection_name):
                return 0
            
            # Create filter
            filter_conditions = [FieldCondition(key="user_id", match=MatchValue(value=user_id))]
            if chat_id:
                filter_conditions.append(FieldCondition(key="chat_id", match=MatchValue(value=chat_id)))
            
            query_filter = Filter(must=filter_conditions)
            
            # Get points count
            points_info = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=1,
                with_payload=False,
                with_vectors=False
            )
            
            # Get total count using count method
            count_result = self.client.count(
                collection_name=self.collection_name,
                count_filter=query_filter
            )
            
            return count_result.count
            
        except Exception as e:
            console.print(f"Error getting embeddings count: {str(e)}", style="red")
            return 0