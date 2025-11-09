from fastapi import FastAPI

app = FastAPI(redoc_url=None)

@app.get("/")
def read_root():
    return {"Hello": "ROOT!"}

@app.get("/app")
def read_app():
    return {"Hello": "APP"}