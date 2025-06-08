const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dataPath = path.join(__dirname, '../data/trades.json');

function loadTrades() {
    if (!fs.existsSync(dataPath)) return [];
    return JSON.parse(fs.readFileSync(dataPath));
}

function saveTrades(trades) {
    fs.writeFileSync(dataPath, JSON.stringify(trades, null, 2));
}

async function updateGeneralEmbed(client, trades) {
    const summaryChannel = await client.channels.fetch(process.env.TRADE_CHANNEL_ID);
    const recent = [...trades].reverse().slice(0, 10);
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
        .setTitle('📌 Latest Trades')
        .setColor(0xFF0000)
        .setDescription(recent.map(t => {
            const posted = `<t:${Math.floor(new Date(t.timestamp).getTime() / 1000)}:R>`;
            return `**#${t.index}** • <@${t.userId}> — **${t.item}** | **ISO:** ${t.tradeFor} • **Sockets:** ${t.sockets || 'None'} • **Ethereal:** ${t.ethereal ? 'Yes' : 'No'}${t.notes ? ` • **Notes:** ${t.notes}` : ''} • *Posted:* ${posted}${t.link ? `\n🔗 ${t.link}` : ''}`;
        }).join('\n\n'))
        .setTimestamp();

    const pins = await summaryChannel.messages.fetchPinned();
    const pin = pins.find(msg => msg.author.id === client.user.id);
    if (pin) await pin.edit({ embeds: [embed] });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removetrades')
        .setDescription('Remove trades by user or index')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove trades for'))
        .addIntegerOption(opt => opt.setName('index').setDescription('Specific trade index to remove')),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const index = interaction.options.getInteger('index');

        let trades = loadTrades();
        const toRemove = [];

        if (user) {
            if (index) {
                const match = trades.find(t => t.userId === user.id && t.index === index);
                if (match) toRemove.push(match);
            } else {
                toRemove.push(...trades.filter(t => t.userId === user.id));
            }
        } else if (index) {
            const match = trades.find(t => t.index === index);
            if (match) toRemove.push(match);
        } else {
            return interaction.reply({ content: '❌ Specify a user or index to remove.', ephemeral: true });
        }

        if (!toRemove.length) {
            return interaction.reply({ content: '❌ No trades matched your criteria.', ephemeral: true });
        }

        for (const trade of toRemove) {
            try {
                const channel = await interaction.client.channels.fetch(trade.channelId);
                const message = await channel.messages.fetch(trade.messageId);
                await message.delete();
            } catch (e) {
                console.error(`Could not delete message for trade index ${trade.index}:`, e.message);
            }
        }

        trades = trades.filter(t => !toRemove.includes(t));
        saveTrades(trades);
        await updateGeneralEmbed(interaction.client, trades);

        await interaction.reply({ content: `✅ Removed ${toRemove.length} trade(s).`, ephemeral: true });
    }
};
