from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import JSON
from typing import List, Optional
from datetime import datetime
import uuid
from enum import Enum

class Role(str, Enum):
    user = "user"
    assistant = "assistant"

class User(SQLModel, table=True):
    __tablename__ = "User"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: Optional[str] = None
    email: str = Field(sa_column_kwargs={"unique": True})
    imageUrl: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    Chats: List["Chat"] = Relationship(back_populates="User")  # One-to-many

class Chat(SQLModel, table=True):
    __tablename__ = "Chat"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    
    # Cascade delete when user is deleted
    userId: str = Field(
        sa_column=Column(String, ForeignKey("User.id", ondelete="CASCADE")),
    )
    
    title: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    User: "User" = Relationship(back_populates="Chats")  # Many-to-one
    Messages: List["Message"] = Relationship(back_populates="Chat")  # One-to-many

class Message(SQLModel, table=True):
    __tablename__ = "Message"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    role: Role
    content: str
    
    # Cascade delete when chat is deleted
    chatId: str = Field(
        sa_column=Column(String, ForeignKey("Chat.id", ondelete="CASCADE")),
    )
    
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    Chat: "Chat" = Relationship(back_populates="Messages")  # Many-to-one

class Memory(SQLModel, table=True):
    __tablename__ = "Memory"
    id: Optional[int] = Field(default=None, primary_key=True)
    userId: str = Field(foreign_key="User.id")
    fact: str

    embedding: list[float] = Field(
        sa_column=Column(JSON)
    )
    createdAt: datetime = Field(default_factory=datetime.utcnow)