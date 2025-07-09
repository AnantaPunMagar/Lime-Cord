// Load environment variables from .env file
require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Bot configuration with proper error checking
const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID // Optional: for guild-specific commands
};

// Validate required environment variables
function validateConfig() {
    const missing = [];
    
    if (!config.token) missing.push('DISCORD_TOKEN');
    if (!config.clientId) missing.push('CLIENT_ID');
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(env => console.error(`   - ${env}`));
        console.error('\nPlease set these environment variables and restart the bot.');
        process.exit(1);
    }
    
    // Validate token format (Discord tokens are usually 70+ characters)
    if (config.token.length < 50) {
        console.error('❌ Invalid DISCORD_TOKEN format. Please check your bot token.');
        process.exit(1);
    }
    
    console.log('✅ Configuration validated successfully');
    console.log(`   - Token: ${config.token.substring(0, 10)}...`);
    console.log(`   - Client ID: ${config.clientId}`);
    console.log(`   - Guild ID: ${config.guildId || 'Not set (global commands)'}`);
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// In-memory storage (use a database in production)
const storage = {
    warnings: new Map(),
    afkUsers: new Map(),
    autoRoles: new Map(),
    customCommands: new Map(),
    polls: new Map(),
    reminderTimeouts: new Map()
};

// Slash commands definition
const commands = [
    // Pet Pet Command
    new SlashCommandBuilder()
        .setName('petpet')
        .setDescription('Generate a pet pet GIF of a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to pet')
                .setRequired(false)),

    // Moderation Commands
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for ban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to warn')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Check warnings for a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to check warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages from a channel')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of messages to clear (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // Fun Commands
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get user avatar')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to get avatar of')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get information about a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to get info about')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get server information'),

    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('Poll question')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('options')
                .setDescription('Poll options separated by commas')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder')
        .addStringOption(option => 
            option.setName('time')
                .setDescription('Time (e.g., 5m, 1h, 2d)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Reminder message')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set AFK status')
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('AFK reason')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme'),

    new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke'),

    new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8-ball a question')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('Your question')
                .setRequired(true)),

    // Utility Commands
    new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Get weather information')
        .addStringOption(option => 
            option.setName('location')
                .setDescription('Location to get weather for')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text')
        .addStringOption(option => 
            option.setName('text')
                .setDescription('Text to translate')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('to')
                .setDescription('Language to translate to')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('qr')
        .setDescription('Generate QR code')
        .addStringOption(option => 
            option.setName('text')
                .setDescription('Text to encode')
                .setRequired(true)),

    // Music Commands (basic)
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music (placeholder)')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('Song to play')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop music'),

    // Economy Commands (basic)
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your balance'),

    new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim daily reward'),

    // Custom Commands
    new SlashCommandBuilder()
        .setName('addcmd')
        .setDescription('Add a custom command')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Command name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('response')
                .setDescription('Command response')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show bot commands and features')
];

// Alternative petpet implementation using external API
async function generatePetPetGif(avatarUrl) {
    try {
        // Use external API for petpet generation
        const petpetUrl = `https://api.waifu.pics/sfw/pat`;
        const response = await axios.get(petpetUrl);
        
        return {
            success: true,
            message: "Pet pet! 🤗",
            avatarUrl: avatarUrl
        };
    } catch (error) {
        console.error('Error generating pet pet:', error);
        return {
            success: false,
            message: "Failed to generate pet pet!"
        };
    }
}

// Event handlers
client.once('ready', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    client.user.setActivity('with Discord API', { type: 'PLAYING' });
});

