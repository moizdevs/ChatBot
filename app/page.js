"use client";
import React from "react";
import {
  PanelRight,
  SquarePen,
  Search,
  Images,
  LayoutGrid,
  FolderGit2,
  Share,
  ThumbsUp,
  ThumbsDown,
  Copy,
  X,
  Check,
  Ellipsis,
  ArrowUp,
  TextAlignStart,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModeToggle } from "@/components/Modetoggle";

const Home = () => {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatList, setChatList] = useState([]);
  const thisRef = useRef();
  const chatRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState();
  const [mobileSidebar, setmobileSidebar] = useState(false);
  const sidebarRef = useRef(null); // add this
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true); // ADD
  const isFetchingRef = useRef(false); // ADD
  const [page, setPage] = useState(1);

  const fetchChatsHistory = async (userId) => {
    if (!userId) return;
    if (!hasMoreRef.current) return; // ADD - band karo agar data khatam
    if (isFetchingRef.current) return; // ADD - duplicate call rokko

    isFetchingRef.current = true; // ADD

    const req = await fetch(`/api/chat/all/${userId}?page=${pageRef.current}`);
    const res = await req.json();

    if (res.length === 0) {
      // ADD - agar kuch nahi aaya
      hasMoreRef.current = false; // ADD
    } else {
      setChatList((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newChats = res.filter((c) => !existingIds.has(c.id));
        return [...prev, ...newChats];
      });
    }

    isFetchingRef.current = false; // ADD
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchChatsHistory(session.user.id);
    }
  }, [status]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  const handlePromptSend = async () => {
    if (!prompt) return;

    setLoading(true);
    setPrompt("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        chatId,
        id: session.user.id,
      }),
    });

    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt },
      { role: "assistant", content: data.reply },
    ]);

    setChatId(data.chatId);
    setLoading(false);
  };

  useEffect(() => {
    if (!chatId) return;
    fetch(`/api/chat/${chatId}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages);
      });
  }, [chatId]);

  const handleChange = (e) => {
    setPrompt(e.target.value);
  };

  const sideMenu = [
    { id: 1, icon: SquarePen, label: "New chat" },
    { id: 2, icon: Search, label: "Search chats" },
    { id: 3, icon: Images, label: "Images" },
    { id: 4, icon: LayoutGrid, label: "Apps" },
    { id: 5, icon: FolderGit2, label: "Projects" },
  ];

  return (
    <div className="w-full h-screen overflow-hidden flex">
      <div
        ref={sidebarRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const isAtBottom =
            el.scrollTop + el.clientHeight >= el.scrollHeight - 10;

          if (isAtBottom && hasMoreRef.current && !isFetchingRef.current) {
            // CHANGE
            pageRef.current += 1;
            setPage(pageRef.current);
            fetchChatsHistory(session?.user?.id);
          }
        }}
        className={`${
          !collapsed && "w-[19%]"
        } relative left sidebar-scrollable overflow-y-auto border-r dark:border-r-[#4e4e4f] max-[900]:hidden block font-normal bg-[#F9F9F9] dark:bg-[#181818]  transition-all duration-200 shrink-0`}
      >
        <div
          className={`header bg-[#F9F9F9] dark:bg-[#181818] top-0 px-2 py-1 ${collapsed && "m-2"} sticky flex justify-between items-center`}
        >
          {!collapsed && (
            <img
              title="Logo ChatNova"
              src={"/logo.svg"}
              className="h-10 w-12 dark:invert"
            />
          )}
          <button className="cursor-ew-resize rounded-md p-1 hover:bg-[#E8E8E8] dark:hover:bg-[#303030]">
            <PanelRight
              size={20}
              color="#727070"
              onClick={() => {
                setCollapsed(!collapsed);
              }}
            />
          </button>
        </div>

        <div ref={thisRef} className="sideMidPart py-5 mx-1">
          <ul className="flex flex-col">
            {sideMenu.map((item) => {
              return (
                <li
                  onClick={() => {
                    if (item.label === "New chat") {
                      setMessages([]);
                      setChatId(null);
                      document.title = "ChatNova";
                    }
                  }}
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-[#EFEFEF] dark:hover:bg-[#303030] cursor-pointer rounded-3xl"
                >
                  <item.icon size={16} />
                  {!collapsed && item.label}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Chat History */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto mb-25 mx-1">
            <details open>
              <summary className="text-xs text-gray-400 px-3 mb-1 tracking-wide">
                Your chats
              </summary>
              <ul className="flex flex-col">
                {chatList.map((chat) => (
                  <li
                    key={chat.id}
                    onClick={() => {
                      setChatId(chat.id);
                      document.title = `${toTitleCase(chat.title)}`;
                      fetch(`/api/chat/${chat.id}`)
                        .then((res) => res.json())
                        .then((data) => {
                          setMessages(data.messages);
                        });
                    }}
                    className={`px-3 py-2 text-sm rounded-xl cursor-pointer truncate transition-colors ${
                      chat.id === chatId
                        ? "bg-[#E8E8E8] dark:bg-[#242424]"
                        : "hover:bg-[#EFEFEF] dark:hover:bg-[#303030]"
                    }`}
                    title={chat.title}
                  >
                    {toTitleCase(chat.title) || "New Chat"}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        {session && (
          // FIX 2: Condition was inverted — apply constrained width when NOT collapsed
          <div
            className={`logoutBox flex items-center justify-between hover:bg-gray-200 bg-[#F9F9F9] dark:bg-[#181818] dark:hover:bg-[#111] p-3 rounded-full fixed bottom-0 ${
              !collapsed && "w-[18%]"
            }`}
          >
            <div className="flex gap-2">
              <img
                className="w-9 h-9 rounded-full shrink-0"
                src={session.user.image || "/default-avatar.png"}
                alt="Rounded avatar"
              />
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-xs text-foreground">
                    {session.user.name}
                  </span>
                  <span className="text-xs text-gray-500">Free</span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                className="text-xs text-red-600 hover:underline hover:text-red-800 cursor-pointer py-1 rounded-full"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar for mobile */}
      {mobileSidebar && (
        <div className="w-[52%] fixed z-20 left sidebar-scrollable max-[900]:block hidden overflow-y-auto border-r dark:border-r-[#303030] font-normal bg-[#F9F9F9] dark:bg-[#181818]  transition-all duration-200 shrink-0">
          <div
            className={`header bg-[#F9F9F9] dark:bg-[#181818] top-0 px-2 py-1 sticky flex justify-between items-center`}
          >
            <img
              title="Logo ChatNova"
              src={"/logo.svg"}
              className="h-10 w-12 dark:invert"
            />

            <button
              className="cursor-ew-resize rounded-md p-1 hover:bg-[#E8E8E8] dark:hover:bg-[#303030]"
              onClick={() => {
                setmobileSidebar(false);
              }}
            >
              <X size={20} color="#727070" />
            </button>
          </div>

          <div ref={thisRef} className="sideMidPart py-5 mx-1">
            <ul className="flex flex-col">
              {sideMenu.map((item) => {
                return (
                  <li
                    onClick={() => {
                      if (item.label === "New chat") {
                        setMessages([]);
                        setChatId(null);
                        document.title = "ChatNova";
                      }
                    }}
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-[#EFEFEF] dark:hover:bg-[#303030] cursor-pointer rounded-3xl"
                  >
                    <item.icon size={16} />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Chat History */}

          <div className="flex-1 overflow-y-auto mb-25 mx-1">
            <p className="text-xs text-gray-400 px-3 mb-1 tracking-wide">
              Your chats
            </p>
            <ul className="flex flex-col">
              {chatList.map((chat) => (
                <li
                  key={chat.id}
                  onClick={() => {
                    setmobileSidebar(false);
                    setChatId(chat.id);
                    document.title = `${toTitleCase(chat.title)}`;
                    fetch(`/api/chat/${chat.id}`)
                      .then((res) => res.json())
                      .then((data) => {
                        setMessages(data.messages);
                      });
                  }}
                  className={`px-3 py-2 text-sm rounded-xl cursor-pointer truncate transition-colors ${
                    chat.id === chatId
                      ? "bg-[#E8E8E8] dark:bg-[#242424]"
                      : "hover:bg-[#EFEFEF] dark:hover:bg-[#303030]"
                  }`}
                  title={chat.title}
                >
                  {toTitleCase(chat.title) || "New Chat"}
                </li>
              ))}
            </ul>
          </div>

          {session && (
            // FIX 2: Condition was inverted — apply constrained width when NOT collapsed
            <div
              className="logoutBox flex items-center justify-between hover:bg-gray-200 dark:hover:bg-[#111] bg-[#F9F9F9] dark:bg-[#181818] p-2 rounded-full fixed bottom-0 ${
                w-[51%]"
            >
              <div className="flex gap-2">
                <img
                  className="w-9 h-9 rounded-full shrink-0"
                  src={session.user.image || "/default-avatar.png"}
                  alt="Rounded avatar"
                />
                {!collapsed && (
                  <div className="flex flex-col">
                    <span className="text-xs text-foreground">
                      {session.user.name}
                    </span>
                    <span className="text-xs text-gray-500">Free</span>
                  </div>
                )}
              </div>
              {!collapsed && (
                <button
                  className="text-xs text-red-600 hover:underline hover:text-red-800 cursor-pointer py-1 rounded-full"
                  onClick={() => signOut()}
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center dark:bg-[#212121] min-w-0">
        {/* Right side Header */}
        <div className="header sticky top-0 z-10 flex items-center justify-between  border-b p-3">
          <div className="flex items-center gap-3">
            <button
              className="max-[900]:block hidden cursor-pointer rounded-md p-1 hover:bg-[#E8E8E8] dark:hover:bg-[#303030]"
              onClick={() => {
                setmobileSidebar(!mobileSidebar);
              }}
            >
              <TextAlignStart size={19} />
            </button>
            <span className="min-[900px]:pl-7 text-lg">ChatNova</span>
          </div>

          <span className="text-sm flex items-center gap-1 text-[#5D5BD0] font-semibold bg-[#F1F1FB] dark:bg-[#373669] dark:text-[#DBDAF5] border border-[#f1f1fb] dark:border-[#222323] rounded-full px-3 py-1 tracking-wide">
            ✦ Get plus <X size={12} />
          </span>

          <span className="flex items-center gap-1 cursor-pointer">
            <ModeToggle />
            <span className="hover:bg-[#E8E8E8] dark:hover:bg-[#303030] py-1 px-2 text-sm rounded-xl flex items-center gap-1">
              <Share size={14} /> Share
            </span>
            <Ellipsis size={20} />
          </span>
        </div>

        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto px-25 py-6 max-[800px]:px-10 max-[550px]:px-3 space-y-4 text-sm"
        >
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-10/12 text-gray-400 gap-2">
              <img src="/logo.svg" className="h-12 w-12 invert" alt="" />
              <p className="text-base">
                Hey, {session?.user.name}. Ready to dive in?
              </p>
            </div>
          )}

          {messages.map((msg, index, array) =>
            msg.role === "assistant" ? (
              <div key={index} className="py-1 relative font-light">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    hr: ({ node, ...props }) => (
                      <hr className="border-0.5 my-10" {...props} />
                    ),
                    h1: ({ node, ...props }) => (
                      <h1 className="text-2xl font-bold my-4" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xl font-semibold my-3" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-lg font-semibold my-2" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="my-2 leading-relaxed" {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <table className="w-full text-left" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th
                        className="border-b px-4 py-2 font-semibold"
                        {...props}
                      />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-semibold" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="border-t px-4 py-2" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc pl-6 my-2" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal pl-6 my-2" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="my-1" {...props} />
                    ),
                    code({ node, inline, className, children, ...props }) {
                      if (inline) {
                        return (
                          <code
                            className="bg-gray-200 px-1 py-0.5 rounded text-sm"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      return (
                        <pre className="bg-[#F9F9F9] dark:bg-[#181818] p-3 rounded-lg overflow-x-auto my-3">
                          <code {...props}>{children}</code>
                        </pre>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>

                <div className="flex gap-3 text-gray-400 dark:text-gray-300 cursor-pointer transition-opacity">
                  {copiedId === msg.id ? (
                    <Check size={18} />
                  ) : (
                    <Copy
                      onClick={() => {
                        setCopiedId(msg.id);
                        navigator.clipboard.writeText(msg.content);
                        setTimeout(() => setCopiedId(null), 500);
                      }}
                      size={18}
                    />
                  )}
                  <ThumbsUp size={18} />
                  <ThumbsDown size={18} />
                  <Share size={18} />
                  <Ellipsis size={18} />
                </div>
              </div>
            ) : (
              <div key={index} className="relative">
                <div className="px-5 py-3 bg-[#F4F4F4] dark:bg-[#303030] max-w-xl w-fit rounded-2xl ml-auto">
                  {msg.content}
                </div>
              </div>
            ),
          )}

          {loading && (
            <div className="text-gray-400 py-4 flex items-end text-sm">
              Thinking
              <span className="dotsAnimation inline-flex overflow-hidden">
                ...
              </span>
            </div>
          )}
        </div>

        {/* Input Box */}
        <div className="p-3 pt-1 flex flex-col items-center gap-2">
          <div className="relative w-full max-w-4xl">
            <input
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePromptSend();
                }
              }}
              type="text"
              value={prompt}
              onChange={handleChange}
              className="w-full border font-light rounded-full px-4 py-3 pr-12 outline-none"
              placeholder="Ask anything"
            />
            <button
              onClick={handlePromptSend}
              className="absolute right-2 cursor-pointer hover:scale-[1.07] transition ease top-1/2 transform -translate-y-1/2 bg-black dark:bg-white dark:text-black text-white p-2 rounded-full"
            >
              <ArrowUp size={20} />
            </button>
          </div>

          <span className="text-xs text-gray-500 text-center">
            ChatNova can make mistakes. Check important info.
          </span>
        </div>
      </div>
    </div>
  );
};

export default Home;
