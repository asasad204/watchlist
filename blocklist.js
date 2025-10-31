const bannedKeywords = ["Marvel, Disney", "Nickelodeon"]
    .flatMap(entry => entry.split(',').map(k => k.trim().toLowerCase()));

module.exports = bannedKeywords;