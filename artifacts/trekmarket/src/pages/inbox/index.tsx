import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCheck, Check, MessageSquare, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DmRequest = {
  id: string;
  fromUserId: string;
  fromUsername: string | null;
  fromDisplayName: string;
  fromProfileImage: string | null;
  status: string;
  createdAt: string;
};

type Conversation = {
  conversationId: string;
  otherUserId: string;
  otherUsername: string | null;
  otherDisplayName: string;
  otherProfileImage: string | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  unreadCount: number;
};

type Message = {
  id: string;
  senderId: string;
  fromMe: boolean;
  body: string;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 10_000;

export default function InboxPage() {
  const { isAuthenticated, login } = useAuth();
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const { toast } = useToast();

  const [requests, setRequests] = useState<DmRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null); // otherUserId
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchRequests = useCallback(async () => {
    const res = await fetch("/api/dm/requests", { credentials: "include" });
    if (res.ok) setRequests(await res.json());
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/dm/conversations", { credentials: "include" });
    if (res.ok) setConversations(await res.json());
  }, []);

  const fetchMessages = useCallback(async (userId: string) => {
    const res = await fetch(`/api/dm/conversations/${userId}`, { credentials: "include" });
    if (res.ok) {
      setMessages(await res.json());
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRequests();
    fetchConversations();
  }, [isAuthenticated, fetchRequests, fetchConversations]);

  // Poll active conversation
  useEffect(() => {
    if (!activeConv) return;
    const timer = setInterval(() => fetchMessages(activeConv), POLL_MS);
    return () => clearInterval(timer);
  }, [activeConv, fetchMessages]);

  const openConversation = async (userId: string) => {
    setActiveConv(userId);
    setLoadingConv(true);
    await fetchMessages(userId);
    setLoadingConv(false);
    // Refresh conversation list to clear unread badge
    fetchConversations();
  };

  const handleAccept = async (id: string) => {
    await fetch(`/api/dm/request/${id}/accept`, { method: "POST", credentials: "include" });
    await fetchRequests();
    await fetchConversations();
    toast({ title: "Request accepted" });
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/dm/request/${id}/reject`, { method: "POST", credentials: "include" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Request declined" });
  };

  const handleSendRequest = async () => {
    if (!newUsername.trim()) return;
    setIsSendingRequest(true);
    try {
      const res = await fetch("/api/dm/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Failed to send request.", variant: "destructive" });
        return;
      }
      toast({ title: "Request sent!", description: `DM request sent to @${newUsername.trim()}` });
      setNewUsername("");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgBody.trim() || !activeConv) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/dm/conversations/${activeConv}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: msgBody.trim() }),
      });
      if (!res.ok) {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
        return;
      }
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setMsgBody("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      fetchConversations();
    } finally {
      setIsSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">Log in to access your inbox.</p>
        <Button onClick={login}>Log In</Button>
      </div>
    );
  }

  const activeConvData = conversations.find((c) => c.otherUserId === activeConv);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-serif font-bold mb-6">Inbox</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
        {/* Left panel — requests + conversations */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Send new DM request */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> New Message
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                placeholder="@username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
              />
              <Button size="sm" onClick={handleSendRequest} disabled={isSendingRequest || !newUsername.trim()}>
                {isSendingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </CardContent>
          </Card>

          {/* Pending requests */}
          {requests.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Pending Requests
                  <Badge variant="secondary">{requests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">{r.fromDisplayName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1 truncate">{r.fromDisplayName}</span>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleAccept(r.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleReject(r.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Conversations list */}
          <Card className="flex-1 overflow-y-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No conversations yet.</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.conversationId}
                    onClick={() => openConversation(c.otherUserId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0 ${
                      activeConv === c.otherUserId ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarFallback className="text-xs">{c.otherDisplayName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{c.otherDisplayName}</span>
                        {c.unreadCount > 0 && (
                          <span className="ml-2 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      {c.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.lastMessage.fromMe ? "You: " : ""}{c.lastMessage.body}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel — message thread */}
        <div className="lg:col-span-2 flex flex-col border border-border rounded-xl overflow-hidden">
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="w-10 h-10 opacity-30" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">{activeConvData?.otherDisplayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm">{activeConvData?.otherDisplayName}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingConv ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">No messages yet. Say hello!</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        m.fromMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${m.fromMe ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {m.fromMe && (m.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Compose */}
              <div className="p-3 border-t border-border flex gap-2 items-end">
                <Textarea
                  placeholder="Type a message…"
                  rows={1}
                  className="resize-none flex-1"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button size="icon" onClick={handleSendMessage} disabled={isSending || !msgBody.trim()}>
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
