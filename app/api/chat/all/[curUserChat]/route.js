import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req, {params}) {
  
  const {curUserChat} = await params;
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page");
  console.log(page);

  const skip = (page -1) * 10;
  
  const chats = await prisma.chat.findMany({
    take:10,
    skip:skip,
    orderBy: { createdAt: "desc" },
    where: {
      userId: curUserChat,
    },
  });
  

  return NextResponse.json(chats);
}