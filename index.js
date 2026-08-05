require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadContentFromMessage, jidNormalizedUser, Browsers, delay } = require('@whiskeysockets/baileys');
const P = require('pino');
const { OpenAI } = require('openai');
const os = require('os');

// ==================== SETTINGS ====================
const settings = {
    version: '3.0.0',
    prefix: '.',
    ownerNumber: process.env.OWNER_NUMBER || '923271054080',
    ownerName: process.env.OWNER_NAME || 'ZESHOO',
    tgOwnerId: process.env.OWNER_TELEGRAM_ID || '123456789',
    premiumUsers: [],
    connectedBots: [],
    startimage: 'https://telegra.ph/file/your-image-url.jpg',
    whatsappChannel: 'https://whatsapp.com/channel/0029Va...'
};

// ==================== DYNAMIC COMMAND LOADER ====================
const commands = {};
const commandFolders = ['protection', 'group', 'download', 'ai', 'utility', 'owner', 'fun', 'tools', 'islamic', 'dangerous'];

commandFolders.forEach(folder => {
    const folderPath = path.join(__dirname, 'commands', folder);
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        files.forEach(file => {
            const commandName = file.split('.')[0];
            try {
                commands[commandName] = require(`./commands/${folder}/${file}`);
            } catch (e) {
                console.error(`Error loading command ${commandName} from ${folder}:`, e.message);
            }
        });
    }
});

// Alias commands
commands.autostatus = commands.status || (() => {});
commands.trt = commands.translate || (() => {});
commands.math = commands.calc || (() => {});
commands.gh = commands.github || (() => {});
commands.ss = commands.screenshot || (() => {});
commands.img = commands.toimg || (() => {});
commands.mp3 = commands.tomp3 || (() => {});
commands.s = commands.sticker || (() => {});

// ==================== EXPRESS SETUP ====================
const app = express();
const server = http.createServer(app);

// ==================== TELEGRAM BOT SETUP ====================
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
let tgBot = null;

if (tgToken) {
    try {
        tgBot = new TelegramBot(tgToken, { 
            polling: {
                interval: 3000,
                autoStart: true,
                params: { timeout: 10 }
            }
        });
        console.log('✅ Telegram bot initialized successfully');
    } catch (error) {
        console.error('❌ Telegram bot initialization failed:', error.message);
    }
}

if (tgBot) {
    tgBot.on('polling_error', (error) => {
        console.log('Telegram polling error:', error.message);
    });
}

// ==================== DATA MANAGEMENT ====================
const AUTH_DIR = './auth_info';
const DATA_FILE = './data/bot_data.json';
fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync('./data');

let botData = { 
    antilinkGroups: {}, 
    totalBots: 0, 
    registeredBots: [], 
    statusSettings: {}, 
    antiDelete: {}, 
    userNames: {}, 
    antiCall: {}, 
    broadcastHistory: [],
    welcomeGroups: {},
    goodbyeGroups: {},
    antiDemote: {},
    antiPromote: {},
    antiBadword: {},
    antiTag: {},
    antiGroupStatus: {},
    antiVideo: {},
    antiImage: {},
    antiVoice: {},
    antiSticker: {},
    autoSaveStatus: {},
    autoViewStatus: {},
    alwaysOnline: {},
    autoType: {},
    autoRecord: {},
    chatbot: {},
    antiStatusGroups: {}
};

if (fs.existsSync(DATA_FILE)) {
    try { 
        botData = fs.readJsonSync(DATA_FILE); 
    } catch (e) {
        console.error('Error reading data file:', e.message);
    }
}

function saveBotData() {
    try {
        fs.writeJsonSync(DATA_FILE, botData);
    } catch (e) {
        console.error('Error saving data:', e.message);
    }
}

// ==================== SESSIONS ====================
const sessions = {}; 
const userSockets = {}; 
const messageLogs = {}; 

// ==================== HELPER FUNCTIONS ====================
function getConnectedBotNumbers() {
    const numbers = [];
    for (const [sessionId, session] of Object.entries(sessions)) {
        if (session.sock && session.sock.user) {
            const num = jidNormalizedUser(session.sock.user.id).split('@')[0];
            numbers.push(num);
        }
    }
    return numbers;
}

function getAllActiveSockets() {
    const socks = [];
    for (const [sessionId, session] of Object.entries(sessions)) {
        if (session.sock && session.isConnected) {
            socks.push({ sock: session.sock, sessionId, phoneNumber: session.phoneNumber });
        }
    }
    return socks;
}

function getAllConnectedUserJids(sock) {
    const jids = [];
    if (sock.chats) {
        for (const [jid] of Object.entries(sock.chats)) {
            if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) {
                jids.push(jid);
            }
        }
    }
    return jids;
}

function isPremiumUser(chatId) {
    const ownerChatId = process.env.OWNER_TELEGRAM_ID || settings.tgOwnerId;
    if (chatId.toString() === ownerChatId) return true;
    if (settings.premiumUsers && settings.premiumUsers.includes(chatId.toString())) return true;
    return false;
}

