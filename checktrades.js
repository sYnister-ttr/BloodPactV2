const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { formatTradeLine } = require('../tradeHelpers');

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

        const embeds = [];

        for (const [category, list] of Object.entries(grouped)) {
            const embed = new EmbedBuilder()
                .setTitle(`📦 ${category.toUpperCase()}`)
                .setColor(0x0099ff);

            const descriptions = list.map(t => formatTradeLine(t));
            let descBlock = "";
            for (const desc of descriptions) {
                if ((descBlock + '\n\n' + desc).length > 4000) {
                    embeds.push(embed.setDescription(descBlock));
                    descBlock = desc;
                } else {
                    descBlock += (descBlock ? '\n\n' : '') + desc;
                }
            }
            if (descBlock) {
                embeds.push(embed.setDescription(descBlock));
            }
        }

        await interaction.reply({ embeds, ephemeral: true });
    }
};
