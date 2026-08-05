module.exports = async (sock, from, msg, isAdmin, botData, saveBotData, userId, q, args, isOwner, session) => {
    const customName = botData.userNames[userId] || msg.pushName || 'User';
    const s = botData.statusSettings[userId] || {};
    const mode = session.isPublic ? 'Public' : 'Private';
    
    const menuText = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃   💀  *ZESHOO WEB PAIR MD*  💀      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🤖 *BOT NAME*  : ZESHOO WEB PAIR ┃
┃  👤 *OWNER*     : ZESHOO          ┃
┃  🌍 *MODE*      : ${mode}          ┃
┃  📊 *VERSION*   : 4.0.0           ┃
┃  🕒 *RUNTIME*   : ${process.uptime().toFixed(0)}s    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🛡️ *PROTECTION*                   ┃
┃  .antilink [on/off]               ┃
┃  .antidelete [on/off]             ┃
┃  .antivideo [on/off]              ┃
┃  .antiimage [on/off]              ┃
┃  .antivoice [on/off]              ┃
┃  .antisticker [on/off]            ┃
┃  .antitag [on/off]                ┃
┃  .antibadword [on/off]            ┃
┃  .antipromote [on/off]            ┃
┃  .antidemote [on/off]             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  👥 *GROUP*                        ┃
┃  .kick .add .promote .demote      ┃
┃  .welcome [on/off]                ┃
┃  .goodbye [on/off]                ┃
┃  .mute .unmute .tagall            ┃
┃  .kickall                         ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  📥 *DOWNLOAD*                     ┃
┃  .song .video .insta .tiktok      ┃
┃  .youtube .facebook .spotify      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🤖 *AUTOMATION*                   ┃
┃  .autotype .autorecord            ┃
┃  .alwaysonline .chatbot           ┃
┃  .autoviewstatus .autosavestatus  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🛠️ *UTILITY*                      ┃
┃  .ping .runtime .status .ai       ┃
┃  .sticker .toimg .tomp3 .tts      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

    await sock.sendMessage(from, { 
        image: { url: 'https://files.catbox.moe/qwvzbn.png' },
        caption: menuText 
    }, { quoted: msg });
};
