// offerHelper.js

const capitalizeEachWord = (str) => {
    return str
      ? str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      : '';
  };
  
  const formatOfferLine = (offer) => {
    // This helper returns a formatted string for an offer.
    // It can be used for fallback notifications (for example via DM) or logging.
    const posted = `<t:${Math.floor(new Date(offer.timestamp).getTime() / 1000)}:R>`;
    const lines = [
      `**Offer ID:** ${offer.offerId}`,
      `**Trade Listing Index:** ${offer.tradeIndex}`,
      `**Seller:** <@${offer.sellerId}>`,
      `**Buyer:** <@${offer.buyerId}>`,
      `**Offer:** ${offer.yourOffer}`,
      `**Notes:** ${offer.notes || 'None'}`,
      `**Status:** ${offer.status}`,
      `**Posted:** ${posted}`
    ];
    if (offer.counterOffer) {
      lines.push(`**Counter Offer:** ${offer.counterOffer}`);
    }
    return lines.join('\n');
  };
  
  module.exports = { formatOfferLine, capitalizeEachWord };
