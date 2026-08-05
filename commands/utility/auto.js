module.exports = async (sock, from, msg, isOwner, botData, saveBotData, userId, args) => {
    if (!isOwner) return sock.sendMessage(from, { text: "❌ Owner only command!" }, { quoted: msg });
    
    const cmd = msg.body.toLowerCase().split(' ')[0].slice(1);
    const action = args[0]?.toLowerCase();
    
    const toggleFeature = (featureName, displayName) => {
        if (action === 'on') {
            botData[featureName][userId] = true;
            saveBotData();
            return sock.sendMessage(from, { text: `✅ ${displayName} enabled!` }, { quoted: msg });
        } else if (action === 'off') {
            delete botData[featureName][userId];
            saveBotData();
            return sock.sendMessage(from, { text: `❌ ${displayName} disabled!` }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: `Usage: .${cmd} on/off` }, { quoted: msg });
        }
    };

    switch (cmd) {
        case 'autotype': return toggleFeature('autoType', 'Auto-Type');
        case 'autorecord': return toggleFeature('autoRecord', 'Auto-Record');
        case 'alwaysonline': return toggleFeature('alwaysOnline', 'Always-Online');
        case 'autoviewstatus': return toggleFeature('autoViewStatus', 'Auto-View Status');
        case 'autosavestatus': return toggleFeature('autoSaveStatus', 'Auto-Save Status');
        case 'chatbot': return toggleFeature('chatbot', 'Chatbot');
    }
};
