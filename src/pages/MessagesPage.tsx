import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Search, User, MessageSquare, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const MessagesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users (profiles) that can be messaged
  const { data: allUsers } = useQuery({
    queryKey: ["message-users"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .neq("user_id", user!.id)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch conversations (grouped by other user)
  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Group by conversation partner
      const convMap = new Map<string, { partnerId: string; lastMessage: any; unreadCount: number }>();
      data?.forEach((msg) => {
        const partnerId = msg.sender_id === user!.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            partnerId,
            lastMessage: msg,
            unreadCount: msg.receiver_id === user!.id && !msg.read ? 1 : 0,
          });
        } else {
          const existing = convMap.get(partnerId)!;
          if (msg.receiver_id === user!.id && !msg.read) {
            existing.unreadCount++;
          }
        }
      });
      return Array.from(convMap.values());
    },
  });

  // Fetch messages for selected conversation
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", selectedUserId],
    enabled: !!selectedUserId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user!.id})`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("direct-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["conversations"] });
          refetchMessages();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refetchMessages, qc]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedUserId || !user || !messages) return;
    const unreadIds = messages.filter((m) => m.receiver_id === user.id && !m.read).map((m) => m.id);
    if (unreadIds.length > 0) {
      supabase.from("direct_messages").update({ read: true }).in("id", unreadIds).then(() => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      });
    }
  }, [messages, selectedUserId, user?.id, qc]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user!.id,
        receiver_id: selectedUserId!,
        content: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      refetchMessages();
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getUserProfile = (userId: string) => allUsers?.find((u) => u.user_id === userId);
  const selectedUser = selectedUserId ? getUserProfile(selectedUserId) : null;

  const filteredUsers = allUsers?.filter((u) =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-xl border bg-card shadow-card overflow-hidden animate-fade-in">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-display font-bold text-lg">Messages</h2>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-9 h-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {userSearch ? (
            // Search results
            filteredUsers?.map((u) => (
              <button
                key={u.user_id}
                onClick={() => { setSelectedUserId(u.user_id); setUserSearch(""); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
                  {(u.first_name?.[0] || u.email?.[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </button>
            ))
          ) : (
            // Existing conversations
            conversations?.map((conv) => {
              const partner = getUserProfile(conv.partnerId);
              const isSelected = selectedUserId === conv.partnerId;
              return (
                <button
                  key={conv.partnerId}
                  onClick={() => setSelectedUserId(conv.partnerId)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                    isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
                    {(partner?.first_name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {partner?.first_name || "User"} {partner?.last_name || ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage?.content}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge variant="default" className="text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
          {!userSearch && !conversations?.length && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Search for a user to start chatting</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUserId ? (
          <>
            <div className="px-5 py-4 border-b flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {(selectedUser?.first_name?.[0] || "?").toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">{selectedUser?.first_name || "User"} {selectedUser?.last_name || ""}</p>
                <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages?.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary rounded-bl-md"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                        <span className="text-[10px] opacity-70">
                          {new Date(msg.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isMine && (
                          msg.read ? <CheckCheck className="h-3 w-3 opacity-70" /> : <Check className="h-3 w-3 opacity-50" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t">
              <form onSubmit={(e) => { e.preventDefault(); if (message.trim()) sendMessage.mutate(); }} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || sendMessage.isPending}
                  className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 mb-3" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm">or search for a user to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
