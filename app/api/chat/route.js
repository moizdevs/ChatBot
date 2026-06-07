import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pipeline } from "@xenova/transformers";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateEmbeddings = async (message) => {
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );

  const output = await extractor(message, { pooling: "mean", normalize: true });

  return output.data;
};

async function getRelevantMemories(userId, message) {
  const memories = await prisma.memory.findMany({
    where: { userId },
  });

  if (!memories || memories.length === 0) {
    return [];
  }

  const queryEmbedding = await generateEmbeddings(message);

  const similarity = (a, b) => {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  };

  const scored = memories.map((m) => [
    similarity(queryEmbedding, m.embedding),
    m.fact,
  ]);

  scored.sort((a, b) => b[0] - a[0]); // descending

  return scored.slice(0, 3).map((item) => item[1]);
}

const generateFacts = async (message) => {
  const prompt = `Extract important facts from this message for memory storage:
${message}
Return as separate bullet points.`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const response = result.response.text();

  if (!response) return [];

  const facts = response
    .split("\n")
    .map((line) => line.replace(/^/, "").trim())
    .filter(
      (line) => line.length > 0 && !line.toLowerCase().includes("here are"),
    );

  return facts;
};

const shouldGenerateFacts = async (message) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `
Check if this message contains new factual information about the user
that should be remembered for later context.
Respond only "yes" or "no".
Message: "${message}"
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const responseText = result.response.text().toLowerCase();
  return responseText.includes("yes");
};

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
    if (await shouldGenerateFacts(message)) {
      const facts = await generateFacts(message);
      for (const fact of facts) {
        const embedding = await generateEmbeddings(fact);
        await prisma.memory.create({
          data: {
            userId: currentUser.id,
            fact,
            embedding,
          },
        });
      }
    }

    const memories = await getRelevantMemories(currentUser.id, message);
    console.log(memories);

    const memoryContext = memories.length
      ? `Relevant past facts about user:\n${memories.join("\n")}\n\n`
      : "";

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
      { role: "user", parts: [{ text: memoryContext + message }] },
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
