import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import {
  Users,
  Search,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  UserPlus,
  ArrowLeft,
  X,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [username, setUsername] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [tempName, setTempName] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const bottomRef = useRef(null);

  // emoji click
  const onEmojiClick = (emojiData) => {
    setText((prevText) => prevText + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // ambil nama user
  useEffect(() => {
    const name = localStorage.getItem("username");
    if (!name) setShowNameModal(true);
    else {
      setUsername(name);
      fetchGroups();
    }
  }, []);

  // realtime group
  useEffect(() => {
    if (!username) return;
    const groupChannel = supabase
      .channel("realtime:groups")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "groups" }, (payload) => {
        setGroups((prev) => [payload.new, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(groupChannel);
  }, [username]);

  // realtime messages untuk update grup
  useEffect(() => {
    if (!username) return;
    const msgChannel = supabase
      .channel("realtime:all-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        setGroups((prev) =>
          prev
            .map((g) =>
              g.id === payload.new.group_id
                ? {
                    ...g,
                    last_message: payload.new.text || "[image]",
                    last_sender: payload.new.sender,
                    last_time: payload.new.created_at,
                  }
                : g
            )
            .sort(
              (a, b) =>
                new Date(b.last_time || b.created_at) - new Date(a.last_time || a.created_at)
            )
        );
      })
      .subscribe();
    return () => supabase.removeChannel(msgChannel);
  }, [username]);

  // realtime chat tiap grup
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
          (payload) => setMessages((prev) => [...prev, payload.new])
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [selectedGroup]);

  // auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ambil semua grup
  const fetchGroups = async () => {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return;

    const withLastMsg = await Promise.all(
      data.map(async (g) => {
        const { data: last } = await supabase
          .from("messages")
          .select("sender,text,created_at")
          .eq("group_id", g.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...g,
          last_message: last?.text || null,
          last_sender: last?.sender || null,
          last_time: last?.created_at || null,
        };
      })
    );
    setGroups(withLastMsg);
  };

  // ambil pesan
  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("group_id", selectedGroup.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  // kirim pesan (fix upload image)
  const sendMessage = async () => {
    if ((!text.trim() && !imageFile) || !selectedGroup) return;

    let imageUrl = null;

    try {
      // upload image ke Supabase Storage
      if (imageFile) {
        const fileName = `${Date.now()}-${imageFile.name}`;
        console.log("Uploading:", fileName);

        const { error: uploadError } = await supabase.storage
          .from("chat-image")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("chat-image")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
        console.log("Image URL:", imageUrl);
      }

      // simpan ke tabel messages
      const { error: insertError } = await supabase.from("messages").insert([
        {
          group_id: selectedGroup.id,
          sender: username,
          text: text.trim() || "(photo)",
          image_url: imageUrl,
        },
      ]);

      if (insertError) throw insertError;

      console.log("✅ Pesan tersimpan ke database!");
      setText("");
      setPreviewImage(null);
      setImageFile(null);
    } catch (err) {
      console.error("❌ Gagal kirim pesan:", err);
      alert("Gagal kirim pesan: " + err.message);
    }
  };

  // preview foto
  const handleImageSelect = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);
    setImageFile(file);
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
    await supabase.from("groups").insert([{ name: newGroupName }]);
    setNewGroupName("");
    setShowCreateGroup(false);
  };

  return (
    <div className="flex h-[100dvh] bg-gray-100 text-gray-900">
      {/* Sidebar */}
      <div
        className={`${
          selectedGroup ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-1/3 lg:w-1/4 bg-white border-r`}
      >
        <div className="flex items-center justify-between p-4 bg-emerald-900 text-white">
          <h1 className="font-semibold text-lg">Chatrell 💬</h1>
          <button onClick={() => setShowCreateGroup(true)} className="p-2 hover:bg-white/20 rounded-full">
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => setSelectedGroup(g)}
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 border-b"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{g.name}</p>
                <p className="text-sm text-gray-500 truncate">
                  {g.last_message
                    ? `${g.last_sender === username ? "You" : g.last_sender}: ${g.last_message}`
                    : "No messages yet"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex flex-col flex-1 bg-[#efeae2] ${selectedGroup ? "flex" : "hidden md:flex"}`}>
        {selectedGroup ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-900 text-white">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedGroup(null)} className="md:hidden p-1 hover:bg-white/20 rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-700" />
                </div>
                <p className="font-semibold">{selectedGroup.name}</p>
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
                        {m.image_url && (
                          <img src={m.image_url} alt="" className="max-w-[200px] rounded-lg mb-1" />
                        )}
                        {m.text && <p className="text-sm">{m.text}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}></div>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-gray-100 border-t flex flex-col gap-2 relative">
              {previewImage && (
                <div className="relative w-fit">
                  <img src={previewImage} alt="preview" className="max-h-32 rounded-lg shadow-md border" />
                  <button
                    onClick={() => {
                      setPreviewImage(null);
                      setImageFile(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-600">
                  <Smile className="w-5 h-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-14 left-10 z-50">
                    <EmojiPicker onEmojiClick={onEmojiClick} />
                  </div>
                )}

                <div className="flex-1 bg-white rounded-full flex items-center px-3 py-2 shadow-sm">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 text-sm focus:outline-none bg-transparent"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    id="file-upload"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files[0])}
                  />
                  <label htmlFor="file-upload" className="p-1 text-gray-500 cursor-pointer">
                    <Paperclip className="w-4 h-4" />
                  </label>
                </div>

                <button
                  onClick={sendMessage}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full transition"
                >
                  {text.trim() || imageFile ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Users className="w-16 h-16 mb-3 opacity-30" />
            <p>Select a group to start chatting.</p>
          </div>
        )}
      </div>

      {/* Modal Nama */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-80">
            <h2 className="text-xl font-bold mb-4 text-center">Enter Your Name</h2>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="w-full px-4 py-3 border rounded-xl mb-3"
              placeholder="Your name..."
            />
            <button
              onClick={saveName}
              className="w-full bg-emerald-500 text-white py-3 rounded-xl font-semibold"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Modal Create Group */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-80">
            <h2 className="text-xl font-semibold mb-4">Create Group</h2>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name..."
              className="w-full px-4 py-3 border rounded-xl mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="flex-1 bg-gray-200 py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-xl"
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