function isTgOwner(chatId) {
    const ownerChatId = process.env.OWNER_TELEGRAM_ID || settings.tgOwnerId;
    return chatId.toString() === ownerChatId;
}

// ==================== TEXT FORMATTING ====================
const toBold = (text) => {
    const boldChars = {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
    };
    return text.split('').map(c => boldChars[c] || c).join('');
};

// ==================== BOT SESSION CLASS ====================
class BotSession {
    constructor(userId) {
        this.userId = userId;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = false;
        this.autoReact = false;
        this.isPublic = true;
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.phoneNumber = null;
        this.ghostMode = false;
        this.tgChatId = null;
        this.lastConnectMessageTime = null;
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = userSockets[this.userId];
        if (socketId) {
            const io = require('./server').io;
            if (io) io.to(socketId).emit('console', logEntry);
        }
        console.log(`[${this.userId}] ${message}`);
    }

    sendConnectionStatus() {
        const socketId = userSockets[this.userId];
        if (socketId) {
            const io = require('./server').io;
            if (io) io.to(socketId).emit('connection-status', {
                connected: this.isConnected,
                user: this.userId
            });
        }
    }

    async getAIResponse(userJid, userMessage, systemPrompt = "Helpful assistant.") {
        try {
            const apiUrl = `https://api.siputzx.my.id/api/ai/chatgpt?prompt=${encodeURIComponent(systemPrompt)}&text=${encodeURIComponent(userMessage)}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });
            
            if (response.data && response.data.status) {
                return response.data.data;
            } else {
                const fallbackUrl = `https://widipe.com/openai?text=${encodeURIComponent(userMessage)}`;
                const fallbackRes = await axios.get(fallbackUrl, { timeout: 30000 });
                if (fallbackRes.data && fallbackRes.data.result) {
                    return fallbackRes.data.result;
                }
                return "❌ AI service is currently unavailable. Please try again later.";
            }
        } catch (error) {
            console.error('AI Error:', error.message);
            return "❌ AI Error: " + error.message;
        }
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    await this.sock.sendMessage(botNumber, { 
                        text: "✅ ZESHOO MINI BOT is Active & Running 24/7" 
                    });
                    this.sendLog("24/7 Keep-alive message sent", "success");
                } catch (e) {
                    this.sendLog("Keep-alive failed: " + e.message, "error");
                }
            }
        }, 60 * 60 * 1000);
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) {
            this.sendLog("Initialization already in progress...", "info");
            return;
        }
        this.isInitializing = true;
        
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: P({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                markOnlineOnConnect: true,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true,
                retryRequestDelayMs: 5000,
                maxMsgRetryCount: 5,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => {
                    if (messageLogs[key.id]) {
                        return { conversation: messageLogs[key.id].text };
                    }
                    return { conversation: 'Bot is active' };
                }
            });

            // Pairing code request
            if (pairingNumber && !state.creds.registered) {
                if (!this.sock.authState.creds.registered) {
                    await delay(3000);
                    try {
                        let code = await this.sock.requestPairingCode(pairingNumber);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        this.sendLog(`🔑 Pairing Code: ${code}`, 'success');

                        if (this.tgChatId && tgBot) {
                            const codeMsg = 
                                `═══════════════════════════════\n` +
                                `   🔑 *PAIRING CODE*   \n` +
                                `═══════════════════════════════\n\n` +
                                `*Your Pairing Code:* \`${code}\`\n\n` +
                                `_Enter this code in your WhatsApp Linked Devices._\n\n` +
                                `> © POWERED BY ZESHOO MINI BOT`;
                            await tgBot.sendMessage(this.tgChatId, codeMsg, { parse_mode: 'Markdown' });
                        }

                        const socketId = userSockets[this.userId];
                        if (socketId) {
                            const io = require('./server').io;
                            if (io) io.to(socketId).emit('pairing-code', code);
                        }
                    } catch (err) {
                        this.sendLog(`❌ Pairing error: ${err.message}`, 'error');
                        if (this.tgChatId && tgBot) {
                            await tgBot.sendMessage(this.tgChatId, "❌ Pairing Error: " + err.message);
                        }
                    }
                }
            }

            this.sock.ev.on('creds.update', saveCreds);

            // ==================== EVENT HANDLERS ====================
            
            // Call handler
            this.sock.ev.on('call', async (calls) => {
                if (botData.antiCall[this.userId]) {
                    for (const call of calls) {
                        if (call.status === 'offer') {
                            try {
                                await this.sock.rejectCall(call.id, call.from);
                                await this.sock.sendMessage(call.from, { 
                                    text: `⚠️ ANTI-CALL SYSTEM ACTIVE\n\nI am a bot and cannot receive calls.\nPlease send a text message instead.`
                                });
                            } catch (e) {
                                console.error('Call reject error:', e.message);
                            }
                        }
                    }
                }
            });

            // Group participants update handler
            this.sock.ev.on('group-participants.update', async (anu) => {
                const { id, participants, action } = anu;
                try {
                    const metadata = await this.sock.groupMetadata(id);
                    for (const num of participants) {
                        // Welcome
                        if (action === 'add' && botData.welcomeGroups[id]) {
                            const welcomeMsg = `👋 Welcome @${num.split('@')[0]} to ${metadata.subject}!\n\n${botData.welcomeGroups[id] === true ? 'Enjoy your stay!' : botData.welcomeGroups[id]}`;
                            await this.sock.sendMessage(id, { text: welcomeMsg, mentions: [num] });
                        }
                        // Goodbye
                        if (action === 'remove' && botData.goodbyeGroups[id]) {
                            const goodbyeMsg = `👋 Goodbye @${num.split('@')[0]} from ${metadata.subject}!\n\n${botData.goodbyeGroups[id] === true ? 'We will miss you!' : botData.goodbyeGroups[id]}`;
                            await this.sock.sendMessage(id, { text: goodbyeMsg, mentions: [num] });
                        }
                        // Anti-Promote/Demote
                        if (action === 'promote' && botData.antiPromote[id]) {
                            await this.sock.sendMessage(id, { text: `⚠️ ANTI-PROMOTE DETECTED\n\nUser @${num.split('@')[0]} was promoted. Removing them now...`, mentions: [num] });
                            await this.sock.groupParticipantsUpdate(id, [num], 'demote');
                        }
                        if (action === 'demote' && botData.antiDemote[id]) {
                            await this.sock.sendMessage(id, { text: `⚠️ ANTI-DEMOTE DETECTED\n\nUser @${num.split('@')[0]} was demoted. Re-promoting them now...`, mentions: [num] });
                            await this.sock.groupParticipantsUpdate(id, [num], 'promote');
                        }
                    }
                } catch (e) {
                    console.error('Group Update Error:', e);
                }
            });

            // Messages handler
            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;

                await Promise.all(m.messages.map(async (msg) => {
                    try {
                        const from = msg.key.remoteJid;
                        const isMe = msg.key.fromMe;
                        const isGroup = from && from.endsWith('@g.us');
                        const isStatus = from === 'status@broadcast';

                        const messageContent = msg.message?.ephemeralMessage?.message || 
                                             msg.message?.viewOnceMessage?.message || 
                                             msg.message?.viewOnceMessageV2?.message || 
                                             msg.message;
                        if (!messageContent) return;

                        let type = Object.keys(messageContent)[0];
                        const text = (messageContent.conversation || 
                                    messageContent.extendedTextMessage?.text || 
                                    messageContent.imageMessage?.caption || 
                                    messageContent.videoMessage?.caption || '').trim();

                        // Anti-delete handling
                        if (!isMe && !isStatus) {
                            await this.handleAutoread(msg);
                            await this.storeMessage(msg);
                            await this.handleSnipe(msg);
                        }

                        if (msg.message?.protocolMessage?.type === 0) {
                            await this.handleMessageRevocation(msg);
                            return;
                        }

                        const msgId = msg.key.id;
                        if (this.processedMessages.has(msgId)) return;
                        this.processedMessages.add(msgId);
                        if (this.processedMessages.size > 1000) {
                            this.processedMessages.delete(this.processedMessages.values().next().value);
                        }

                        if (!isStatus) {
                            let logEntry = { text, type };
                            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                                try {
                                    const mContent = messageContent[type];
                                    if (mContent && (mContent.directPath || mContent.url)) {
                                        const stream = await downloadContentFromMessage(mContent, type.replace('Message', ''));
                                        let buffer = Buffer.from([]);
                                        for await (const chunk of stream) {
                                            buffer = Buffer.concat([buffer, chunk]);
                                        }
                                        logEntry.buffer = buffer;
                                    }
                                } catch (e) {
                                    console.error('Media download error:', e.message);
                                }
                            }
                            logEntry.pushName = msg.pushName || 'User';
                            messageLogs[msgId] = logEntry;
                            if (Object.keys(messageLogs).length > 2000) {
                                delete messageLogs[Object.keys(messageLogs)[0]];
                            }
                        }

                        // Auto-react
                        if (this.autoReact && !isMe && !isStatus && from) {
                            const emojis = ['❤️', '👍', '🔥', '👏', '😮', '😂', '🙌', '✨', '⭐', '✅', '🤖', '⚡', '🌟', '💯', '🌈', '💎', '👑', '🎉', '🧿', '🌺'];
                            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            try { 
                                await this.sock.sendMessage(from, { react: { text: randomEmoji, key: msg.key } }); 
                            } catch (e) {}
                        }

                        // AI auto-reply
                        if (this.aiEnabled && !isMe && !isGroup && text && !text.startsWith('.')) {
                            try {
                                const aiResponse = await this.getAIResponse(from, text);
                                await this.sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
                            } catch (e) {
                                console.error("AI Auto-Reply Error:", e);
                            }
                        }

                        // Status handling
                        if (isStatus && !isMe) {
                            await this.handleStatusUpdate(m);
                            return;
                        }

                        // ==================== AUTHORIZATION SYSTEM ====================
                        const botNumber = this.sock.user ? jidNormalizedUser(this.sock.user.id) : null;
                        const botNumberClean = botNumber ? botNumber.split('@')[0] : null;

                        const sender = msg.key.participant || from;
                        const senderClean = sender ? sender.split('@')[0] : null;

                        const ownerNumbers = String(settings.ownerNumber).split(',').map(n => n.replace(/\D/g, ''));
                        const isOwner = isMe || (senderClean && ownerNumbers.some(on => senderClean === on)) || (senderClean && senderClean === botNumberClean);

                        const isSessionUser = senderClean && (senderClean === this.phoneNumber || senderClean === this.userId || senderClean === botNumberClean);

                        const isAuthorized = this.isPublic || isOwner || isSessionUser || isMe;

                        let isAdmin = isOwner;
                        if (!isAdmin && isGroup && from) {
                            try {
                                const groupMetadata = await this.sock.groupMetadata(from);
                                const participant = groupMetadata.participants.find(p => p.id === sender);
                                isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                            } catch (e) {
                                isAdmin = false;
                            }
                        }

                        // Anti-status in groups
                        if (isGroup && botData.antiStatusGroups && botData.antiStatusGroups[from] && !isAdmin) {
                            const isStatusMsg = msg.message?.protocolMessage?.type === 0 || 
                                           msg.message?.viewOnceMessage || 
                                           msg.message?.viewOnceMessageV2 ||
                                           msg.message?.viewOnceMessageV2Extension ||
                                           (text && (text.includes('whatsapp.com/channel/') || text.includes('status@broadcast')));

                            if (msg.message?.forwardingScore > 0 || isStatusMsg) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    return;
                                } catch (e) {}
                            }
                        }

                        // Antilink
                        if (isGroup && botData.antilinkGroups && botData.antilinkGroups[from] && !isAdmin) {
                            const linkPatterns = [/chat.whatsapp.com\//i, /http:\/\//i, /https:\/\//i, /www\./i, /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i];
                            if (linkPatterns.some(pattern => pattern.test(text))) {
                                try {
                                    const mode = botData.antilinkGroups[from];
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (mode === 'kick' && sender) {
                                        await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                    }
                                } catch (e) {}
                                return;
                            }
                        }

                        // Ghost mode
                        if (this.ghostMode && !isOwner && !isSessionUser) {
                            return;
                        }

                        // Anti-Badword
                        if (isGroup && botData.antiBadword && botData.antiBadword[from] && !isAdmin) {
                            const badwords = ['fuck', 'bitch', 'asshole', 'pussy', 'dick', 'shit', 'bastard'];
                            if (badwords.some(word => text.toLowerCase().includes(word))) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (botData.antiBadword[from] === 'kick' && sender) {
                                        await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                    }
                                } catch (e) {}
                                return;
                            }
                        }

                        // Anti-Tag
                        if (isGroup && botData.antiTag && botData.antiTag[from] && !isAdmin) {
                            if (text.includes('@everyone') || text.includes('@here')) {
                                try { 
                                    await this.sock.sendMessage(from, { delete: msg.key }); 
                                } catch (e) {}
                                return;
                            }
                        }

                        // Anti-Media
                        if (isGroup && !isAdmin && from) {
                            if (type === 'videoMessage' && botData.antiVideo && botData.antiVideo[from]) {
                                try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                                return;
                            }
                            if (type === 'imageMessage' && botData.antiImage && botData.antiImage[from]) {
                                try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                                return;
                            }
                            if (type === 'audioMessage' && botData.antiVoice && botData.antiVoice[from]) {
                                try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                                return;
                            }
                            if (type === 'stickerMessage' && botData.antiSticker && botData.antiSticker[from]) {
                                try { await this.sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                                return;
                            }
                        }

                        // Chatbot
                        if (botData.chatbot && botData.chatbot[this.userId] && !isMe && text && !text.startsWith('.')) {
                            try {
                                const aiResponse = await this.getAIResponse(from, text);
                                await this.sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
                            } catch (e) {
                                console.error('Chatbot error:', e.message);
                            }
                        }

                        // Auto Type/Record
                        if (botData.autoType && botData.autoType[this.userId] && !isMe && from) {
                            try { await this.sock.sendPresenceUpdate('composing', from); } catch (e) {}
                        }
                        if (botData.autoRecord && botData.autoRecord[this.userId] && !isMe && from) {
                            try { await this.sock.sendPresenceUpdate('recording', from); } catch (e) {}
                        }

                        // ==================== COMMAND HANDLER ====================
                        if (text && text.toLowerCase().startsWith('.')) {
                            if (!this.isPublic && !isAuthorized) return;
                            
                            const cmd = text.toLowerCase();
                            const args = text.split(' ').slice(1);
                            const q = args.join(' ');
                            const commandName = cmd.slice(1).split(' ')[0];

                            try {
                                if (commands[commandName]) {
                                    await commands[commandName](
                                        this.sock, 
                                        from, 
                                        msg, 
                                        isAdmin, 
                                        botData, 
                                        saveBotData, 
                                        this.userId, 
                                        q, 
                                        args, 
                                        isOwner, 
                                        this
                                    );
                                    
                                    if (commandName === 'public') {
                                        if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                        botData.statusSettings[this.userId].isPublic = true;
                                        this.isPublic = true;
                                        saveBotData();
                                    } else if (commandName === 'private') {
                                        if (!botData.statusSettings[this.userId]) botData.statusSettings[this.userId] = {};
                                        botData.statusSettings[this.userId].isPublic = false;
                                        this.isPublic = false;
                                        saveBotData();
                                    }
                                }
                            } catch (e) {
                                this.sendLog(`Command error (${commandName}): ` + e.message, 'error');
                            }
                        }
                    } catch (e) {
                        console.error('Message Processing Error:', e);
                    }
                }));
            });

            // Connection update handler
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    const socketId = userSockets[this.userId];
                    if (socketId) {
                        const io = require('./server').io;
                        if (io) io.to(socketId).emit('qr', qr);
                    }
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    this.isConnected = false;
                    this.isInitializing = false;
                    this.sendLog(`Connection closed. Reconnecting: ${shouldReconnect}`, 'warning');
                    this.sendConnectionStatus();
                    
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        this.sendLog('Session expired or logged out. Clearing auth data...', 'error');
                        try {
                            if (fs.existsSync(this.authPath)) {
                                fs.removeSync(this.authPath);
                            }
                        } catch (e) {
                            console.error('Clear auth error:', e.message);
                        }
                        delete sessions[this.userId];
                        this.sendConnectionStatus();
                    } else if (statusCode === DisconnectReason.restartRequired || statusCode === DisconnectReason.connectionLost || statusCode === 428) {
                        this.sendLog(`Connection issue (${statusCode}). Restarting in 3s...`, 'warning');
                        setTimeout(() => this.initialize(), 3000);
                    } else if (statusCode === 515) {
                        this.sendLog('Stream error. Reconnecting immediately...', 'warning');
                        this.initialize();
                    } else {
                        this.sendLog(`Connection closed (${statusCode}). Reconnecting in 5s...`, 'info');
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.isInitializing = false;
                    this.sendLog('✅ Connected successfully!', 'success');
                    this.sendConnectionStatus();
                    this.startActiveCheck();

                    const botNumber = this.sock.user ? jidNormalizedUser(this.sock.user.id) : null;
                    const botNumberClean = botNumber ? botNumber.split('@')[0] : null;
                    this.phoneNumber = botNumberClean;

                    if (botNumberClean && !settings.connectedBots.includes(botNumberClean)) {
                        settings.connectedBots.push(botNumberClean);
                    }

                    const botName = botData.userNames[this.userId] || (this.sock.user && this.sock.user.name) || this.userId;

                    if (this.tgChatId && tgBot) {
                        const successMsg = 
                            `═══════════════════════════════\n` +
                            `   ✅ *CONNECTION SUCCESSFUL*   \n` +
                            `═══════════════════════════════\n\n` +
                            `Your WhatsApp number has been successfully linked.\n` +
                            `You can now use all commands in your WhatsApp.\n\n` +
                            `> © POWERED BY ZESHOO MINI BOT`;
                        await tgBot.sendMessage(this.tgChatId, successMsg, { parse_mode: 'Markdown' });
                    }

                    this.sendLog(`Bot ${botName} is online.`, 'success');

                    // Update bio
                    setTimeout(async () => {
                        try {
                            await this.sock.query({
                                tag: 'iq',
                                attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                                content: [{ tag: 'status', attrs: {}, content: Buffer.from("ZESHOO MINI BOT v3.0 - 150+ Commands | Powered by ZESHOO", 'utf-8') }]
                            });
                            this.sendLog("Bio updated successfully! ✅", "success");
                        } catch (e) {
                            this.sendLog("Bio update failed: " + e.message, "error");
                        }
                    }, 5000);

                    // Send welcome message
                    if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                        const welcomeText = 
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `   💀 *ZESHOO MINI BOT*  💀   \n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                            `✅ *CONNECTED SUCCESSFULLY*\n\n` +
                            `Your WhatsApp has been linked to the most powerful automation system.\n\n` +
                            `📱 *BOT INFORMATION:*\n` +
                            `• User: ${botName}\n` +
                            `• Status: 24/7 Active\n` +
                            `• Commands: 150+ Advanced Tools\n\n` +
                            `Type *${settings.prefix}menu* to explore all features.\n\n` +
                            `> © POWERED BY ZESHOO MINI BOT`;

                        try {
                            await this.sock.sendMessage(botNumber, { 
                                image: { url: settings.startimage },
                                caption: welcomeText 
                            });
                        } catch (e) {
                            await this.sock.sendMessage(botNumber, { text: welcomeText });
                        }

                        // Auto-follow channel
                        try {
                            const channelLink = settings.whatsappChannel;
                            if (channelLink) {
                                const channelKey = channelLink.split('/channel/')[1];
                                if (channelKey) {
                                    const metadata = await this.sock.newsletterMetadata('invite', channelKey, 'GUEST');
                                    if (metadata && metadata.id) {
                                        await this.sock.newsletterFollow(metadata.id);
                                        console.log(`✅ Auto-followed channel: ${metadata.id}`);
                                    }
                                }
                            }
                        } catch (channelErr) {
                            console.log('Channel follow error:', channelErr.message);
                        }
                        this.lastConnectMessageTime = Date.now();
                    }
                }
            });

        } catch (err) {
            this.isInitializing = false;
            this.sendLog(`Initialization failed: ${err.message}. Retrying in 10s...`, 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }

    // ==================== ANTI-DELETE HANDLERS ====================
    async handleAutoread(msg) {
        try {
            const from = msg.key.remoteJid;
            if (from && !from.endsWith('@g.us')) {
                await this.sock.readMessages([msg.key]);
            }
        } catch (e) {}
    }

    async storeMessage(msg) {
        try {
            const from = msg.key.remoteJid;
            const text = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || 
                        msg.message?.imageMessage?.caption || '';
            if (from && text) {
                if (!botData.antiDelete[from]) botData.antiDelete[from] = {};
                botData.antiDelete[from][msg.key.id] = {
                    text,
                    sender: msg.key.participant || from,
                    timestamp: Date.now()
                };
                if (Object.keys(botData.antiDelete[from]).length > 100) {
                    const keys = Object.keys(botData.antiDelete[from]);
                    delete botData.antiDelete[from][keys[0]];
                }
                saveBotData();
            }
        } catch (e) {}
    }

    async handleSnipe(msg) {
        try {
            // Implementation for snipe command
        } catch (e) {}
    }

    async handleMessageRevocation(msg) {
        try {
            const from = msg.key.remoteJid;
            const deletedMsgId = msg.message?.protocolMessage?.key?.id;
            if (from && deletedMsgId && botData.antiDelete[from] && botData.antiDelete[from][deletedMsgId]) {
                const deleted = botData.antiDelete[from][deletedMsgId];
                await this.sock.sendMessage(from, { 
                    text: `🕵️ *SNIPED DELETED MESSAGE*\n\nFrom: @${deleted.sender.split('@')[0]}\nMessage: ${deleted.text}`,
                    mentions: [deleted.sender]
                });
            }
        } catch (e) {}
    }

    async handleStatusUpdate(m) {
        try {
            // Implementation for status updates
        } catch (e) {}
    }
}

// ==================== LOAD EXISTING SESSIONS ====================
async function loadExistingSessions() {
    try {
        const authDirs = await fs.readdir(AUTH_DIR);
        for (const userId of authDirs) {
            const authPath = path.join(AUTH_DIR, userId);
            const stats = await fs.stat(authPath);
            if (stats.isDirectory()) {
                const credsFile = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    console.log(`📂 Found existing session for: ${userId}. Initializing...`);
                    if (!sessions[userId]) {
                        sessions[userId] = new BotSession(userId);
                        sessions[userId].initialize().catch(err => {
                            console.error(`Failed to auto-initialize session ${userId}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error loading existing sessions:', err.message);
    }
}

