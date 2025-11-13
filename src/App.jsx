import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import { Users, Search, MoreVertical, Smile, Paperclip, Mic, UserPlus, ArrowLeft } from "lucide-react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [username, setUsername] = useState("");
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [tempName, setTempName] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const name = localStorage.getItem("username");
    if (!name) setShowNameModal(true);
    else {
      setUsername(name);
      fetchGroups();
    }
  }, []);

  // Realtime untuk grup baru yang dibuat
  useEffect(() => {
    if (!username) return;

    const channel = supabase
      .channel(`realtime:new-groups`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "groups",
        },
        (payload) => {
          // Tambah grup baru di list tanpa reload
          setGroups((prevGroups) => [
            {
              ...payload.new,
              last_message: null,
              last_sender: null,
              last_time: null,
            },
            ...prevGroups,
          ]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [username]);

  // Realtime untuk semua grup - update last message dan urutan
  useEffect(() => {
    if (!username) return;

    const channel = supabase
      .channel(`realtime:all-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Update groups list dengan last message terbaru
          setGroups((prevGroups) => {
            const updatedGroups = prevGroups.map((group) => {
              if (group.id === payload.new.group_id) {
                return {
                  ...group,
                  last_message: payload.new.text,
                  last_sender: payload.new.sender,
                  last_time: payload.new.created_at,
                };
              }
              return group;
            });

            // Sort ulang: grup dengan chat terbaru di atas
            return updatedGroups.sort((a, b) => {
              const timeA = a.last_time || a.created_at;
              const timeB = b.last_time || b.created_at;
              return new Date(timeB) - new Date(timeA);
            });
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [username]);

  // Realtime untuk selected group - update messages
  useEffect(() => {
    if (selectedGroup) {
      fetchMessages();

      const channel = supabase
        .channel(`realtime:messages:${selectedGroup.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `group_id=eq.${selectedGroup.id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new]);
            if (!members.includes(payload.new.sender)) {
              setMembers((prevMembers) => [...new Set([...prevMembers, payload.new.sender])]);
            }
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
  }, [selectedGroup, members]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchGroups = async () => {
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (!groupsData) return;

    const withLastMessage = await Promise.all(
      groupsData.map(async (group) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("sender, text, created_at")
          .eq("group_id", group.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...group,
          last_message: lastMsg?.text || null,
          last_sender: lastMsg?.sender || null,
          last_time: lastMsg?.created_at || null,
        };
      })
    );

    // Sort berdasarkan last_time atau created_at
    const sortedGroups = withLastMessage.sort((a, b) => {
      const timeA = a.last_time || a.created_at;
      const timeB = b.last_time || b.created_at;
      return new Date(timeB) - new Date(timeA);
    });

    setGroups(sortedGroups);
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("group_id", selectedGroup.id)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    if (data?.length) {
      setMembers([...new Set(data.map((m) => m.sender))]);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !selectedGroup) return;
    await supabase.from("messages").insert([
      {
        group_id: selectedGroup.id,
        sender: username,
        text,
      },
    ]);
    setText("");
  };

  const saveName = () => {
    if (!tempName.trim()) return;
    localStorage.setItem("username", tempName);
    setUsername(tempName);
    setShowNameModal(false);
    fetchGroups();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;

    await supabase
      .from("groups")
      .insert([{ name: newGroupName, description: newGroupDesc || "No description" }]);

    // Grup baru akan muncul otomatis via realtime
    setNewGroupName("");
    setNewGroupDesc("");
    setShowCreateGroup(false);
  };

  return (
    <div className="flex h-[100dvh] bg-gray-100 text-gray-900">
      {/* Left Panel */}
      <div
        className={`${
          selectedGroup ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-emerald-600 text-white">
          <h1 className="font-semibold text-lg">ChatApp</h1>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 hover:bg-white/20 rounded-full"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6">
              <Users className="w-12 h-12 mb-3 opacity-40" />
              <p>No groups yet. Create one to start chatting.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition"
              >
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{group.name}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {group.last_message
                      ? `${group.last_sender === username ? "You" : group.last_sender}: ${group.last_message}`
                      : "No messages yet"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div
        className={`flex flex-col flex-1 bg-[#efeae2] ${
          selectedGroup ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedGroup ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden p-1 hover:bg-white/20 rounded-full"
                  onClick={() => setSelectedGroup(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="font-semibold">{selectedGroup.name}</p>
                  <p className="text-xs text-white/80 truncate">
                    {members.length > 0 ? members.join(", ") : "No members yet"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Search className="w-5 h-5" />
                <MoreVertical className="w-5 h-5" />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {messages.map((m, i) => {
                const isSender = m.sender === username;
                const showName = i === 0 || messages[i - 1].sender !== m.sender;
                return (
                  <div key={i}>
                    {showName && (
                      <p
                        className={`text-xs font-semibold mb-1 ${
                          isSender ? "text-right text-emerald-700" : "text-left text-emerald-600"
                        }`}
                      >
                        {m.sender}
                      </p>
                    )}
                    <div className={`flex ${isSender ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg shadow-sm ${
                          isSender ? "bg-[#d9fdd3]" : "bg-white"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{m.text}</p>
                        <p className="text-[10px] text-gray-500 text-right mt-1">
                          {new Date(m.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}></div>
            </div>

            {/* Input */}
            <div className="p-3 bg-gray-100 border-t border-gray-300 flex items-center gap-2">
              <button className="p-2 text-gray-600">
                <Smile className="w-5 h-5" />
              </button>
              <div className="flex-1 bg-white rounded-full flex items-center px-3 py-2 shadow-sm">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 text-sm focus:outline-none bg-transparent"
                />
                <button className="p-1 text-gray-500">
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={sendMessage}
                className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full transition"
              >
                {text.trim() ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Users className="w-16 h-16 mb-3 opacity-30" />
            <p>Select a group to start chatting.</p>
          </div>
        )}
      </div>

      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-3">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-1">Welcome 👋</h2>
              <p className="text-sm text-gray-600 text-center">
                Please enter your name to start chatting.
              </p>
            </div>

            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Your name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-emerald-500 outline-none mb-4"
              autoFocus
            />

            <button
              onClick={saveName}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition"
            >
              Start Chatting
            </button>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">Create New Group</h2>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-3 focus:border-emerald-500 outline-none"
            />
            <textarea
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl h-20 resize-none focus:border-emerald-500 outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}