module.exports = async (sock, from, msg, isAdmin, botData, saveBotData, userId, q, args, isOwner) => {
    if (!isOwner) return sock.sendMessage(from, { text: "❌ Owner only command!" }, { quoted: msg });
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: "❌ Group only command!" }, { quoted: msg });

    try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        const toKick = participants
            .filter(p => p.id !== botNumber && p.admin === null)
            .map(p => p.id);

        if (toKick.length === 0) return sock.sendMessage(from, { text: "❌ No members to kick (excluding admins and bot)." }, { quoted: msg });

        await sock.sendMessage(from, { text: `🚀 Kicking ${toKick.length} members...` }, { quoted: msg });

        for (const jid of toKick) {
            await sock.groupParticipantsUpdate(from, [jid], "remove");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to avoid ban
        }

        await sock.sendMessage(from, { text: "✅ Kickall complete!" }, { quoted: msg });
    } catch (e) {
        sock.sendMessage(from, { text: `❌ Error: ${e.message}` }, { quoted: msg });
    }
};
