import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Loader2, Search, User, MessageSquare, Check, CheckCheck, Smile, Paperclip, X, FileText, Image, Download } from "lucide-react";
import { toast } from "sonner";

// Lazy-load the emoji picker bundle (~800KB) — only fetched when the user opens it.
const EmojiPicker = lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import("@emoji-mart/react"),
    import("@emoji-mart/data"),
  ]);
  return { default: (props: any) => <Picker data={data} {...props} /> };
});

type PublicUser = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

const MessagesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced query so we only hit the server after the user pauses typing.
  const debouncedSearch = useDebounce(userSearch, 300);

  // Recipient picker: server-side search returning name/avatar/role only (no email).
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["search-users", debouncedSearch],
    enabled: !!user && debouncedSearch.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("search_messageable_users", {
        _query: debouncedSearch.trim(),
        _limit: 25,
      });
      if (error) throw error;
      return (data || []) as PublicUser[];
    },
  });

  // Reset highlight when the search or results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedSearch, searchResults?.length]);

  const startConversationWith = (userId: string) => {
    setSelectedUserId(userId);
    setUserSearch("");
    setActiveIndex(0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = searchResults[activeIndex];
      if (target) startConversationWith(target.user_id);
    } else if (e.key === "Escape") {
      setUserSearch("");
    }
  };

  // Keep highlighted item scrolled into view.
  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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

  // Resolve conversation partner profiles via the public-profiles RPC (no email exposure).
  const partnerIds = useMemo(() => {
    const ids = new Set<string>();
    conversations?.forEach((c) => ids.add(c.partnerId));
    if (selectedUserId) ids.add(selectedUserId);
    return Array.from(ids);
  }, [conversations, selectedUserId]);

  const { data: partnerProfiles } = useQuery({
    queryKey: ["public-profiles", partnerIds.sort().join(",")],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_profiles", {
        _user_ids: partnerIds,
      });
      if (error) throw error;
      return (data || []) as PublicUser[];
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
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` },
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
      setUploading(true);
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (attachment) {
        const path = `${user!.id}/${Date.now()}_${attachment.name}`;
        const { error: uploadErr } = await supabase.storage.from("message-attachments").upload(path, attachment);
        if (uploadErr) throw uploadErr;
        const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 31536000);
        fileUrl = data?.signedUrl || null;
        fileName = attachment.name;
      }

      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user!.id,
        receiver_id: selectedUserId!,
        content: message.trim(),
        file_url: fileUrl,
        file_name: fileName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      setAttachment(null);
      setUploading(false);
      refetchMessages();
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  const getUserProfile = (userId: string): PublicUser | undefined =>
    partnerProfiles?.find((u) => u.user_id === userId) ||
    searchResults?.find((u) => u.user_id === userId);

  const selectedUser = selectedUserId ? getUserProfile(selectedUserId) : null;

  const getAvatarUrl = (avatarPath: string | null) => {
    if (!avatarPath) return null;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath}`;
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage((prev) => prev + emoji.native);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setAttachment(file);
  };

  const isImage = (filename: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const fullName = (u?: PublicUser | null) =>
    u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "User" : "User";
  const initial = (u?: PublicUser | null) =>
    (u?.first_name?.[0] || u?.last_name?.[0] || "?").toUpperCase();

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
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by name… (↑/↓ + Enter)"
              className="pl-9 h-9"
              aria-label="Search users to start a conversation"
              role="combobox"
              aria-expanded={!!userSearch && !!searchResults?.length}
              aria-controls="recipient-results"
              aria-activedescendant={
                searchResults?.length ? `recipient-result-${activeIndex}` : undefined
              }
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" ref={resultsRef} id="recipient-results" role="listbox">
          {userSearch ? (
            <>
              {(searching || userSearch !== debouncedSearch) && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && userSearch === debouncedSearch && searchResults?.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No users found.
                </div>
              )}
              {searchResults?.map((u, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={u.user_id}
                    id={`recipient-result-${idx}`}
                    data-result-index={idx}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => startConversationWith(u.user_id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                      isActive ? "bg-primary/10" : "hover:bg-secondary/50"
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {u.avatar_url && <AvatarImage src={getAvatarUrl(u.avatar_url)!} alt="" />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                        {initial(u)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{fullName(u)}</p>
                        {u.role && (
                          <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                            {u.role.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
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
                  <Avatar className="h-10 w-10 shrink-0">
                    {partner?.avatar_url && <AvatarImage src={getAvatarUrl(partner.avatar_url)!} alt="" />}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {initial(partner)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fullName(partner)}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage?.content || "📎 Attachment"}</p>
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
              <Avatar className="h-9 w-9">
                {selectedUser?.avatar_url && <AvatarImage src={getAvatarUrl(selectedUser.avatar_url)!} alt="" />}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                  {initial(selectedUser)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{fullName(selectedUser)}</p>
                {selectedUser?.role && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedUser.role.replace("_", " ")}
                  </p>
                )}
              </div>
            </div>
            <VirtualMessagesList
              messages={(messages as any) || []}
              currentUserId={user?.id}
              getUserProfile={getUserProfile}
              getAvatarUrl={getAvatarUrl}
              initial={initial}
              isImage={isImage}
            />
            <div ref={messagesEndRef} />

            {/* Attachment preview */}
            {attachment && (
              <div className="px-4 py-2 border-t bg-secondary/30 flex items-center gap-2">
                {isImage(attachment.name) ? (
                  <Image className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm truncate flex-1">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="p-1 hover:bg-secondary rounded">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="p-4 border-t">
              <form onSubmit={(e) => { e.preventDefault(); if (message.trim() || attachment) sendMessage.mutate(); }} className="flex gap-2 items-end">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center h-10 w-10 rounded-lg hover:bg-secondary transition-colors"
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-center h-10 w-10 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <Smile className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none" align="start">
                    <Suspense fallback={<div className="p-6 text-xs text-muted-foreground">Loading…</div>}>
                      <EmojiPicker onEmojiSelect={handleEmojiSelect} theme="auto" />
                    </Suspense>
                  </PopoverContent>
                </Popover>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <button
                  type="submit"
                  disabled={(!message.trim() && !attachment) || uploading}
                  className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
