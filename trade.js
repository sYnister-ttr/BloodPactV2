const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

function capitalizeEachWord(str) {
    return str?.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) || '';
}

function formatTradeLine(trade) {
    const posted = `<t:${Math.floor(new Date(trade.timestamp).getTime() / 1000)}:R>`;
    const parts = [
        `**#${trade.index}** • <@${trade.userId}> — **${capitalizeEachWord(trade.item)}**`,
        `  **Base:** ${capitalizeEachWord(trade.base) || 'None'} | **ISO:** ${capitalizeEachWord(trade.tradeFor)} | **Sockets:** ${trade.sockets || 'None'} | **Ethereal:** ${trade.ethereal ? 'Yes' : 'No'} | **Notes:** ${capitalizeEachWord(trade.notes) || 'None'} | *Posted:* ${posted}`,
        trade.link ? `🔗 ${trade.link}` : null
    ];
    return parts.filter(Boolean).join('\n');
}

async function updateGeneralEmbed(client, trades) {
    const summaryChannel = await client.channels.fetch(process.env.TRADE_CHANNEL_ID);
    const recent = [...trades].reverse().slice(0, 10);
    const embed = new EmbedBuilder()
        .setTitle('📌 Latest Trades')
        .setColor(0xFF0000)
        .setDescription(recent.map(t => formatTradeLine(t)).join('\n\n'))
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
        .setName('trade')
        .setDescription('List an item for trade')
        .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))
        .addStringOption(o => o.setName('tradefor').setDescription('What you want in return').setRequired(true))
        .addStringOption(o => o.setName('mode').setDescription('Softcore or Hardcore').setRequired(true).addChoices(
            { name: 'Softcore', value: 'Softcore' },
            { name: 'Hardcore', value: 'Hardcore' }
        ))
        .addStringOption(o => o.setName('ladder').setDescription('Ladder or Non-Ladder').setRequired(true).addChoices(
            { name: 'Ladder', value: 'Ladder' },
            { name: 'Non-Ladder', value: 'Non-Ladder' }
        ))
        .addStringOption(o => o.setName('platform').setDescription('Platform').setRequired(true).addChoices(
            { name: 'PC', value: 'PC' },
            { name: 'PlayStation', value: 'PlayStation' },
            { name: 'Xbox', value: 'Xbox' },
            { name: 'Switch', value: 'Switch' }
        ))
        .addStringOption(o => o.setName('region').setDescription('Region').setRequired(true).addChoices(
            { name: 'Americas', value: 'Americas' },
            { name: 'Europe', value: 'Europe' },
            { name: 'Asia', value: 'Asia' }
        ))
        .addStringOption(o => o.setName('link').setDescription('Optional d2jsp or Traderie link')),
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('tradeDetails')
            .setTitle('Trade Details')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('base').setLabel('Base Item').setRequired(false).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('ethereal').setLabel('Ethereal? (yes/no)').setRequired(false).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('sockets').setLabel('Sockets').setRequired(false).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('notes').setLabel('Notes').setRequired(false).setStyle(TextInputStyle.Paragraph))
            );

        await interaction.showModal(modal);
        const submitted = await interaction.awaitModalSubmit({ time: 60000, filter: i => i.user.id === interaction.user.id });

        const trades = loadTrades();
        const trade = {
            index: trades.length + 1,
            userId: interaction.user.id,
            item: interaction.options.getString('item'),
            tradeFor: interaction.options.getString('tradefor'),
            mode: interaction.options.getString('mode'),
            ladder: interaction.options.getString('ladder'),
            platform: interaction.options.getString('platform'),
            region: interaction.options.getString('region'),
            link: interaction.options.getString('link') || null,
            base: submitted.fields.getTextInputValue('base'),
            ethereal: submitted.fields.getTextInputValue('ethereal').toLowerCase() === 'yes',
            sockets: submitted.fields.getTextInputValue('sockets'),
            notes: submitted.fields.getTextInputValue('notes'),
            timestamp: new Date().toISOString()
        };

        const catKey = `${trade.platform} ${trade.mode} ${trade.ladder}`;
        const channelId = categoryChannelMap[catKey];
        if (!channelId) return submitted.reply({ content: '❌ Category not found.', ephemeral: true });

        const channel = await interaction.client.channels.fetch(channelId);
        const message = await channel.send(formatTradeLine(trade));
        trade.channelId = channelId;
        trade.messageId = message.id;

        trades.push(trade);
        saveTrades(trades);
        await updateGeneralEmbed(interaction.client, trades);

        await submitted.reply({ content: '✅ Trade listed.', ephemeral: true });
    }
};
