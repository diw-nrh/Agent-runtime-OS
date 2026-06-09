import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.modules.agent_runner.adapters.fastapi_controller import router as agent_router
from app.modules.mcp_gateway.mcp_controller import router as mcp_router

app = FastAPI(
    title="Nodebook OS - AI Engine",
    description="Backend for Enterprise ADK",
    version="1.0.0"
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# CORS config to allow Next.js frontend to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router, prefix="/api/agent", tags=["agent"])
app.include_router(mcp_router, prefix="/api/mcp", tags=["mcp"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Nodebook OS AI Engine"}
