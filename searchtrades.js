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
        .setName('searchtrades')
        .setDescription('Search for trades by keyword')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('Keyword to search in item, ISO, or notes')
                .setRequired(true)
        ),
    async execute(interaction) {
        const query = interaction.options.getString('query').toLowerCase();
        const trades = loadTrades();

        const matches = trades.filter(t =>
            t.item.toLowerCase().includes(query) ||
            t.tradeFor.toLowerCase().includes(query) ||
            (t.notes && t.notes.toLowerCase().includes(query))
        );

        if (!matches.length) {
            return interaction.reply({ content: '❌ No matching trades found.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Search Results for "${query}"`)
            .setColor(0x00cc99);

        const descriptions = matches.map(t => formatTradeLine(t));
        let descBlock = "";
        const embeds = [];

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

        await interaction.reply({ embeds, ephemeral: true });
    }
};
