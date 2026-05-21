import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const {id} = await params;
  

  const chat = await prisma.chat.findUnique({
    where: { id: id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  

  return NextResponse.json(chat);
}

