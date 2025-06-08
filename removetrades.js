const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { formatTradeLine } = require('../tradeHelpers');
require('dotenv').config();

const dataPath = path.join(__dirname, '../data/trades.json');

function loadTrades() {
  if (!fs.existsSync(dataPath)) return [];
  return JSON.parse(fs.readFileSync(dataPath));
}

function saveTrades(trades) {
  fs.writeFileSync(dataPath, JSON.stringify(trades, null, 2));
}

/**
 * Updates the pinned embed in the summary channel.
 * It groups trades using their 'index' and deduplicates platform names.
 */
async function updateGeneralEmbed(client, trades) {
  const summaryChannel = await client.channels.fetch(process.env.TRADE_CHANNEL_ID);
  // Get the 10 most recent trades
  const recentTrades = [...trades].reverse().slice(0, 10);

  // Group trades by their index and deduplicate platforms.
  const groupedTrades = new Map();
  for (const trade of recentTrades) {
    if (groupedTrades.has(trade.index)) {
      const group = groupedTrades.get(trade.index);
      // Deduplication: add only if missing.
      if (!group.platforms.includes(trade.platform)) {
        group.platforms.push(trade.platform);
      }
    } else {
      groupedTrades.set(trade.index, { ...trade, platforms: [trade.platform] });
    }
  }
  // Create combined trade entries for display.
  const combinedTrades = Array.from(groupedTrades.values());
  const tradeLines = combinedTrades
    .map(trade => {
      // Override the trade.platform field with the deduplicated list.
      const combinedTrade = { ...trade, platform: trade.platforms.join(', ') };
      return formatTradeLine(combinedTrade);
    })
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('📌 Latest Trades')
    .setColor(0xff0000)
    .setDescription(tradeLines)
    .setTimestamp();

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
    .setName('removetrade')
    .setDescription('Remove a trade by its index.')
    .addIntegerOption(option =>
      option
        .setName('index')
        .setDescription('The trade index to remove')
        .setRequired(true)
    ),
  async execute(interaction) {
    const indexToRemove = interaction.options.getInteger('index');
    let trades = loadTrades();

    // Look for all trades with the specified index.
    const tradesToRemove = trades.filter(trade => trade.index === indexToRemove);
    if (tradesToRemove.length === 0) {
      return interaction.reply({
        content: `No trades found with index ${indexToRemove}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Remove all trades that have the same index.
    trades = trades.filter(trade => trade.index !== indexToRemove);
    saveTrades(trades);

    // Update the pinned embed to reflect the changes.
    await updateGeneralEmbed(interaction.client, trades);

    await interaction.reply({
      content: `Removed ${tradesToRemove.length} trade entry(ies) with index ${indexToRemove}.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
