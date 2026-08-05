module.exports = async (sock, from, msg, isAdmin, botData, saveBotData, args) => {
    if (!isAdmin) return sock.sendMessage(from, { text: "❌ Admin only command!" }, { quoted: msg });
    
    const cmd = msg.body.toLowerCase().split(' ')[0].slice(1);
    const action = args[0]?.toLowerCase();
    const text = args.slice(1).join(' ');
    
    if (cmd === 'welcome') {
        if (action === 'on') {
            botData.welcomeGroups[from] = text || true;
            saveBotData();
            return sock.sendMessage(from, { text: "✅ Welcome message enabled!" }, { quoted: msg });
        } else if (action === 'off') {
            delete botData.welcomeGroups[from];
            saveBotData();
            return sock.sendMessage(from, { text: "❌ Welcome message disabled!" }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: "Usage: .welcome on [custom text] / .welcome off" }, { quoted: msg });
        }
    }
    
    if (cmd === 'goodbye') {
        if (action === 'on') {
            botData.goodbyeGroups[from] = text || true;
            saveBotData();
            return sock.sendMessage(from, { text: "✅ Goodbye message enabled!" }, { quoted: msg });
        } else if (action === 'off') {
            delete botData.goodbyeGroups[from];
            saveBotData();
            return sock.sendMessage(from, { text: "❌ Goodbye message disabled!" }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: "Usage: .goodbye on [custom text] / .goodbye off" }, { quoted: msg });
        }
    }
};