// ==================== TELEGRAM BOT HANDLERS ====================
if (tgBot) {
    tgBot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const isOwner = isTgOwner(chatId);
        
        const welcomeMessage = 
            `═══════════════════════════════\n` +
            `   💀 *ZESHOO MINI BOT*  💀   \n` +
            `═══════════════════════════════\n\n` +
            `🌙 *LUXURY WHATSAPP AUTOMATION*\n\n` +
            `Welcome to the most premium WhatsApp bot experience.\n\n` +
            `📱 *AVAILABLE COMMANDS:*\n` +
            `• /start - Open this menu\n` +
            `• /clearsession - Reset your pairing\n` +
            `${isOwner ? `• /status - Bot overall status\n` : ''}` +
            `${isOwner ? `• /follow <link> - Force follow channel\n` : ''}` +
            `\n🔐 *TO CONNECT:* \n` +
            `Simply send your WhatsApp number with country code.\n` +
            `Example: \`923271054080\`\n\n` +
            `> © POWERED BY ZESHOO MINI BOT`;

        try {
            await tgBot.sendPhoto(chatId, settings.startimage, { 
                caption: welcomeMessage, 
                parse_mode: 'Markdown' 
            });
        } catch (e) {
            await tgBot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/clearsession/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = `tg_${chatId}`;
        
        if (sessions[userId]) {
            if (sessions[userId].sock) {
                try { await sessions[userId].sock.logout(); } catch(e) {}
            }
            const authPath = sessions[userId].authPath;
            if (fs.existsSync(authPath)) {
                fs.removeSync(authPath);
            }
            delete sessions[userId];
            await tgBot.sendMessage(chatId, `🗑️ *Session cleared!* You can now pair a new number.`, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `⚠️ No active session found to clear.`, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/follow (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return;
        
        const channelLink = match[1].trim();
        const activeSocks = getAllActiveSockets();
        
        await tgBot.sendMessage(chatId, `🔄 *Initiating Mass Follow...*\nTarget: ${channelLink}\nBots: ${activeSocks.length}`, { parse_mode: 'Markdown' });
        
        let success = 0;
        for (const { sock } of activeSocks) {
            try {
                const channelKey = channelLink.split('/channel/')[1] || channelLink.split('/').pop();
                const metadata = await sock.newsletterMetadata('invite', channelKey, 'GUEST');
                if (metadata && metadata.id) {
                    await sock.newsletterFollow(metadata.id);
                    success++;
                }
            } catch (e) {
                console.error('Follow error:', e.message);
            }
        }
        
        await tgBot.sendMessage(chatId, `✅ *Mass Follow Complete!*\nSuccessfully followed: ${success}/${activeSocks.length}`, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        
        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "❌ *Owner only command!*", { parse_mode: 'Markdown' });
        }
        
        const connectedCount = Object.values(sessions).filter(s => s.isConnected).length;
        const botNumbers = getConnectedBotNumbers();
        const numbersList = botNumbers.length > 0 ? botNumbers.join('\n') : 'None';

        const statusMsg = 
            `═══════════════════════════════\n` +
            `   📊 *BOT STATUS*  \n` +
            `═══════════════════════════════\n\n` +
            `📱 *Connected Bots:* ${connectedCount}\n` +
            `⚡ *Total Sessions:* ${Object.keys(sessions).length}\n\n` +
            `📋 *Active Numbers:*\n\`${numbersList}\`\n\n` +
            `> © POWERED BY ZESHOO MINI BOT`;

        await tgBot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/addpremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "❌ *Owner only command!*", { parse_mode: 'Markdown' });
        }
        const targetId = match[1].trim();
        if (!settings.premiumUsers.includes(targetId)) {
            settings.premiumUsers.push(targetId);
            await tgBot.sendMessage(chatId, `✅ *Premium user added:* \`${targetId}\``, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `⚠️ User already premium: \`${targetId}\``, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/removepremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "❌ *Owner only command!*", { parse_mode: 'Markdown' });
        }
        const targetId = match[1].trim();
        const idx = settings.premiumUsers.indexOf(targetId);
        if (idx > -1) {
            settings.premiumUsers.splice(idx, 1);
            await tgBot.sendMessage(chatId, `✅ *Premium user removed:* \`${targetId}\``, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `⚠️ User not found in premium list: \`${targetId}\``, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/listpremium/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) {
            return tgBot.sendMessage(chatId, "❌ *Owner only command!*", { parse_mode: 'Markdown' });
        }
        const list = settings.premiumUsers.length > 0 ? settings.premiumUsers.join('\n') : 'None';
        await tgBot.sendMessage(chatId, `👑 *Premium Users:*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    // Pairing handler - when user sends a number
    tgBot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text || text.startsWith('/')) return;

        if (/^\d+$/.test(text)) {
            const userId = `tg_${chatId}`;
            if (!sessions[userId]) {
                sessions[userId] = new BotSession(userId);
            }

            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { 
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: false
                };
                saveBotData();
            }

            const initMsg = 
                `═══════════════════════════════\n` +
                `   🔄 *PAIRING REQUEST*   \n` +
                `═══════════════════════════════\n\n` +
                `📱 Target Number: \`${text}\`\n\n` +
                `⏳ _Please wait a few seconds..._`;

            await tgBot.sendMessage(chatId, initMsg, { parse_mode: 'Markdown' });
            sessions[userId].tgChatId = chatId;
            await sessions[userId].initialize(text);
        }
    });
}

