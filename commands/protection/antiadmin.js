module.exports = async (sock, from, msg, isAdmin, botData, saveBotData, args) => {
    if (!isAdmin) return sock.sendMessage(from, { text: "❌ Admin only command!" }, { quoted: msg });
    
    const cmd = msg.body.toLowerCase().split(' ')[0].slice(1);
    const action = args[0]?.toLowerCase();
    
    if (cmd === 'antipromote') {
        if (action === 'on') {
            botData.antiPromote[from] = true;
            saveBotData();
            return sock.sendMessage(from, { text: "✅ Anti-Promote enabled!" }, { quoted: msg });
        } else if (action === 'off') {
            delete botData.antiPromote[from];
            saveBotData();
            return sock.sendMessage(from, { text: "❌ Anti-Promote disabled!" }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: "Usage: .antipromote on/off" }, { quoted: msg });
        }
    }
    
    if (cmd === 'antidemote') {
        if (action === 'on') {
            botData.antiDemote[from] = true;
            saveBotData();
            return sock.sendMessage(from, { text: "✅ Anti-Demote enabled!" }, { quoted: msg });
        } else if (action === 'off') {
            delete botData.antiDemote[from];
            saveBotData();
            return sock.sendMessage(from, { text: "❌ Anti-Demote disabled!" }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: "Usage: .antidemote on/off" }, { quoted: msg });
        }
    }
};
