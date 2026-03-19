import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  sendChatMessage,
  getChatMessages,
  subscribeToChatMessages,
} from '../../multiplayer/multiplayerService';
import type { ChatMessage } from '../../multiplayer/multiplayerService';

// ── Types ──────────────────────────────────────────────────────

interface ChatPanelProps {
  gameId: string;
  isOpen: boolean;
  onToggle: () => void;
}

// ── Helpers ────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Component ──────────────────────────────────────────────────

export default function ChatPanel({ gameId, isOpen, onToggle }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Load initial messages ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const history = await getChatMessages(gameId);
        if (!cancelled) {
          setMessages(history);
        }
      } catch {
        // Silently fail — chat is non-critical
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // ── Subscribe to real-time messages ────────────────────────

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages(gameId, (newMessage: ChatMessage) => {
      setMessages((prev) => [...prev, newMessage]);

      // Track unread when panel is collapsed
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [gameId, isOpen]);

  // ── Clear unread on open ───────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // ── Auto-scroll to bottom ─────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // ── Send handler ───────────────────────────────────────────

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft('');
    setSending(true);
    try {
      await sendChatMessage(gameId, text);
    } catch {
      // Re-populate draft on failure
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mb-2 flex w-[300px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950/90 shadow-2xl backdrop-blur-xl"
            style={{ height: 400 }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-semibold tracking-wide text-white/80">Game Chat</h3>
              <button
                onClick={onToggle}
                className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2">
              {messages.length === 0 && (
                <p className="mt-8 text-center text-xs text-white/20">
                  No messages yet. Say hello!
                </p>
              )}
              {messages.map((msg) => {
                const playerName = localStorage.getItem('planez_player_name') ?? '';
                const isOwn = msg.senderName === playerName;
                // Generate a deterministic color from senderName
                const senderColor = (() => {
                  let hash = 0;
                  for (let i = 0; i < msg.senderName.length; i++) {
                    hash = msg.senderName.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const hue = Math.abs(hash) % 360;
                  return `hsl(${hue}, 70%, 65%)`;
                })();
                return (
                  <div
                    key={msg.id}
                    className={`mb-2 flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    {!isOwn && (
                      <span
                        className="mb-0.5 text-[10px] font-semibold"
                        style={{ color: senderColor }}
                      >
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`max-w-[220px] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        isOwn
                          ? 'rounded-br-sm bg-blue-600/30 text-blue-100'
                          : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-white/80'
                      }`}
                    >
                      {msg.message}
                    </div>
                    <span className="mt-0.5 text-[9px] text-white/20">
                      {formatTimestamp(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-blue-500/50 focus:bg-white/[0.06]"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                    draft.trim() && !sending
                      ? 'bg-blue-600/30 text-blue-200 hover:bg-blue-600/40'
                      : 'bg-white/[0.03] text-white/15'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gray-950/90 shadow-lg backdrop-blur-xl transition-colors hover:border-blue-500/30 hover:bg-white/[0.08]"
      >
        {/* Chat icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && !isOpen && (
            <motion.span
              className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
