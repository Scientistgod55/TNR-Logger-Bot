const { Client, GatewayIntentBits } = require('discord.js');
// Import Express to create the web server for 24/7 hosting
const express = require('express');

// The DISCORD_TOKEN will be read from Replit's Secret Environment Variables
const token = process.env.DISCORD_TOKEN; 
// We still use config.json for settings like prefix and logChannelID
const { logChannelID, prefix } = require('./config.json'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent 
    ]
});

// Predefined list of valid event names
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

// --- Function to Keep the Bot Alive (for Replit) ---
const app = express();
const port = 3000; 

function keepAlive() {
  // Create a simple endpoint that UptimeRobot will ping
  app.get('/', (req, res) => {
    res.send('Bot is Running!');
  });

  app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
  });
}
// ----------------------------------------------------


client.once('clientReady', () => { 
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('Logging events');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const commandName = 'log';
    const fullCommand = prefix + commandName;

    if (!message.content.toLowerCase().startsWith(fullCommand)) return;

    // --- RANK-LOCKING CHECK ---
    const hasPermission = message.member.roles.cache.some(role => role.name === REQUIRED_ROLE);
    
    if (!hasPermission) {
        return message.reply(`❌ You need the **${REQUIRED_ROLE}** role to use this command.`);
    }

    // --- 1. Argument Parsing ---
    
    const commandLength = fullCommand.length;
    const rawArgs = message.content.slice(commandLength).trim();
    
    const args = rawArgs.split(/\s+/);
    const eventName = args.shift();

    // 2. Event validation
    if (!EVENTS.includes(eventName)) {
        return message.channel.send(`Invalid event: **${eventName}**. Valid events: \`\`\`${EVENTS.join(', ')}\`\`\``);
    }

    // --- 3. Robust Attendee Parsing (Uses Mentions and Regex) ---
    const attendees = [];
    const mentionedMembers = message.mentions.members; 

    if (mentionedMembers.size === 0) {
        return message.channel.send('Please mention at least one attendee with their EP (e.g., @player 3 EP).');
    }

    mentionedMembers.forEach(member => {
        // Regex looks for: [mention] [space] [NUMBER] [space] EP (case-insensitive)
        const regex = new RegExp(`${member.toString()}\\s*(\\d+)\\s*EP`, 'i');
        const match = message.content.match(regex);

        if (match) {
            const epNumber = match[1];
            // Format for the log: @(player) (Amount of EP)
            attendees.push(`${member.toString()} ${epNumber} EP`); 
        }
    });

    if (attendees.length === 0) {
        return message.channel.send('Could not find EP values for any mentioned user. The format must be: `@user # EP`');
    }

    // --- 4. Generate and Send Log Message ---

    const today = new Date();
    const date = `${today.toLocaleString('default', { month: 'short' })} ${today.getDate()}, ${today.getFullYear()}`;

    // Build log message (Single-line attendee list separated by " | ")
    const logMessage = `**Type:** ${eventName}
**Host:** ${message.author.toString()} 
**Date:** ${date}

**Attendees:** ${attendees.join(' | ')}`; 

    // Send to log channel
    let targetChannel;
    try {
        if (logChannelID) {
            targetChannel = await client.channels.fetch(logChannelID);
        } else {
            targetChannel = message.channel;
        }

        if (targetChannel && targetChannel.send) {
            await targetChannel.send({ content: logMessage });
            
            await message.channel.send(`✅ Successfully logged **${eventName}** with **${attendees.length}** attendees to <#${targetChannel.id}>.`);
        } else {
             await message.channel.send('❌ Error: The configured log channel ID is invalid or I lack permissions to send messages there.');
        }
    } catch (error) {
        console.error("Error fetching or sending to log channel:", error);
        return message.channel.send('❌ An unexpected error occurred while trying to log the event.');
    }
});

// 5. Start the Keep Alive server and then login the client
keepAlive(); 
client.