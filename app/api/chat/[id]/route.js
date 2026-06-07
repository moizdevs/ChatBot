import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { id } = await params;

  const chat = await prisma.chat.findUnique({
    where: { id: id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json(chat);
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  try {
    await prisma.chat.delete({
      where: { id: id },
    });
    return NextResponse.json(
      { message: "Chat deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Error deleting chat", error: error.message },
      { status: 500 },
    );
  }
}
