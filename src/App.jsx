import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import { Users, Search, MoreVertical, Smile, Paperclip, Mic,UserPlus  } from "lucide-react";

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
    let name = localStorage.getItem("username");
    if (!name) {
      setShowNameModal(true);
    } else {
      setUsername(name);
      fetchGroups();
    }
  }, []);

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
            filter: `group_id=eq.${selectedGroup.id}`
          },
          (payload) => {
            setMessages((prev) => {
              const exists = prev.some(
                (m) =>
                  m.text === payload.new.text &&
                  m.sender === payload.new.sender &&
                  Math.abs(new Date(m.created_at) - new Date(payload.new.created_at)) < 1000
              );
              if (exists) return prev;
              
              if (!prev.some(m => m.sender === payload.new.sender)) {
                setMembers(current => [...new Set([...current, payload.new.sender])]);
              }
              
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
  }, [selectedGroup]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchGroups = async () => {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    setGroups(data || []);
  };

  const fetchMessages = async () => {
    if (!selectedGroup) return;
    
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("group_id", selectedGroup.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    
    if (data && data.length > 0) {
      const uniqueSenders = [...new Set(data.map(m => m.sender))];
      setMembers(uniqueSenders);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    
    const { data, error } = await supabase
      .from("groups")
      .insert([{ 
        name: newGroupName, 
        description: newGroupDesc || "Tidak ada deskripsi"
      }])
      .select();
    
    if (data) {
      setGroups([data[0], ...groups]);
      setNewGroupName("");
      setNewGroupDesc("");
      setShowCreateGroup(false);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !selectedGroup) return;
    await supabase
      .from("messages")
      .insert([{ 
        group_id: selectedGroup.id,
        sender: username, 
        text 
      }]);
    setText("");
  };

  const saveName = () => {
    if (!tempName.trim()) return;
    localStorage.setItem("username", tempName);
    setUsername(tempName);
    setShowNameModal(false);
    fetchGroups();
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 p-2 sm:p-4 relative overflow-hidden">
      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white rounded-3xl p-8 w-80 shadow-2xl transform animate-[scaleIn_0.3s_ease-out]">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome! 👋</h2>
              <p className="text-sm text-gray-600 text-center">
                Enter your name to start chatting. This app was created by Varell.
              </p>
            </div>
            
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Your Name..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-gray-800 mb-4 transition"
              autoFocus
            />
            
            <button
              onClick={saveName}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 rounded-xl font-semibold transition shadow-lg active:scale-95"
            >
              Start Chat
            </button>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white rounded-3xl p-8 w-80 shadow-2xl transform animate-[scaleIn_0.3s_ease-out]">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Group</h2>
            
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Name group..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-gray-800 mb-3 transition"
              autoFocus
            />
            
            <textarea
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Description (opsional)..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-gray-800 mb-4 transition resize-none h-20"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroupName("");
                  setNewGroupDesc("");
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-semibold transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 rounded-xl font-semibold transition shadow-lg active:scale-95"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute w-64 h-64 bg-white/5 rounded-full blur-2xl top-1/2 left-1/4 animate-pulse" style={{animationDelay: '0.5s'}}></div>
      </div>
      
      {/* 📱 Phone Frame */}
      <div className="relative z-10 w-full max-w-[340px] h-[calc(100vh-1rem)] sm:h-[min(680px,calc(100vh-2rem))] bg-gradient-to-b from-gray-900 to-black rounded-[45px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden border-[10px] border-gray-900 flex flex-col transform hover:scale-[1.02] transition-transform duration-300">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 sm:w-32 h-6 sm:h-7 bg-black rounded-b-3xl z-30 flex items-center justify-center gap-2">
          <div className="w-12 sm:w-14 h-1.5 bg-gray-800 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-900 rounded-full ring-1 ring-gray-700"></div>
        </div>

        {/* Status Bar */}
        <div className="bg-[#075e54] text-white pt-7 sm:pt-8 pb-2 px-4 sm:px-5 text-[10px] sm:text-xs flex justify-between items-center flex-shrink-0">
          <div className="font-semibold"></div>
          <div className="flex gap-1.5 items-center">
             
            
            
          </div>
        </div>

        {!selectedGroup ? (
          /* Group List View */
          <>
            {/* Header */}
            <div className="bg-[#075e54] text-white py-4 px-4 flex items-center justify-between shadow-lg flex-shrink-0">
              <h1 className="text-xl font-semibold">WhatsApp</h1>
              <button
  onClick={() => setShowCreateGroup(true)}
  className="bg-white/20 hover:bg-white/30 p-2 rounded-full text-sm font-medium transition active:scale-95 flex items-center justify-center"
>
  <UserPlus className="w-5 h-5" />
</button>
            </div>

            {/* Groups List */}
            <div className="flex-1 overflow-y-auto bg-white">
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 px-8">
                  <Users className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-center text-sm">No groups yet. Create your first group!</p>

                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-100 transition"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-300 to-teal-400 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Users className="w-6 h-6 text-[#075e54]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{group.name}</div>
                      <div className="text-sm text-gray-500 truncate">{group.description}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {group.created_at ? new Date(group.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Chat View */
          <>
            {/* Header Chat */}
            <div className="bg-[#075e54] text-white py-2.5 px-4 flex items-center justify-between shadow-lg flex-shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setSelectedGroup(null);
                    setMessages([]);
                    setMembers([]);
                  }}
                  className="flex-shrink-0 hover:bg-white/10 p-1 rounded-full transition active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-300 to-teal-400 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white/20">
                  <Users className="w-5 h-5 text-[#075e54]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px]">{selectedGroup.name}</div>
                  <div className="text-[11px] opacity-90 truncate">
                    {members.length > 0 
                      ? `${members.slice(0, 3).join(", ")}${members.length > 3 ? `, +${members.length - 3} lainnya` : ''}`
                      : 'Belum ada anggota'}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 flex-shrink-0">
                <Search className="w-[18px] h-[18px] cursor-pointer hover:opacity-70 transition" />
                <MoreVertical className="w-[18px] h-[18px] cursor-pointer hover:opacity-70 transition" />
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#efeae2] relative">
              {/* WhatsApp Pattern Background */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
                }}
              ></div>

              <div className="relative z-10 space-y-1">
                {messages.map((m, i) => {
                  const isSender = m.sender === username;
                  const showName = i === 0 || messages[i - 1].sender !== m.sender;
                  
                  return (
                    <div key={i} className="animate-[slideIn_0.3s_ease-out]">
                      {showName && (
                        <div className={`text-[11px] font-semibold mb-1 px-2 ${isSender ? 'text-right' : 'text-left'}`}
                          style={{
                            color: isSender ? '#128C7E' : [
                              "#25d366",
                              "#34b7f1", 
                              "#ff6b6b",
                              "#feca57",
                              "#a29bfe",
                              "#fd79a8",
                            ][m.sender.length % 6],
                          }}
                        >
                          {m.sender}
                        </div>
                      )}
                      
                      <div className={`flex ${isSender ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`relative max-w-[80%] px-3 py-2 shadow-sm ${
                            isSender
                              ? "bg-[#d9fdd3] rounded-lg rounded-br-sm"
                              : "bg-white rounded-lg rounded-bl-sm"
                          }`}
                        >
                          <div
                            className={`absolute bottom-0 ${
                              isSender
                                ? "right-0 -mr-[5px]"
                                : "left-0 -ml-[5px]"
                            }`}
                          >
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              className={isSender ? "text-[#d9fdd3]" : "text-white"}
                            >
                              <path
                                d={
                                  isSender
                                    ? "M0 0 L10 0 L10 10 Z"
                                    : "M10 0 L0 0 L0 10 Z"
                                }
                                fill="currentColor"
                              />
                            </svg>
                          </div>

                          <div className="text-[14.5px] leading-relaxed break-words text-gray-900">
                            {m.text}
                          </div>
                          <div className="text-[10px] text-gray-500 text-right mt-1 flex items-center justify-end gap-1">
                            <span>
                              {m.created_at
                                ? new Date(m.created_at).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                            {isSender && (
                              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 11" fill="currentColor">
                                <path d="M11.071.653a.5.5 0 0 1 .708 0l3.889 3.889a.5.5 0 0 1 0 .707l-8.485 8.485a.5.5 0 0 1-.708 0L.354 7.612a.5.5 0 0 1 0-.707l.707-.707a.5.5 0 0 1 .708 0l5.303 5.303 7.778-7.778a.5.5 0 0 1 .708 0l.707.707a.5.5 0 0 1 0 .708L7.778 13.624"/>
                                <path d="M5.707 9.653a.5.5 0 0 0 .708 0l8.485-8.485a.5.5 0 0 0 0-.707l-.707-.707a.5.5 0 0 0-.708 0L5.707 7.532a.5.5 0 0 0 0 .708l.707.707a.5.5 0 0 0 .708 0"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}></div>
              </div>
            </div>

            {/* Input Bar */}
            <div className="bg-[#f0f0f0] p-2 flex items-center gap-2 border-t border-gray-300 flex-shrink-0">
              <button className="p-2 text-gray-600 hover:text-gray-800 transition active:scale-95">
                <Smile className="w-5 h-5" />
              </button>
              <div className="flex-1 bg-white rounded-full flex items-center px-4 py-2.5 shadow-sm">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ketik pesan..."
                  className="flex-1 text-[14px] focus:outline-none bg-transparent placeholder-gray-500"
                />
                <button className="p-1 text-gray-500 hover:text-gray-700 transition">
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={sendMessage}
                className="bg-[#25d366] hover:bg-[#20ba5a] text-white p-3 rounded-full font-semibold transition shadow-md active:scale-95 flex items-center justify-center"
              >
                {text.trim() ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>
          </>
        )}

        {/* Home Indicator */}
        <div className="h-5 bg-[#f0f0f0] flex items-center justify-center flex-shrink-0">
          <div className="w-28 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>
      
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.9);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}