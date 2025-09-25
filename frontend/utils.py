import streamlit as st
import uuid

def getUserId():
    if 'user_id' not in st.session_state:
        st.session_state.user_id = str(uuid.uuid4())
    return st.session_state.user_id

def getChatId():
    if 'chat_id' not in st.session_state:
        st.session_state.chat_id = str(uuid.uuid4())
    return st.session_state.chat_id

def setChatId(chat_id):
    st.session_state.chat_id = chat_id
