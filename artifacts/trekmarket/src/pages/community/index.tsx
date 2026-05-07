import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Thread = {
  id: string;
  title: string;
  body: string;
  authorName: string | null;
  authorRole: string | null;
  replyCount: number;
  createdAt: string;
};

function useThreads() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/threads");
      if (res.ok) setThreads(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  if (threads === null && !isLoading) load();

  return { threads: threads ?? [], isLoading, reload: load };
}

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetMyProfile({ query: { enabled: isAuthenticated } });
  const { threads, isLoading, reload } = useThreads();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTrekker = profile?.role === "trekker";

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error ?? "Failed to create thread.", variant: "destructive" });
        return;
      }
      setTitle("");
      setBody("");
      setShowForm(false);
      toast({ title: "Discussion started!", description: "Your thread is now live." });
      reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold mb-1">Community</h1>
          <p className="text-muted-foreground">Discussions for trekkers and fellow adventurers.</p>
        </div>
        {isTrekker && (
          <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
            <Plus className="w-4 h-4" />
            Start Discussion
          </Button>
        )}
      </div>

      {showForm && isTrekker && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">New Discussion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Thread title (e.g. Best gear for Everest Base Camp?)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="Share your thoughts, questions, or experiences…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !title.trim() || !body.trim()}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Users className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No discussions yet. Be the first to start one!</p>
          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground">Log in as a trekker to start a discussion.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <Link key={t.id} href={`/community/${t.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base leading-snug mb-1 line-clamp-2">{t.title}</h2>
                      <p className="text-sm text-muted-foreground line-clamp-2">{t.body}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{t.authorName ?? "Anonymous"}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">
                          {t.authorRole ?? "trekker"}
                        </Badge>
                        <span>·</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.replyCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
