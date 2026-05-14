import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, MessageSquare, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Reply = {
  id: string;
  body: string;
  authorName: string | null;
  authorRole: string | null;
  createdAt: string;
};

type ThreadDetail = {
  id: string;
  title: string;
  body: string;
  authorName: string | null;
  authorRole: string | null;
  replyCount: number;
  createdAt: string;
  replies: Reply[];
};

const ROLE_COLOR: Record<string, string> = {
  trekker: "bg-primary/10 text-primary",
  agency: "bg-secondary/10 text-secondary-foreground",
};

export default function ThreadDetailPage() {
  const [, params] = useRoute("/community/:id");
  const threadId = params?.id ?? "";
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const { toast } = useToast();

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadThread = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}`);
      if (res.ok) setThread(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (threadId) loadThread();
  }, [threadId]);

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error ?? "Failed to post reply.", variant: "destructive" });
        return;
      }
      setReplyBody("");
      await loadThread();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Thread not found.</p>
        <Link href="/community" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Community
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Community
      </Link>

      <Card className="mb-6">
        <CardContent className="p-6">
          <h1 className="text-2xl font-serif font-bold mb-3 leading-snug">{thread.title}</h1>
          <p className="text-foreground/90 mb-4 whitespace-pre-wrap leading-relaxed">{thread.body}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{thread.authorName ?? "Anonymous"}</span>
            <Badge className={`text-[10px] py-0 px-1.5 capitalize ${ROLE_COLOR[thread.authorRole ?? "trekker"] ?? ""}`}>
              {thread.authorRole ?? "trekker"}
            </Badge>
            <span>·</span>
            <span>{new Date(thread.createdAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm text-muted-foreground">
          {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
        </h2>
      </div>

      {thread.replies.length > 0 && (
        <div className="space-y-3 mb-6">
          {thread.replies.map((r) => (
            <Card key={r.id} className="border-border/60">
              <CardContent className="p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">{r.body}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{r.authorName ?? "Anonymous"}</span>
                  <Badge className={`text-[10px] py-0 px-1.5 capitalize ${ROLE_COLOR[r.authorRole ?? "trekker"] ?? ""}`}>
                    {r.authorRole ?? "trekker"}
                  </Badge>
                  <span>·</span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAuthenticated ? (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Reply as {profile?.username ? `@${profile.username}` : (profile?.firstName ?? "you")}</p>
            <Textarea
              placeholder="Share your thoughts…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleReply}
                disabled={isSubmitting || !replyBody.trim()}
                className="gap-2"
              >
                {isSubmitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                Post Reply
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="text-sm">Log in to join the conversation.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
