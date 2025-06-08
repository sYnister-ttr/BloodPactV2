const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    ComponentType,
    EmbedBuilder,
    MessageFlags
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  require('dotenv').config();
  const { formatTradeLine } = require('../tradeHelpers');
  
  const dataPath = path.join(__dirname, '../data/trades.json');
  
  const categoryChannelMap = {
    "PC Softcore Ladder": "1380764971079696425",
    "PC Softcore Non-Ladder": "1380764999667945502",
    "PC Hardcore Ladder": "1380765029598629908",
    "PC Hardcore Non-Ladder": "1380765052742668338",
    "PlayStation Softcore Ladder": "1380764810257367110",
    "PlayStation Softcore Non-Ladder": "1380764842834530354",
    "PlayStation Hardcore Ladder": "1380764872383533167",
    "PlayStation Hardcore Non-Ladder": "1380764936740933672",
    "Xbox Softcore Ladder": "1380765092697870366",
    "Xbox Softcore Non-Ladder": "1380765122934345790",
    "Xbox Hardcore Ladder": "1380765154932953108",
    "Xbox Hardcore Non-Ladder": "1380765177691246612",
    "Switch Softcore Ladder": "1380765202127126528",
    "Switch Softcore Non-Ladder": "1380765224444887112",
    "Switch Hardcore Ladder": "1380765253599756328",
    "Switch Hardcore Non-Ladder": "1380765277578461244"
  };
  
  function loadTrades() {
    if (!fs.existsSync(dataPath)) return [];
    return JSON.parse(fs.readFileSync(dataPath));
  }
  
  function saveTrades(trades) {
    fs.writeFileSync(dataPath, JSON.stringify(trades, null, 2));
  }
  
  /**
   * Updates the pinned embed in the summary channel.
   * This function now shows the 15 most recent unique trade submissions.
   * It groups trades by their index (which is common to submissions with multiple platforms),
   * deduplicates the platform list, and then builds the embed.
   */
  async function updateGeneralEmbed(client, trades) {
    const summaryChannel = await client.channels.fetch(process.env.TRADE_CHANNEL_ID);
    // Sort all trades by timestamp descending (most recent first)
    const sortedTrades = [...trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Group trades by their shared index and deduplicate the platform field.
    const groupedTrades = new Map();
    for (const trade of sortedTrades) {
      if (groupedTrades.has(trade.index)) {
        const group = groupedTrades.get(trade.index);
        if (!group.platforms.includes(trade.platform)) {
          group.platforms.push(trade.platform);
        }
      } else {
        groupedTrades.set(trade.index, { ...trade, platforms: [trade.platform] });
      }
    }
  
    // Convert grouped trades into an array sorted by timestamp descending
    const combinedTrades = Array.from(groupedTrades.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 15);
  
    // Build the embed text with deduplicated platform lists.
    const tradeLines = combinedTrades
      .map(trade => {
        const combinedTrade = { ...trade, platform: trade.platforms.join(', ') };
        return formatTradeLine(combinedTrade);
      })
      .join('\n\n');
  
    const embed = new EmbedBuilder()
      .setTitle('📌 Latest Trades')
      .setColor(0xff0000)
      .setDescription(tradeLines)
      .setTimestamp();
  
    // Update pinned message in summary channel.
    const pins = await summaryChannel.messages.fetchPinned();
    const pin = pins.find(msg => msg.author.id === client.user.id);
    if (pin) {
      await pin.edit({ embeds: [embed] });
    } else {
      const msg = await summaryChannel.send({ embeds: [embed] });
      await msg.pin();
    }
  }
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('trade')
      .setDescription('List an item for trade')
      .addStringOption(o =>
        o.setName('item').setDescription('Item name').setRequired(true))
      .addStringOption(o =>
        o.setName('tradefor').setDescription('What you want in return').setRequired(true))
      .addStringOption(o =>
        o.setName('mode')
         .setDescription('Softcore or Hardcore')
         .setRequired(true)
         .addChoices(
           { name: 'Softcore', value: 'Softcore' },
           { name: 'Hardcore', value: 'Hardcore' }
         ))
      .addStringOption(o =>
        o.setName('ladder')
         .setDescription('Ladder or Non-Ladder')
         .setRequired(true)
         .addChoices(
           { name: 'Ladder', value: 'Ladder' },
           { name: 'Non-Ladder', value: 'Non-Ladder' }
         ))
      .addStringOption(o =>
        o.setName('region')
         .setDescription('Region')
         .setRequired(true)
         .addChoices(
           { name: 'Americas', value: 'Americas' },
           { name: 'Europe', value: 'Europe' },
           { name: 'Asia', value: 'Asia' }
         ))
      .addStringOption(o =>
        o.setName('link')
         .setDescription('Optional d2jsp or Traderie link')),
    async execute(interaction) {
      // Create a select menu to choose platforms.
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('platformSelect')
        .setPlaceholder('Select one or more platforms')
        .setMinValues(1)
        .setMaxValues(4)
        .addOptions(
          { label: 'PC', value: 'PC' },
          { label: 'PlayStation', value: 'PlayStation' },
          { label: 'Xbox', value: 'Xbox' },
          { label: 'Switch', value: 'Switch' }
        );
  
      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({
        content: 'Choose the platform(s) for your trade:',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
  
      // Create a collector for the select menu response.
      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
        filter: i => i.user.id === interaction.user.id && i.customId === 'platformSelect'
      });
  
      collector.on('collect', async (selectInteraction) => {
        try {
          // Get the selected platforms.
          const platforms = selectInteraction.values; // e.g. ["PC", "Xbox"]
  
          // Create a modal that embeds the selected platforms in its customId.
          const modal = new ModalBuilder()
            .setCustomId('tradeDetails:' + platforms.join(','))
            .setTitle('Trade Details')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('base')
                  .setLabel('Base Item')
                  .setRequired(false)
                  .setStyle(TextInputStyle.Short)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('ethereal')
                  .setLabel('Ethereal? (yes/no)')
                  .setRequired(false)
                  .setStyle(TextInputStyle.Short)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('sockets')
                  .setLabel('Sockets')
                  .setRequired(false)
                  .setStyle(TextInputStyle.Short)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('notes')
                  .setLabel('Notes')
                  .setRequired(false)
                  .setStyle(TextInputStyle.Paragraph)
              )
            );
  
          // Show the modal.
          await selectInteraction.showModal(modal);
  
          // Listen for the modal submission.
          const submitted = await new Promise((resolve, reject) => {
            const handler = i => {
              if (
                i.isModalSubmit() &&
                i.customId.startsWith('tradeDetails:') &&
                i.user.id === interaction.user.id
              ) {
                i.client.off('interactionCreate', handler);
                resolve(i);
              }
            };
            interaction.client.on('interactionCreate', handler);
            setTimeout(() => {
              interaction.client.off('interactionCreate', handler);
              reject(new Error('Timed out waiting for modal submission'));
            }, 60000);
          });
  
          // Extract platforms from modal's customId.
          const platformsString = submitted.customId.split(':')[1] || "";
          const platformsArr = platformsString.split(',');
  
          // Create a new trade submission with a shared trade index.
          const trades = loadTrades();
          const tradeIndex = trades.length + 1;
  
          for (const platform of platformsArr) {
            const trade = {
              index: tradeIndex,
              userId: interaction.user.id,
              item: interaction.options.getString('item'),
              tradeFor: interaction.options.getString('tradefor'),
              mode: interaction.options.getString('mode'),
              ladder: interaction.options.getString('ladder'),
              platform, // single platform for this iteration
              region: interaction.options.getString('region'),
              link: interaction.options.getString('link') || null,
              base: submitted.fields.getTextInputValue('base'),
              ethereal: submitted.fields.getTextInputValue('ethereal').toLowerCase() === 'yes',
              sockets: submitted.fields.getTextInputValue('sockets'),
              notes: submitted.fields.getTextInputValue('notes'),
              timestamp: new Date().toISOString()
            };
  
            const catKey = `${platform} ${trade.mode} ${trade.ladder}`;
            const channelId = categoryChannelMap[catKey];
            if (!channelId) continue;
  
            const channel = await interaction.client.channels.fetch(channelId);
            const message = await channel.send(formatTradeLine(trade));
            trade.channelId = channelId;
            trade.messageId = message.id;
  
            trades.push(trade);
          }
  
          saveTrades(trades);
          await updateGeneralEmbed(interaction.client, trades);
  
          await submitted.reply({
            content: '✅ Trade(s) listed.',
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          console.error('Error handling trade command modal:', error);
          await interaction.followUp({
            content: '❌ Something went wrong. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      });
    }
  };
