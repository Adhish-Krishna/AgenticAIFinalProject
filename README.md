# **Agentic AI Mini Project**
## **Team Members**
### 23N206 Adhish Krishna S
### 23Z320 Dinesh T M 
### 23Z369 Sree Anukeysh S


# AI Agent Setup

This guide will walk you through the setup process for the Sudar AI Agent project.

## Prerequisites

Before you begin, ensure you have the following installed:

-   [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/)
-   [Python](https://www.python.org/downloads/) (version 3.10 or higher)

## Setup Instructions

Follow these steps to get the project up and running:

### 1. Configure Environment Variables

First, you need to set up your environment variables.

1.  In the root directory of the project, make a copy of the `.env.template` file and rename it to `.env`.

2.  Open the new `.env` file and add your Google API key to the `GOOGLE_API_KEY` variable and tavily api key to `TAVILY_API_KEY` variable:

    ```
    GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
    TAVILY_API_KEY="YOUR TAVILY_API_KEY"
    ```

### 2. Run Necessary Services

Next, use Docker Compose to build and run the required services in the background.

```bash
docker-compose up -d
```

This command will start all the services defined in the `docker-compose.yml` file.

### 3. Set Up the Python Environment

Now, set up the Python environment for the agent.

1.  Navigate to the `agent` directory:

    ```bash
    cd agent
    ```

2.  Create a new virtual environment:

    ```bash
    python -m venv venv
    ```

3.  Activate the virtual environment:

    -   **On Windows:**
        ```bash
        .\venv\Scripts\activate
        ```
    -   **On macOS/Linux:**
        ```bash
        source venv/bin/activate
        ```

4.  Install the required Python packages from `requirements.txt`:

    ```bash
    pip install -r requirements.txt
    ```

### 4. Run the API server

You can now launch the FastAPI server that exposes chat, file upload, and content discovery endpoints.

```bash
uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will:

- Stream chat messages through the orchestrated Sudar agent
- Accept file uploads and trigger background RAG ingestion
- Provide download links for agent-generated content stored in MinIO

### 5. Start the React chat UI

The `frontend` folder contains a Vite + React interface for managing chats.

1. Copy the example environment file:

    ```bash
    cd frontend
    copy .env.example .env  # Windows PowerShell
    ```

2. Install dependencies and start the dev server:

    ```bash
    npm install
    npm run dev
    ```

3. Open the printed URL (defaults to `http://localhost:5173`).

Use the UI to create new conversations, upload files, and interact with the agent. The interface assumes a single demo user and derives the base chat ID from environment configuration.

### Optional: Terminal chat experience

If you prefer the original CLI interaction, you can still launch it from the project root after activating the virtual environment:

```bash
python -m agent.terminalChat
```
