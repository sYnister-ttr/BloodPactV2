const capitalizeEachWord = (str) => {
    return str?.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) || '';
  };
  
  const formatTradeLine = (trade) => {
    // Use the grouped platforms if available, otherwise use the single platform property.
    const platformInfo = trade.platforms ? trade.platforms.join(', ') : trade.platform;
    const posted = `<t:${Math.floor(new Date(trade.timestamp).getTime() / 1000)}:R>`;
    
    const parts = [
      `**#${trade.index}** • <@${trade.userId}> — **${capitalizeEachWord(trade.item)}**`,
      `  **Platforms:** ${platformInfo}`,
      `  **Base:** ${capitalizeEachWord(trade.base) || 'None'} | **ISO:** ${capitalizeEachWord(trade.tradeFor)} | **Sockets:** ${trade.sockets || 'None'} | **Ethereal:** ${trade.ethereal ? 'Yes' : 'No'} | **Notes:** ${capitalizeEachWord(trade.notes) || 'None'} | *Posted:* ${posted}`,
      trade.link ? `🔗 ${trade.link}` : null
    ];
    
    return parts.filter(Boolean).join('\n');
  };
  
  module.exports = { capitalizeEachWord, formatTradeLine };
