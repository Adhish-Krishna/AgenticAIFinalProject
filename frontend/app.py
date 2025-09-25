import streamlit as st
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from agent.sudar import SUDARAgent
from agent.services.chatService import ChatService
from utils import getUserId, getChatId, setChatId
import uuid

st.set_page_config(layout="wide")

def get_session_id():
    if "session_id" not in st.session_state:
        st.session_state.session_id = str(uuid.uuid4())
    return st.session_state.session_id

def main():
    st.title("Sudar AI Agent")

    # Initialize chat service
    chat_service = ChatService(db_name="SUDAR", collection_name="chat_history")

    # Get user ID and chat ID
    user_id = getUserId()
    chat_id = getChatId()

    # Sidebar for chat history
    st.sidebar.title("Chat History")
    chat_list = chat_service.getUserChatList(user_id)
    
    # Add a "New Chat" button
    if st.sidebar.button("New Chat"):
        setChatId(str(uuid.uuid4()))
        st.rerun()

    for chat in chat_list:
        if st.sidebar.button(chat['chat_name'], key=chat['chat_id']):
            setChatId(chat['chat_id'])
            st.rerun()

    # Main chat area
    st.header(f"Chat ID: {chat_id}")

    # Display chat messages
    messages = chat_service.getUserChat(user_id, chat_id)
    for msg in messages:
        with st.chat_message(msg['role']):
            st.markdown(msg['message'])

    # Chat input
    if prompt := st.chat_input("What is up?"):
        st.chat_message("User").markdown(prompt)
        
        # Insert human message into the database
        chat_service.insertHumanMessage(prompt, user_id, chat_id)

        # Get response from AI agent
        agent = SUDARAgent()
        compiled_agent = agent.get_agent()
        config = {
            "configurable": {
                "thread_id": f"{user_id}_{chat_id}"
            }
        }

        with st.spinner("AI is thinking..."):
            for chunk in compiled_agent.stream(
                {
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                },
                config=config,
                stream_mode="updates",
            ):
                agents = ["supervisor", "ContentResearcher", "WorksheetGenerator"]
                for ag in agents:
                    if ag in chunk:
                        ai_message = chunk[ag]['messages'][-1].content
                        with st.chat_message("AI"):
                            st.markdown(ai_message)
                        
                        # Insert AI message into the database
                        chat_service.insertAIMessage(
                            message=ai_message,
                            user_id=user_id,
                            chat_id=chat_id,
                            agent_name=ag
                        )
                        break
        st.rerun()

if __name__ == "__main__":
    main()