from fastapi import FastAPI, HTTPException, Depends
from sqlmodel import select, Session
from models import User, Chat, Message, Role, Memory
from database import get_session
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import requests
import os

app = FastAPI()

origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Request model
# ----------------------------
class ChatRequest(BaseModel):
    message: str
    chatId: str | None = None
    id: str

# ----------------------------
# Embedding and Memory Utils
# ----------------------------
def get_embedding(text: str):
    api_key = os.getenv("GEMINI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
    payload = {"content": {"parts": [{"text": text}]}}
    res = requests.post(url, json=payload)
    data = res.json()
    return data["embedding"]["values"]

def save_memory(session: Session, user_id: str, fact: str):
    embedding = get_embedding(fact)
    memory = Memory(userId=user_id, fact=fact, embedding=embedding)
    session.add(memory)
    session.commit()

def get_relevant_memories(session: Session, user_id: str, message: str):
    memories = session.exec(select(Memory).where(Memory.userId == user_id)).all()
    if not memories:
        return []

    query_embedding = get_embedding(message)

    def similarity(a, b):
        return sum(x*y for x, y in zip(a, b))

    scored = [(similarity(query_embedding, m.embedding), m.fact) for m in memories]
    scored.sort(reverse=True)

    return [fact for _, fact in scored[:3]]

def extract_facts(text: str):
    api_key = os.getenv("GEMINI_API_KEY")
    prompt = f"Extract important facts from this message for memory storage:\n{text}\nReturn as separate bullet points."
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        json={"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    )
    data = response.json()
    try:
        facts_text = data["candidates"][0]["content"]["parts"][0]["text"]
        facts = [line.strip("- ").strip() for line in facts_text.split("\n") if line.strip()]
        print(facts)
        return facts
    except:
        return []

# ----------------------------
# Chat endpoints
# ----------------------------
@app.post("/api/chat")
def create_chat(request: ChatRequest, session: Session = Depends(get_session)):
    # 🔎 Find user
    user = session.exec(select(User).where(User.id == request.id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 🆕 Create new chat if needed
    if not request.chatId:
        chat = Chat(userId=user.id, title=request.message[:40])
        session.add(chat)
        session.commit()
        session.refresh(chat)
    else:
        chat = session.get(Chat, request.chatId)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

    # 💬 Save user message
    msg_user = Message(chatId=chat.id, role=Role.user, content=request.message)
    session.add(msg_user)
    session.commit()

    # 🧠 Automatic fact extraction and memory save
    facts = extract_facts(request.message)   # it returns a list of facts regarding the user messsage/prompt
    for fact in facts:
        save_memory(session, user.id, fact)

    # 🧠 Retrieve relevant memories
    memories = get_relevant_memories(session, user.id, request.message)

    # 📜 Get last 10 chat messages
    messages = session.exec(
        select(Message)
        .where(Message.chatId == chat.id)
        .order_by(Message.createdAt.desc())
        .limit(10)
    ).all()
    messages = list(reversed(messages))  # chronological order

    # 🔄 Convert to Gemini format with memory injected
    formatted_messages = []

    if memories:
        memory_text = "Relevant facts about the user:\n" + "\n".join(f"- {m}" for m in memories)
        formatted_messages.append({
            "role": "user",
            "parts": [{"text": memory_text}]
        })

    for m in messages:
        formatted_messages.append({
            "role": "model" if m.role == Role.assistant else "user",
            "parts": [{"text": m.content}]
        })

    # 🤖 Call Gemini API
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not found")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    response = requests.post(url, json={"contents": formatted_messages})
    response_data = response.json()

    if "candidates" not in response_data:
        raise HTTPException(status_code=500, detail=response_data)

    ai_text = response_data["candidates"][0]["content"]["parts"][0]["text"]

    # 💾 Save AI message
    msg_ai = Message(chatId=chat.id, role=Role.assistant, content=ai_text)
    session.add(msg_ai)
    session.commit()

    return {"reply": ai_text, "chatId": chat.id}


@app.get("/api/chat/all/{user_id}")
def get_user_chats(user_id: str, session: Session = Depends(get_session)):
    chats = session.exec(
        select(Chat).where(Chat.userId == user_id).order_by(Chat.createdAt.desc())
    ).all()
    return [{"id": c.id, "title": c.title} for c in chats]


@app.get("/api/chat/{chat_id}")
def get_chat(chat_id: str, session: Session = Depends(get_session)):
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = session.exec(
        select(Message).where(Message.chatId == chat.id).order_by(Message.createdAt)
    ).all()

    return {
        "id": chat.id,
        "title": chat.title,
        "userId": chat.userId,
        "createdAt": chat.createdAt,
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content, "chatId": m.chatId, "createdAt": m.createdAt}
            for m in messages
        ]
    }