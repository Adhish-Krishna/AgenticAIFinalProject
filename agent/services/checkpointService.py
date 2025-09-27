from pymongo import MongoClient
from envconfig import MONGO_DB_URI
from rich.console import Console

console = Console()

class CheckpointService:
    def __init__(self, db_name: str = "SUDAR"):
        self.db_name = db_name
        self.client = MongoClient(MONGO_DB_URI)
        self.db = self.client[self.db_name]
    
    def delete_chat_checkpoints(self, user_id: str, chat_id: str) -> int:
        """Delete all LangGraph checkpoints for a specific chat"""
        try:
            # LangGraph stores checkpoints with thread_id format like "user_id_chat_id"
            thread_id = f"{user_id}_{chat_id}"
            
            # Get all collections that might contain checkpoints
            # LangGraph typically uses collections like 'checkpoints', 'checkpoint_blobs', etc.
            checkpoint_collections = [name for name in self.db.list_collection_names() 
                                    if 'checkpoint' in name.lower()]
            
            total_deleted = 0
            
            for collection_name in checkpoint_collections:
                collection = self.db[collection_name]
                
                # Delete documents that match the thread_id
                # LangGraph stores checkpoints with 'thread_id' field
                result = collection.delete_many({"thread_id": thread_id})
                deleted_count = result.deleted_count
                total_deleted += deleted_count
                
                if deleted_count > 0:
                    console.print(f"Deleted {deleted_count} checkpoints from {collection_name} for chat {chat_id}", style="green")
            
            # Also check for any documents with chat_id field directly
            for collection_name in self.db.list_collection_names():
                collection = self.db[collection_name]
                
                # Try to delete by chat_id if the field exists
                try:
                    result = collection.delete_many({
                        "chat_id": chat_id,
                        "user_id": user_id
                    })
                    deleted_count = result.deleted_count
                    total_deleted += deleted_count
                    
                    if deleted_count > 0:
                        console.print(f"Deleted {deleted_count} documents from {collection_name} for chat {chat_id}", style="green")
                except Exception:
                    # Ignore collections that don't have these fields
                    pass
            
            if total_deleted == 0:
                console.print(f"No checkpoints found for chat {chat_id}", style="yellow")
            
            return total_deleted
            
        except Exception as e:
            console.print(f"Error deleting checkpoints for chat {chat_id}: {str(e)}", style="red")
            return 0
    
    def delete_user_checkpoints(self, user_id: str) -> int:
        """Delete all checkpoints for a specific user"""
        try:
            # Get all collections that might contain checkpoints
            checkpoint_collections = [name for name in self.db.list_collection_names() 
                                    if 'checkpoint' in name.lower()]
            
            total_deleted = 0
            
            for collection_name in checkpoint_collections:
                collection = self.db[collection_name]
                
                # Delete documents that match thread_id pattern (user_id_*)
                result = collection.delete_many({
                    "thread_id": {"$regex": f"^{user_id}_"}
                })
                deleted_count = result.deleted_count
                total_deleted += deleted_count
                
                if deleted_count > 0:
                    console.print(f"Deleted {deleted_count} checkpoints from {collection_name} for user {user_id}", style="green")
            
            # Also check for any documents with user_id field directly
            for collection_name in self.db.list_collection_names():
                collection = self.db[collection_name]
                
                try:
                    result = collection.delete_many({"user_id": user_id})
                    deleted_count = result.deleted_count
                    total_deleted += deleted_count
                    
                    if deleted_count > 0:
                        console.print(f"Deleted {deleted_count} documents from {collection_name} for user {user_id}", style="green")
                except Exception:
                    # Ignore collections that don't have user_id field
                    pass
            
            if total_deleted == 0:
                console.print(f"No checkpoints found for user {user_id}", style="yellow")
            
            return total_deleted
            
        except Exception as e:
            console.print(f"Error deleting checkpoints for user {user_id}: {str(e)}", style="red")
            return 0
    
    def get_checkpoint_collections(self) -> list:
        """Get list of collections that contain checkpoints"""
        try:
            return [name for name in self.db.list_collection_names() 
                   if 'checkpoint' in name.lower()]
        except Exception as e:
            console.print(f"Error getting checkpoint collections: {str(e)}", style="red")
            return []
    
    def get_checkpoint_count(self, user_id: str, chat_id: str = None) -> int:
        """Get count of checkpoints for a user or specific chat"""
        try:
            checkpoint_collections = self.get_checkpoint_collections()
            total_count = 0
            
            for collection_name in checkpoint_collections:
                collection = self.db[collection_name]
                
                if chat_id:
                    # Count for specific chat
                    thread_id = f"{user_id}_{chat_id}"
                    count = collection.count_documents({"thread_id": thread_id})
                else:
                    # Count for all user chats
                    count = collection.count_documents({
                        "thread_id": {"$regex": f"^{user_id}_"}
                    })
                
                total_count += count
            
            return total_count
            
        except Exception as e:
            console.print(f"Error getting checkpoint count: {str(e)}", style="red")
            return 0
    
    def close_connection(self):
        """Close the MongoDB connection"""
        try:
            self.client.close()
        except Exception as e:
            console.print(f"Error closing connection: {str(e)}", style="red")