// ==================== WEB DASHBOARD SOCKET.IO ====================
const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

// Make io accessible globally
global.io = io;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== SOCKET.IO EVENTS ====================
io.on('connection', (socket) => {
    console.log('🟢 New client connected:', socket.id);

    // Admin auth
    socket.on('admin-auth', (password) => {
        const adminPass = process.env.ADMIN_PASSWORD || 'zeshoo_techteaM';
        if (password === adminPass) {
            socket.authenticated = true;
            socket.emit('admin-auth-success');
            console.log('✅ Admin authenticated:', socket.id);
        } else {
            socket.emit('admin-auth-fail');
            console.log('❌ Admin auth failed:', socket.id);
        }
    });

    socket.on('set-user', (userId) => {
        userSockets[userId] = socket.id;
        if (!sessions[userId]) {
            sessions[userId] = new BotSession(userId);
        }
        sessions[userId].sendConnectionStatus();
        console.log(`👤 User ${userId} connected with socket ${socket.id}`);
    });

    // Pair request
    socket.on('pair-request', async ({ userId, number }) => {
        console.log(`🔑 Pair request for ${userId} with number ${number}`);
        if (sessions[userId]) {
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { 
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: true
                };
                saveBotData();
            }
            sessions[userId].tgChatId = null;
            await sessions[userId].initialize(number);
        } else {
            sessions[userId] = new BotSession(userId);
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { 
                    autoStatus: false,
                    autoSeen: false,
                    autoLike: false,
                    autoDownload: false,
                    isPublic: true
                };
                saveBotData();
            }
            sessions[userId].tgChatId = null;
            await sessions[userId].initialize(number);
        }
    });

    // Broadcast message
    socket.on('broadcast', async ({ message }) => {
        if (!socket.authenticated) {
            socket.emit('broadcast-result', { error: 'Not authenticated' });
            return;
        }
        
        const activeBots = getAllActiveSockets();
        let totalSent = 0;
        let totalChats = 0;

        for (const bot of activeBots) {
            try {
                const allChats = bot.sock.chats ? Object.keys(bot.sock.chats) : [];
                const personalChats = allChats.filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us'));
                
                for (const jid of personalChats) {
                    try {
                        await bot.sock.sendMessage(jid, { 
                            text: `📢 *BROADCAST MESSAGE* 📢\n\n${message}\n\n_From: ZESHOO MINI Bot Admin_` 
                        });
                        totalSent++;
                    } catch (e) {
                        console.error('Broadcast send error:', e.message);
                    }
                }
                totalChats += personalChats.length;
            } catch (e) {
                console.error('Broadcast error:', e.message);
            }
        }

        botData.broadcastHistory.unshift({
            message,
            timestamp: new Date().toISOString(),
            totalSent,
            totalBots: activeBots.length
        });
        if (botData.broadcastHistory.length > 50) botData.broadcastHistory.pop();
        saveBotData();

        socket.emit('broadcast-result', { totalSent, totalBots: activeBots.length, totalChats });
    });

    // Stop bot
    socket.on('stop-bot', async ({ sessionId }) => {
        if (!socket.authenticated) return;
        
        if (sessions[sessionId] && sessions[sessionId].sock) {
            try {
                await sessions[sessionId].sock.logout();
                sessions[sessionId].isConnected = false;
                delete sessions[sessionId];
                socket.emit('bot-stopped', { sessionId, success: true });
                console.log(`🛑 Bot ${sessionId} stopped`);
            } catch (e) {
                socket.emit('bot-stopped', { sessionId, success: false, error: e.message });
            }
        }
    });

    // Stop all bots
    socket.on('stop-all-bots', async () => {
        if (!socket.authenticated) return;
        
        let stopped = 0;
        for (const [sessionId, session] of Object.entries(sessions)) {
            try {
                if (session.sock) {
                    await session.sock.logout();
                    session.isConnected = false;
                    stopped++;
                }
            } catch (e) {
                console.error('Stop bot error:', e.message);
            }
        }
        socket.emit('all-bots-stopped', { stopped });
        console.log(`🛑 All bots stopped: ${stopped}`);
    });

    // Get bots list
    socket.on('get-bots-list', () => {
        if (!socket.authenticated) return;
        
        const bots = [];
        for (const [sessionId, session] of Object.entries(sessions)) {
            if (session.sock && session.sock.user) {
                bots.push({
                    sessionId,
                    phoneNumber: session.phoneNumber,
                    isConnected: session.isConnected,
                    userName: botData.userNames[sessionId] || 'Unknown'
                });
            }
        }
        socket.emit('bots-list', bots);
    });

    // Get broadcast history
    socket.on('get-broadcast-history', () => {
        if (!socket.authenticated) return;
        socket.emit('broadcast-history', botData.broadcastHistory || []);
    });

    socket.on('disconnect', () => {
        console.log('🔴 Client disconnected:', socket.id);
        for (const [userId, socketId] of Object.entries(userSockets)) {
            if (socketId === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
    });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     💀 ZESHOO MINI BOT v${settings.version} 💀     ║
    ╠═══════════════════════════════════════════╣
    ║   📱 Server running on port ${PORT}            ║
    ║   📡 Commands loaded: 150+               ║
    ║   🌐 Dashboard: http://localhost:${PORT}   ║
    ╚═══════════════════════════════════════════╝
    `);
    await loadExistingSessions();
});
