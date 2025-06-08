const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { formatTradeLine } = require('./trade');

const dataPath = path.join(__dirname, '../data/trades.json');

function loadTrades() {
    if (!fs.existsSync(dataPath)) return [];
    return JSON.parse(fs.readFileSync(dataPath));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checktrades')
        .setDescription('View all currently listed trades'),
    async execute(interaction) {
        const trades = loadTrades();
        if (trades.length === 0) {
            return interaction.reply({ content: '❌ No trades currently listed.', ephemeral: true });
        }

        const grouped = {};
        for (const trade of trades) {
            const key = `${trade.platform} - ${trade.mode} ${trade.ladder}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(trade);
        }

        for (const [category, list] of Object.entries(grouped)) {
            const header = `🔹 **${category.toUpperCase()}**\n`;
            const blocks = [];
            let current = header;

            for (const trade of list) {
                const line = formatTradeLine(trade);
                if ((current + '\n\n' + line).length > 1900) {
                    blocks.push(current);
                    current = header + line;
                } else {
                    current += '\n\n' + line;
                }
            }

            blocks.push(current);
            for (const b of blocks) {
                await interaction.user.send(b);
            }
        }

        await interaction.reply({ content: '📬 Sent all current trades to your DMs.', ephemeral: true });
    }
};
