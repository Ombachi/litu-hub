import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FileText, Download, Check, CheckCheck, Image as ImageIcon } from "lucide-react";

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  created_at: string;
  read: boolean;
  file_url?: string | null;
  file_name?: string | null;
};

interface VirtualMessagesListProps {
  messages: Msg[];
  currentUserId: string | undefined;
  getUserProfile: (id: string) => any;
  getAvatarUrl: (path: string) => string | null;
  initial: (p: any) => string;
  isImage: (name: string) => boolean;
}

const ESTIMATE = 80; // px per message; refined by measureElement at runtime

/**
 * Windowed renderer for the active conversation. Long threads (hundreds of
 * messages) only mount the visible rows + a small overscan, keeping the DOM
 * node count constant regardless of conversation length.
 */
const VirtualMessagesList = ({
  messages,
  currentUserId,
  getUserProfile,
  getAvatarUrl,
  initial,
  isImage,
}: VirtualMessagesListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATE,
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Auto-scroll to the latest message whenever the list grows.
  useEffect(() => {
    if (!parentRef.current || messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
  }, [messages.length, virtualizer]);

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto p-5">
      <div
        style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const msg = messages[vi.index];
          const isMine = msg.sender_id === currentUserId;
          const senderProfile = isMine ? null : getUserProfile(msg.sender_id);
          return (
            <div
              key={msg.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className={`absolute left-0 right-0 flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}
              style={{ transform: `translateY(${vi.start}px)`, paddingBottom: 12 }}
            >
              {!isMine && (
                <Avatar className="h-7 w-7 shrink-0 mt-1">
                  {senderProfile?.avatar_url && (
                    <AvatarImage src={getAvatarUrl(senderProfile.avatar_url)!} alt="" />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                    {initial(senderProfile)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary rounded-bl-md"
                }`}
              >
                {msg.file_url && (
                  <div className="mb-2">
                    {isImage(msg.file_name || "") ? (
                      <img src={msg.file_url} alt="" className="rounded-lg max-w-full max-h-48 object-cover" />
                    ) : (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          isMine ? "bg-primary-foreground/20" : "bg-background/50"
                        }`}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="text-xs truncate flex-1">{msg.file_name}</span>
                        <Download className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                  </div>
                )}
                {msg.content && (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                  <span className="text-[10px] opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString("en-KE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMine &&
                    (msg.read ? (
                      <CheckCheck className="h-3 w-3 opacity-70" />
                    ) : (
                      <Check className="h-3 w-3 opacity-50" />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualMessagesList;
