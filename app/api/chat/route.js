import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { message, chatId, id } = await req.json();

    let chat;
    const currentUser = await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    // Create new chat if not exists
    if (!chatId) {
      const title = message.substring(0, 40);
      chat = await prisma.chat.create({
        data: {
          userId: currentUser.id,
          title: title,
        },
      });
    } else {
      chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }

    console.log(chat)
    // Save new user message
    await prisma.message.create({
      data: {
        role: "user",
        content: message,
        chatId: chat.id,
      },
    });

    // Get updated full history
    const updatedMessages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    // Convert DB format → Gemini format
    const formattedMessages = updatedMessages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Add memory context to latest user message
    const finalMessages = [
      ...formattedMessages.slice(0, -1),
      { role: "user", parts: [{ text: message }] },
    ];
    console.log(finalMessages);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // Send FULL conversation
    const result = await model.generateContent({
      contents: finalMessages,
    });

    const response = result.response;
    const text = response.text();

    // Save AI reply
    await prisma.message.create({
      data: {
        role: "assistant",
        content: text,
        chatId: chat.id,
      },
    });

    return NextResponse.json({
      reply: text,
      chatId: chat.id,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
