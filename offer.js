// commands/offer.js
const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField,
    EmbedBuilder
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  require('dotenv').config();
  const tradeModule = require('./trade'); // trade.js must export updateGeneralEmbed(client, trades)
  const { formatOfferLine } = require('../offerHelper'); // if you need this helper
  
  const offersDataPath = path.join(__dirname, '../data/offers.json');
  const tradesDataPath = path.join(__dirname, '../data/trades.json');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('offer')
      .setDescription('Make an offer on a listed trade item'),
      
    async execute(interaction) {
      // Build the modal for making an offer.
      const modal = new ModalBuilder()
        .setCustomId('offerModal')
        .setTitle('Make an Offer');
    
      const tradeIndexInput = new TextInputBuilder()
        .setCustomId('tradeIndex')
        .setLabel('Trade Listing Index')
        .setPlaceholder('Enter the trade index (e.g., 20)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
      const yourOfferInput = new TextInputBuilder()
        .setCustomId('yourOffer')
        .setLabel('Your Offer')
        .setPlaceholder('What are you offering?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
      const notesInput = new TextInputBuilder()
        .setCustomId('notes')
        .setLabel('Optional Notes')
        .setPlaceholder('Any additional comments')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
    
      modal.addComponents(
        new ActionRowBuilder().addComponents(tradeIndexInput),
        new ActionRowBuilder().addComponents(yourOfferInput),
        new ActionRowBuilder().addComponents(notesInput)
      );
    
      // Show the modal to the buyer.
      await interaction.showModal(modal);
    
      try {
        // Wait for modal submission using a temporary listener.
        const submitted = await new Promise((resolve, reject) => {
          const handler = i => {
            if (
              i.isModalSubmit() &&
              i.customId === 'offerModal' &&
              i.user.id === interaction.user.id
            ) {
              i.client.off('interactionCreate', handler);
              resolve(i);
            }
          };
          interaction.client.on('interactionCreate', handler);
          setTimeout(() => {
            interaction.client.off('interactionCreate', handler);
            reject(new Error('Modal submission timed out'));
          }, 60000);
        });
    
        // Immediately defer reply.
        await submitted.deferReply({ ephemeral: true });
    
        // Parse modal input.
        const tradeIndexStr = submitted.fields.getTextInputValue('tradeIndex');
        const tradeIndex = parseInt(tradeIndexStr, 10);
        if (isNaN(tradeIndex)) {
          await submitted.editReply({ content: 'Invalid trade index provided. It must be a number.' });
          return;
        }
        const yourOffer = submitted.fields.getTextInputValue('yourOffer');
        const notes = submitted.fields.getTextInputValue('notes');
    
        // Load trades to locate the target listing.
        let trades = [];
        if (fs.existsSync(tradesDataPath)) {
          trades = JSON.parse(fs.readFileSync(tradesDataPath));
        }
        const listing = trades.find(trade => trade.index === tradeIndex);
        if (!listing) {
          await submitted.editReply({ content: `Trade listing with index ${tradeIndex} not found.` });
          return;
        }
    
        const sellerId = listing.userId;
        const item = listing.item;
    
        // Load existing offers.
        let offers = [];
        if (fs.existsSync(offersDataPath)) {
          offers = JSON.parse(fs.readFileSync(offersDataPath));
        }
        const offerId = offers.length + 1;
    
        // Create the offer object.
        const offer = {
          offerId,
          tradeIndex,
          sellerId,
          buyerId: interaction.user.id,
          yourOffer,
          notes,
          status: "Pending",
          timestamp: new Date().toISOString()
          // Will add privateChannelId below.
        };
    
        const guild = interaction.guild;
        const sellerMember = await guild.members.fetch(sellerId);
        const buyerMember = await guild.members.fetch(interaction.user.id);
    
        // Determine (or create) the private category for this trade listing.
        // Naming convention: "{sellerUsername}-{tradeIndex}-{item}"
        const sanitizedCategoryName = `${sellerMember.user.username}-${tradeIndex}-${item}`
          .replace(/[^a-zA-Z0-9\- ]/g, '')
          .slice(0, 90);
        let categoryChannel = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory &&
               c.name.startsWith(`${sellerMember.user.username}-${tradeIndex}-`)
        );
        if (!categoryChannel) {
          categoryChannel = await guild.channels.create({
            name: sanitizedCategoryName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
              { id: sellerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
              { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
              { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ]
          });
        }
    
        // Within the category, check if a text channel for this buyer exists.
        const buyerChannelName = `${buyerMember.user.username}-offer`
          .toLowerCase()
          .replace(/[^a-z0-9\-]/g, '')
          .slice(0, 90);
        let privateChannel = guild.channels.cache.find(
          c => c.parentId === categoryChannel.id && c.name === buyerChannelName
        );
        if (!privateChannel) {
          privateChannel = await guild.channels.create({
            name: buyerChannelName,
            type: ChannelType.GuildText,
            parent: categoryChannel.id,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
              { id: sellerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
              { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
              { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ]
          });
        }
        offer.privateChannelId = privateChannel.id;
    
        // Build the offer announcement embed.
        const offerEmbed = new EmbedBuilder()
          .setTitle(`Offer on ${item}`)
          .setDescription(`**<@${sellerId}> — <@${interaction.user.id}> has made an offer on your ${item}**.`)
          .addFields(
            { name: 'Offer', value: `**${yourOffer}**` },
            { name: 'Notes', value: notes || 'None' },
            { name: 'Trade Listing Index', value: `${tradeIndex}` }
          )
          .setFooter({ text: 'Offer Status: Pending' })
          .setColor(0xFFFF00)
          .setTimestamp();
    
        // Create buttons.
        const acceptButton = new ButtonBuilder()
          .setCustomId(`offerAccept:${offerId}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success);
        const declineButton = new ButtonBuilder()
          .setCustomId(`offerDecline:${offerId}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger);
        const counterButton = new ButtonBuilder()
          .setCustomId(`offerCounter:${offerId}`)
          .setLabel('Counter')
          .setStyle(ButtonStyle.Primary);
        const retractButton = new ButtonBuilder()
          .setCustomId(`offerRetract:${offerId}`)
          .setLabel('Retract Offer')
          .setStyle(ButtonStyle.Secondary);
    
        const sellerButtonsRow = new ActionRowBuilder().addComponents(acceptButton, declineButton, counterButton);
        const buyerButtonsRow = new ActionRowBuilder().addComponents(retractButton);
    
        // Send the announcement in the private channel (pings both seller and buyer).
        await privateChannel.send({
          content: `<@${sellerId}> — <@${interaction.user.id}> has made an offer on your ${item}`,
          embeds: [offerEmbed],
          components: [sellerButtonsRow, buyerButtonsRow]
        });
    
        // Save the offer.
        offers.push(offer);
        fs.writeFileSync(offersDataPath, JSON.stringify(offers, null, 2));
    
        // Finally, edit the deferred reply.
        await submitted.editReply({
          content: `✅ Your offer has been submitted! A private conversation channel has been created: ${privateChannel}`
        });
    
      } catch (error) {
        console.error('Error during offer modal submission:', error);
        try {
          await interaction.followUp({
            content: '❌ Something went wrong. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        } catch (err) {
          console.error('Failed to send follow-up:', err);
        }
      }
    },
    
    async handleButtonInteraction(interaction) {
      if (!interaction.isButton()) return;
      const [action, offerIdStr] = interaction.customId.split(':');
      const offerId = parseInt(offerIdStr, 10);
    
      // Load offers from JSON.
      let offers = [];
      if (fs.existsSync(offersDataPath)) {
        offers = JSON.parse(fs.readFileSync(offersDataPath));
      }
      const offerIndex = offers.findIndex(o => o.offerId === offerId);
      if (offerIndex === -1) {
        return interaction.reply({ content: 'Offer not found.', ephemeral: true });
      }
      const offer = offers[offerIndex];
    
      // Re-create disabled components from each row.
      const disabledComponents = interaction.message.components.map(row =>
        ActionRowBuilder.from(row).setComponents(
          row.components.map(comp => ButtonBuilder.from(comp).setDisabled(true))
        )
      );
    
      const originalEmbed = interaction.message.embeds[0];
      const embed = EmbedBuilder.from(originalEmbed);
    
      if (action === 'offerAccept') {
        if (interaction.user.id !== offer.sellerId) {
          return interaction.reply({ content: 'Only the seller can accept this offer.', ephemeral: true });
        }
        offer.status = 'Accepted';
        embed.setFooter({ text: 'Offer Status: Accepted' });
        embed.setColor(0x00FF00); // Green
    
        // Instead of immediately deleting the channel, add an Archive Chat button.
        const archiveButton = new ButtonBuilder()
          .setCustomId(`offerArchive:${offerId}`)
          .setLabel('Archive Chat')
          .setStyle(ButtonStyle.Secondary);
        const archiveRow = new ActionRowBuilder().addComponents(archiveButton);
        const newComponents = [...disabledComponents, archiveRow];
    
        await interaction.update({ embeds: [embed], components: newComponents });
        // Notify the buyer.
        try {
          const buyerMember = await interaction.guild.members.fetch(offer.buyerId);
          await buyerMember.send(`Your offer on trade listing ${offer.tradeIndex} has been accepted! You may now chat with the seller. Once finished, the seller can archive the chat.`);
        } catch (e) {
          console.error('Failed to DM buyer:', e);
        }
        offers[offerIndex] = offer;
        fs.writeFileSync(offersDataPath, JSON.stringify(offers, null, 2));
    
      } else if (action === 'offerDecline') {
        if (interaction.user.id !== offer.sellerId) {
          return interaction.reply({ content: 'Only the seller can decline this offer.', ephemeral: true });
        }
        offer.status = 'Declined';
        embed.setFooter({ text: 'Offer Status: Declined' });
        embed.setColor(0xFF0000); // Red
    
        await interaction.update({ embeds: [embed], components: disabledComponents });
        try {
          const buyerMember = await interaction.guild.members.fetch(offer.buyerId);
          await buyerMember.send(`Your offer on trade listing ${offer.tradeIndex} has been declined.`);
        } catch (e) {
          console.error('Failed to DM buyer:', e);
        }
        fs.writeFileSync(offersDataPath, JSON.stringify(offers, null, 2));
    
      } else if (action === 'offerCounter') {
        if (interaction.user.id !== offer.sellerId) {
          return interaction.reply({ content: 'Only the seller can send a counteroffer.', ephemeral: true });
        }
        const counterModal = new ModalBuilder()
          .setCustomId(`offerCounterModal:${offerId}`)
          .setTitle('Counter Offer')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('counterOffer')
                .setLabel('Your Counter Offer')
                .setPlaceholder('Enter your counteroffer details')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            )
          );
        await interaction.showModal(counterModal);
        // Counter modal submission is handled in handleCounterModal.
    
      } else if (action === 'offerRetract') {
        if (interaction.user.id !== offer.buyerId) {
          return interaction.reply({ content: 'Only the buyer can retract this offer.', ephemeral: true });
        }
        offer.status = 'Retracted';
        embed.setFooter({ text: 'Offer Status: Retracted' });
        embed.setColor(0x808080); // Gray
    
        await interaction.update({ embeds: [embed], components: disabledComponents });
        fs.writeFileSync(offersDataPath, JSON.stringify(offers, null, 2));
        try {
          const sellerMember = await interaction.guild.members.fetch(offer.sellerId);
          await sellerMember.send(`The offer on trade listing ${offer.tradeIndex} has been retracted by the buyer.`);
        } catch (e) {
          console.error('Failed to DM seller:', e);
        }
    
      } else if (action === 'offerArchive') {
        if (interaction.user.id !== offer.sellerId) {
          return interaction.reply({ content: 'Only the seller can archive this chat.', ephemeral: true });
        }
        offer.status = 'Archived';
        embed.setFooter({ text: 'Offer Status: Archived' });
        embed.setColor(0x808080); // Gray
        const newComponents = disabledComponents;
        await interaction.update({ embeds: [embed], components: newComponents });
        
        // Remove the associated trade listings from trades data.
        let trades = [];
        if (fs.existsSync(tradesDataPath)) {
          trades = JSON.parse(fs.readFileSync(tradesDataPath));
        }
        // Find all listings matching the trade index.
        const removedTrades = trades.filter(trade => trade.index === offer.tradeIndex);
        // Filter them out.
        trades = trades.filter(trade => trade.index !== offer.tradeIndex);
        fs.writeFileSync(tradesDataPath, JSON.stringify(trades, null, 2));
        
        // Delete individual trade listing messages from their channels.
        for (const trade of removedTrades) {
          try {
            const channel = await interaction.guild.channels.fetch(trade.channelId);
            if (channel) {
              const msg = await channel.messages.fetch(trade.messageId);
              if (msg) await msg.delete();
            }
          } catch (e) {
            console.error("Error deleting trade listing message:", e);
          }
        }
        
        // Update the pinned embed in the trade summary channel.
        try {
           if (typeof tradeModule.updateGeneralEmbed === "function") {
              await tradeModule.updateGeneralEmbed(interaction.client, trades);
           }
        } catch (e) {
           console.error("Error updating pinned embed:", e);
        }
    
        // Delete the private conversation channel.
        if (offer.privateChannelId) {
          try {
            const channelToDelete = await interaction.guild.channels.fetch(offer.privateChannelId);
            if (channelToDelete) await channelToDelete.delete("Chat archived");
          } catch (e) {
            console.error("Error deleting private channel:", e);
          }
        }
        
        // Remove the offer from storage.
        offers.splice(offerIndex, 1);
        fs.writeFileSync(offersDataPath, JSON.stringify(offers, null, 2));
        
        // Notify the buyer.
        try {
          const buyerMember = await interaction.guild.members.fetch(offer.buyerId);
          await buyerMember.send(`The chat for trade listing ${offer.tradeIndex} has been archived by the seller.`);
        } catch (e) {
          console.error('Failed to DM buyer:', e);
        }
      }
    },
    
    async handleCounterModal(interaction) {
      if (!interaction.isModalSubmit() || !interaction.customId.startsWith('offerCounterModal:')) return;
      const offerId = parseInt(interaction.customId.split(':')[1], 10);
    
      let offers = [];
      if (fs.existsSync(offersDataPath)) {
        offers = JSON.parse(fs.readFileSync(offersDataPath));
      }
      const offerIndex = offers.findIndex(o => o.offerId === offerId);
      if (offerIndex === -1) {
        return interaction.reply({ content: 'Offer not found.', ephemeral: true });
      }
      const offer = offers[offerIndex];
      if (interaction.user.id !== offer.sellerId) {
        return interaction.reply({ content: 'Only the seller can submit a counteroffer.', ephemeral: true });
      }
      const counterOfferDetail = interaction.fields.getTextInputValue('counterOffer');
      offer.status = 'Counter Offered';
      offer.counterOffer = counterOfferDetail;
    
      const originalEmbed = interaction.message.embeds[0];
      const embed = EmbedBuilder.from(originalEmbed);
      embed.setFooter({ text: 'Offer Status: Counter Offered' });
      embed.setColor(0x0000FF); // Blue
    
      const disabledComponents = interaction.message.components.map(row =>
        ActionRowBuilder.from(row).setComponents(
          row.components.map(comp => ButtonBuilder.from(comp).setDisabled(true))
        )
      );
    
      await interaction.update({ embeds: [embed], components: disabledComponents });
      offers[offerIndex] = offer;
      fs.writeFileSync(offersDataPath, JSON.stringify(offers, null, 2));
      try {
        const buyerMember = await interaction.guild.members.fetch(offer.buyerId);
        await buyerMember.send(`A counteroffer has been made for trade listing ${offer.tradeIndex}:\n${counterOfferDetail}`);
      } catch (e) {
        console.error('Failed to DM buyer:', e);
      }
    }
  };
