import asyncio
from schemas.job_match import JobMatchRequest
from routers.job_match import match_job
from memory.session_store import store
from schemas.resume import ResumeSchema
from memory.session_store import Session

async def run_test():
    store._store["test-123"] = Session(
        session_id="test-123",
        resume=ResumeSchema(
            name="John Doe",
            raw_text="I am a python developer with 5 years experience.",
            skills=["Python", "AWS"]
        )
    )
    req = JobMatchRequest(
        session_id="test-123",
        job_description="We need a Python developer who knows AWS and React."
    )
    try:
        res = await match_job(req)
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Error:", e)

asyncio.run(run_test())
