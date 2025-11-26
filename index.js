const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const { token, logChannelID, prefix } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- EP STORAGE ---
const EP_FILE = './epData.json';
let epData = {};

// Load EP data
if (fs.existsSync(EP_FILE)) {
    try {
        epData = JSON.parse(fs.readFileSync(EP_FILE, 'utf8'));
    } catch (err) {
        console.error('Error reading EP file:', err);
        epData = {};
    }
}

function saveEP() {
    fs.writeFileSync(EP_FILE, JSON.stringify(epData, null, 2));
}

// --- LOGGING COMMAND (UNCHANGED) ---
const EVENTS = [
    "Spar",
    "Small Patrol",
    "Patrol",
    "CT",
    "DT",
    "GT",
    "TDM",
    "Citadel Challenge",
    "Gamenight"
];

const REQUIRED_ROLE = 'Event Permission';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('Logging events');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- LOG COMMAND ---
    const fullLogCommand = prefix + 'log';
    if (message.content.toLowerCase().startsWith(fullLogCommand)) {
        const hasPermission = message.member.roles.cache.some(role => role.name === REQUIRED_ROLE);
        if (!hasPermission) return message.reply(`❌ You need the **${REQUIRED_ROLE}** role to use this command.`);

        const rawArgs = message.content.slice(fullLogCommand.length).trim();
        const args = rawArgs.split(/\s+/);
        const eventName = args.shift();

        if (!EVENTS.includes(eventName)) {
            return message.channel.send(`Invalid event: **${eventName}**. Valid events: \`${EVENTS.join(', ')}\``);
        }

        const attendees = [];
        const mentionedMembers = message.mentions.members;

        if (mentionedMembers.size === 0) {
            return message.channel.send('Please mention at least one attendee with their EP (e.g., @player 3 EP).');
        }

        mentionedMembers.forEach(member => {
            const regex = new RegExp(`${member.toString()}\\s*(\\d+)\\s*EP`, 'i');
            const match = message.content.match(regex);
            if (match) {
                const epNumber = parseFloat(match[1]);
                attendees.push(`${member.toString()} ${epNumber} EP`);

                // --- ADD EP ---
                if (!epData[member.id]) epData[member.id] = 0;
                epData[member.id] += epNumber;
            }
        });

        saveEP();

        if (attendees.length === 0) {
            return message.channel.send('Could not find EP values for any mentioned user. The format must be: @user # EP');
        }

        const today = new Date();
        const date = `${today.toLocaleString('default', { month: 'short' })} ${today.getDate()}, ${today.getFullYear()}`;

        const logMessage = `**Type:** ${eventName}
**Host:** ${message.author.toString()} 
**Date:** ${date}

**Attendees:** ${attendees.join(' | ')}`;

        let targetChannel;
        try {
            if (logChannelID) targetChannel = await client.channels.fetch(logChannelID);
            else targetChannel = message.channel;

            if (targetChannel && targetChannel.send) {
                await targetChannel.send({ content: logMessage });
                await message.channel.send(`✅ Successfully logged **${eventName}** with **${attendees.length}** attendees to <#${targetChannel.id}>.`);
            } else {
                await message.channel.send('❌ Error: The configured log channel ID is invalid or I lack permissions to send messages there.');
            }
        } catch (error) {
            console.error("Error sending log:", error);
            return message.channel.send('❌ An unexpected error occurred while trying to log the event.');
        }
        return; // done processing !log
    }

    // --- EP COMMAND ---
    if (message.content.toLowerCase().startsWith(prefix + 'ep')) {
        const verifiedRole = 'Verified';
        if (!message.member.roles.cache.some(role => role.name === verifiedRole)) {
            return message.reply(`❌ You need the **${verifiedRole}** role to use this command.`);
        }

        const mentioned = message.mentions.members.first();
        if (!mentioned) return message.reply('Please mention a player to check EP.');

        const ep = epData[mentioned.id] || 0;
        return message.reply(`${mentioned.user.username} has ${ep} EP.`);
    }

    // --- EDIT EP COMMAND ---
    if (message.content.toLowerCase().startsWith(prefix + 'edit ep')) {
        const editRole = 'EP Edit Permission';
        if (!message.member.roles.cache.some(role => role.name === editRole)) {
            return message.reply(`❌ You need the **${editRole}** role to use this command.`);
        }

        const mentioned = message.mentions.members.first();
        if (!mentioned) return message.reply('Please mention a player to edit EP.');

        const args = message.content.split(/\s+/).slice(3); // after !edit ep @player
        const newEP = parseFloat(args[0]);
        if (isNaN(newEP)) return message.reply('Please provide a valid number for EP.');

        epData[mentioned.id] = newEP;
        saveEP();
        return message.reply(`✅ Successfully set ${mentioned.user.username}'s EP to ${newEP}.`);
    }
});

client.login(token);
