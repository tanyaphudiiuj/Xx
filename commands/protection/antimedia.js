module.exports = async (sock, from, msg, isAdmin, botData, saveBotData, args) => {
    if (!isAdmin) return sock.sendMessage(from, { text: "❌ Admin only command!" }, { quoted: msg });
    
    const cmd = msg.body.toLowerCase().split(' ')[0].slice(1);
    const action = args[0]?.toLowerCase();
    
    const toggleFeature = (featureName, displayName) => {
        if (action === 'on') {
            botData[featureName][from] = true;
            saveBotData();
            return sock.sendMessage(from, { text: `✅ ${displayName} enabled!` }, { quoted: msg });
        } else if (action === 'off') {
            delete botData[featureName][from];
            saveBotData();
            return sock.sendMessage(from, { text: `❌ ${displayName} disabled!` }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: `Usage: .${cmd} on/off` }, { quoted: msg });
        }
    };

    switch (cmd) {
        case 'antivideo': return toggleFeature('antiVideo', 'Anti-Video');
        case 'antiimage': return toggleFeature('antiImage', 'Anti-Image');
        case 'antivoice': return toggleFeature('antiVoice', 'Anti-Voice');
        case 'antisticker': return toggleFeature('antiSticker', 'Anti-Sticker');
        case 'antitag': return toggleFeature('antiTag', 'Anti-Tag');
        case 'antibadword': return toggleFeature('antiBadword', 'Anti-Badword');
        case 'antigroupstatus': return toggleFeature('antiGroupStatus', 'Anti-GroupStatus');
    }
};
