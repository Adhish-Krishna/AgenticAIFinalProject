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

### 4. Run the Terminal Chat App

Finally, you can run the terminal-based chat application.

1.  Navigate back to the root directory of the project:

    ```bash
    cd ..
    ```

2.  Run the terminal chat application:

    ```bash
    python -m agent.terminalChat
    ```

You should now be able to interact with the Sudar AI Agent directly in your terminal.
