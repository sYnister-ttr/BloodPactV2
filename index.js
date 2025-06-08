// index.js
require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create the client with the required intents.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ],
  partials: ['CHANNEL'] // Needed for DM channels
});

// Create a Collection for your commands.
client.commands = new Collection();

// Load all command files from the "commands" folder.
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
  console.log(`✅ Loaded command: ${command.data.name}`);
}

// Global interaction handler.
client.on('interactionCreate', async interaction => {
  try {
    // Handle slash commands.
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
    // Handle button interactions.
    else if (interaction.isButton()) {
      if (interaction.customId.startsWith('offer')) {
        const offerCommand = require('./commands/offer');
        await offerCommand.handleButtonInteraction(interaction);
      }
    }
    // Handle modal submissions.
    else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('offerCounterModal')) {
        const offerCommand = require('./commands/offer');
        await offerCommand.handleCounterModal(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error processing this interaction.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error processing this interaction.', ephemeral: true });
    }
  }
});

// Log when the bot is ready.
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Login to Discord.
client.login(process.env.DISCORD_TOKEN);