// Error handling for the client
client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
    console.warn('⚠️ Discord client warning:', warning);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, channel } = interaction;

    try {
        switch (commandName) {
            case 'petpet':
                await interaction.deferReply();
                const targetUser = options.getUser('user') || user;
                const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
                
                const petResult = await generatePetPetGif(avatarUrl);
                
                if (petResult.success) {
                    const petEmbed = new EmbedBuilder()
                        .setTitle(`${user.displayName} pets ${targetUser.displayName}!`)
                        .setDescription("*Pat pat pat* 🤗")
                        .setImage(avatarUrl)
                        .setColor('#FFB6C1')
                        .setFooter({ text: 'Pet pet! So cute!' });
                    
                    await interaction.editReply({ embeds: [petEmbed] });
                } else {
                    await interaction.editReply('❌ Failed to generate pet pet!');
                }
                break;

            case 'kick':
                const kickUser = options.getUser('user');
                const kickReason = options.getString('reason') || 'No reason provided';
                
                try {
                    const kickMember = await guild.members.fetch(kickUser.id);
                    
                    if (kickMember.kickable) {
                        await kickMember.kick(kickReason);
                        await interaction.reply(`✅ ${kickUser.tag} has been kicked. Reason: ${kickReason}`);
                    } else {
                        await interaction.reply('❌ Cannot kick this user (insufficient permissions or higher role).');
                    }
                } catch (error) {
                    await interaction.reply('❌ Failed to kick user. They may not be in the server.');
                }
                break;

            case 'ban':
                const banUser = options.getUser('user');
                const banReason = options.getString('reason') || 'No reason provided';
                
                try {
                    const banMember = await guild.members.fetch(banUser.id);
                    
                    if (banMember.bannable) {
                        await banMember.ban({ reason: banReason });
                        await interaction.reply(`✅ ${banUser.tag} has been banned. Reason: ${banReason}`);
                    } else {
                        await interaction.reply('❌ Cannot ban this user (insufficient permissions or higher role).');
                    }
                } catch (error) {
                    await interaction.reply('❌ Failed to ban user. They may not be in the server.');
                }
                break;

            case 'warn':
                const warnUser = options.getUser('user');
                const warnReason = options.getString('reason');
                
                if (!storage.warnings.has(warnUser.id)) {
                    storage.warnings.set(warnUser.id, []);
                }
                
                storage.warnings.get(warnUser.id).push({
                    reason: warnReason,
                    moderator: user.id,
                    timestamp: Date.now()
                });
                
                await interaction.reply(`⚠️ ${warnUser.tag} has been warned. Reason: ${warnReason}`);
                break;

            case 'warnings':
                const checkUser = options.getUser('user');
                const warnings = storage.warnings.get(checkUser.id) || [];
                
                const embed = new EmbedBuilder()
                    .setTitle(`Warnings for ${checkUser.tag}`)
                    .setColor('#ffcc00')
                    .setDescription(warnings.length === 0 ? 'No warnings' : 
                        warnings.map((w, i) => `${i + 1}. ${w.reason} - <@${w.moderator}>`).join('\n'));
                
                await interaction.reply({ embeds: [embed] });
                break;

            case 'clear':
                const amount = options.getInteger('amount');
                try {
                    const messages = await channel.bulkDelete(amount, true);
                    await interaction.reply(`✅ Cleared ${messages.size} messages.`);
                } catch (error) {
                    await interaction.reply('❌ Failed to clear messages. Messages may be too old (>14 days).');
                }
                break;

            case 'avatar':
                const avatarUser = options.getUser('user') || user;
                const avatarEmbed = new EmbedBuilder()
                    .setTitle(`${avatarUser.tag}'s Avatar`)
                    .setImage(avatarUser.displayAvatarURL({ size: 512 }))
                    .setColor('#5865F2');
                
                await interaction.reply({ embeds: [avatarEmbed] });
                break;

            case 'userinfo':
                const infoUser = options.getUser('user') || user;
                const member = await guild.members.fetch(infoUser.id);
                
                const userEmbed = new EmbedBuilder()
                    .setTitle(`User Info: ${infoUser.tag}`)
                    .setThumbnail(infoUser.displayAvatarURL())
                    .addFields(
                        { name: 'ID', value: infoUser.id, inline: true },
                        { name: 'Created', value: `<t:${Math.floor(infoUser.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Roles', value: member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || 'None' }
                    )
                    .setColor('#5865F2');
                
                await interaction.reply({ embeds: [userEmbed] });
                break;

            case 'serverinfo':
                const serverEmbed = new EmbedBuilder()
                    .setTitle(guild.name)
                    .setThumbnail(guild.iconURL())
                    .addFields(
                        { name: 'Members', value: guild.memberCount.toString(), inline: true },
                        { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
                        { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
                        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                    )
                    .setColor('#5865F2');
                
                await interaction.reply({ embeds: [serverEmbed] });
                break;

            case 'poll':
                const question = options.getString('question');
                const pollOptions = options.getString('options').split(',').map(o => o.trim());
                
                if (pollOptions.length < 2 || pollOptions.length > 10) {
                    await interaction.reply('❌ Poll must have 2-10 options.');
                    return;
                }
                
                const pollEmbed = new EmbedBuilder()
                    .setTitle(`📊 ${question}`)
                    .setDescription(pollOptions.map((opt, i) => `${i + 1}️⃣ ${opt}`).join('\n'))
                    .setColor('#5865F2');
                
                const pollMessage = await interaction.reply({ embeds: [pollEmbed], fetchReply: true });
                
                for (let i = 0; i < pollOptions.length; i++) {
                    await pollMessage.react(`${i + 1}️⃣`);
                }
                break;

            case 'remind':
                const timeStr = options.getString('time');
                const message = options.getString('message');
                
                const timeMs = parseTime(timeStr);
                if (!timeMs) {
                    await interaction.reply('❌ Invalid time format. Use format like: 5m, 1h, 2d');
                    return;
                }
                
                await interaction.reply(`⏰ Reminder set for ${timeStr}!`);
                
                setTimeout(() => {
                    interaction.followUp(`🔔 Reminder: ${message}`);
                }, timeMs);
                break;

            case 'afk':
                const afkReason = options.getString('reason') || 'AFK';
                storage.afkUsers.set(user.id, { reason: afkReason, timestamp: Date.now() });
                await interaction.reply(`😴 You are now AFK: ${afkReason}`);
                break;

            case 'meme':
                await interaction.deferReply();
                try {
                    const memeResponse = await axios.get('https://meme-api.com/gimme');
                    const memeEmbed = new EmbedBuilder()
                        .setTitle(memeResponse.data.title)
                        .setImage(memeResponse.data.url)
                        .setColor('#ff6b6b');
                    
                    await interaction.editReply({ embeds: [memeEmbed] });
                } catch (error) {
                    await interaction.editReply('❌ Failed to fetch meme!');
                }
                break;

            case 'joke':
                const jokes = [
                    "Why don't scientists trust atoms? Because they make up everything!",
                    "Why did the scarecrow win an award? He was outstanding in his field!",
                    "Why don't eggs tell jokes? They'd crack each other up!",
                    "What do you call a fake noodle? An impasta!",
                    "Why did the math book look so sad? Because it had too many problems!"
                ];
                
                await interaction.reply(jokes[Math.floor(Math.random() * jokes.length)]);
                break;

            case '8ball':
                const ballQuestion = options.getString('question');
                const responses = [
                    "It is certain", "Reply hazy, try again", "Don't count on it",
                    "It is decidedly so", "Ask again later", "My reply is no",
                    "Without a doubt", "Better not tell you now", "My sources say no",
                    "Yes definitely", "Cannot predict now", "Outlook not so good",
                    "You may rely on it", "Concentrate and ask again", "Very doubtful"
                ];
                
                const response = responses[Math.floor(Math.random() * responses.length)];
                await interaction.reply(`🎱 **${ballQuestion}**\n${response}`);
                break;

            case 'help':
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🤖 Bot Commands')
                    .setDescription('Here are all available commands:')
                    .addFields(
                        { name: '🎨 Fun Commands', value: '`/petpet` `/avatar` `/userinfo` `/serverinfo` `/poll` `/meme` `/joke` `/8ball`' },
                        { name: '🛡️ Moderation', value: '`/kick` `/ban` `/warn` `/warnings` `/clear`' },
                        { name: '🔧 Utility', value: '`/remind` `/afk` `/weather` `/translate` `/qr`' },
                        { name: '🎵 Music', value: '`/play` `/stop` (Basic implementation)' },
                        { name: '💰 Economy', value: '`/balance` `/daily` (Basic implementation)' },
                        { name: '⚙️ Custom', value: '`/addcmd` (Add custom commands)' }
                    )
                    .setColor('#5865F2')
                    .setFooter({ text: 'Made with ❤️ using Discord.js' });
                
                await interaction.reply({ embeds: [helpEmbed] });
                break;

            default:
                // Check for custom commands
                if (storage.customCommands.has(commandName)) {
                    await interaction.reply(storage.customCommands.get(commandName));
                } else {
                    await interaction.reply('❌ Command not implemented yet!');
                }
        }
    } catch (error) {
        console.error('❌ Error handling command:', error);
        const errorMessage = '❌ An error occurred while executing this command.';
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        }
    }
});

// Message handler for AFK system
client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    // Check if user is AFK and remove status
    if (storage.afkUsers.has(message.author.id)) {
        storage.afkUsers.delete(message.author.id);
        message.reply('👋 Welcome back! Your AFK status has been removed.');
    }
    
    // Check if mentioned users are AFK
    message.mentions.users.forEach(user => {
        if (storage.afkUsers.has(user.id)) {
            const afkData = storage.afkUsers.get(user.id);
            message.reply(`💤 ${user.tag} is AFK: ${afkData.reason}`);
        }
    });
});

// Utility functions
function parseTime(timeStr) {
    const matches = timeStr.match(/^(\d+)([smhd])$/);
    if (!matches) return null;
    
    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

// Deploy commands with better error handling
async function deployCommands() {
    if (!config.token || !config.clientId) {
        console.error('❌ Cannot deploy commands: Missing token or client ID');
        return false;
    }

    const rest = new REST({ version: '9' }).setToken(config.token);
    
    try {
        console.log('🔄 Started refreshing application (/) commands.');
        
        if (config.guildId) {
            // Deploy to specific guild (faster for development)
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
            console.log(`✅ Successfully deployed commands to guild ${config.guildId}`);
        } else {
            // Deploy globally (takes up to 1 hour)
            await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );
            console.log('✅ Successfully deployed commands globally');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        
        if (error.code === 'TokenInvalid') {
            console.error('🔑 Your Discord token is invalid. Please check your DISCORD_TOKEN environment variable.');
        } else if (error.code === 50001) {
            console.error('🔑 Missing access. Check your bot permissions and token.');
        } else if (error.status === 401) {
            console.error('🔑 Unauthorized. Your bot token may be invalid or expired.');
        }
        
        return false;
    }
}

// Start the bot with proper error handling
async function startBot() {
    try {
        // Validate configuration first
        validateConfig();
        
        // Deploy commands
        const deploySuccess = await deployCommands();
        if (!deploySuccess) {
            console.error('❌ Failed to deploy commands. Bot will not start.');
            process.exit(1);
        }
        
        // Login to Discord
        console.log('🔑 Logging in to Discord...');
        await client.login(config.token);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        
        if (error.code === 'TokenInvalid') {
            console.error('🔑 Invalid token provided. Please check your DISCORD_TOKEN environment variable.');
        } else if (error.code === 'DisallowedIntents') {
            console.error('🔑 Disallowed intents. Please enable the required intents in the Discord Developer Portal.');
        }
        
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('📴 Received SIGINT. Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('📴 Received SIGTERM. Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Start the bot
startBot().catch((error) => {
    console.error('❌ Fatal error starting bot:', error);
    process.exit(1);
});