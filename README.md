# AgentRuntime OS

AgentRuntime OS is a powerful multi-agent orchestration platform that allows you to visually build, connect, and execute LLM agents.

## System Architecture & Tech Stack
AgentRuntime-OS is built on a modern, cloud-native technology stack designed for high performance, scalability, and secure AI execution.
### Frontend (Client-side)
* **Framework:** [Next.js](https://nextjs.org/) (React)
* **Styling:** Tailwind CSS v4 + Shadcn UI
* **Features:** Interactive Canvas UI, Real-time Playground, and Admin Dashboard
### Backend (Core API)
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
* **Agent Engine:** LangChain & Custom Graph Execution
* **Role:** Acts as the brain of the OS, handling API routing, tool calling, and orchestrating complex AI workflows.
### Background Workers & Message Queue
* **Task Queue:** Celery
* **Broker / Cache:** Redis
* **Role:** Manages heavy, asynchronous LLM reasoning and background tasks without blocking the main API threads.
###  Database & Storage (Data Layer)
* **Relational DB:** PostgreSQL (Local)
* **ORM:** Prisma
* **Object Storage:** MinIO (S3-Compatible local storage for AI-generated artifacts & images)
### AI Execution Engine
* **Sandbox Environment:** [E2B](https://e2b.dev/) (Firecracker MicroVMs)
* **Role:** Provides a highly secure, isolated cloud environment for AI agents to write and execute code autonomously.

---

## 🚀 Getting Started (Docker Deployment)

Deploying the entire stack is extremely easy using Docker Compose. The environment includes the Next.js Frontend, FastAPI Backend, Celery Worker, PostgreSQL, and Redis.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 1. Set Up Environment Variables (Optional)
By default, the application supports **Bring Your Own Key (BYOK)** directly through the Frontend UI Settings. This means you can just start the containers and enter your API keys inside the web app.

However, if you want to set a default API Key at the system level, you can create a `.env` file in the root of the project:

```env
# Optional: Set a default API key for the backend
OPENROUTER_API_KEY=your_api_key_here
# OPENAI_API_KEY=your_openai_key_here
```

### 2. Build and Start the Containers
Open your terminal in the root directory and run the following command to build and run all services in the background:

```bash
docker-compose up -d --build
```
*Note: The first time you run this, it will take a few minutes to download the base images and install dependencies for the frontend and backend.*

### 3. Initialize the Database (Prisma)
Once the containers are running, you need to sync the database schema for the frontend. Run this command to execute Prisma push inside the frontend container:

```bash
docker-compose exec frontend npx prisma db push
```

### 4. Access the Application
Everything is now up and running!
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛑 Managing the Application

### Stopping the Application
To safely stop all running services:
```bash
docker-compose down
```

### Viewing Logs
If you want to monitor the execution traces or check for errors, you can view the live logs of the backend or the Celery worker:
```bash
docker-compose logs -f celery_worker
docker-compose logs -f backend
```

### Restarting the Worker
If you make changes to the Python code (`backend/app/...`), the Celery worker might need a restart to pick up the new code:
```bash
docker-compose restart celery_worker
```
