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

        const chunks = [];
        let current = '';
        for (const trade of matches) {
            const line = formatTradeLine(trade);
            if ((current + '\n\n' + line).length > 1900) {
                chunks.push(current);
                current = line;
            } else {
                current += (current ? '\n\n' : '') + line;
            }
        }
        chunks.push(current);

        for (const chunk of chunks) {
            await interaction.user.send(chunk);
        }

        await interaction.reply({ content: `📬 Found ${matches.length} trade(s). Sent to your DMs.`, ephemeral: true });
    }
};
