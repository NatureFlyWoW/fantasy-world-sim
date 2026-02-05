/**
 * Training data for Markov chain name generation.
 * Each culture provides arrays of example names to learn phonetic patterns from.
 */

export interface CultureNameData {
  readonly male: readonly string[];
  readonly female: readonly string[];
  readonly family: readonly string[];
  readonly placePrefixes: readonly string[];
  readonly placeSuffixes: readonly string[];
}

// ---------------------------------------------------------------------------
// Nordic — harsh consonants, short vowels, Norse-inspired
// ---------------------------------------------------------------------------
export const NORDIC_NAMES: CultureNameData = {
  male: [
    'Bjorn', 'Ragnar', 'Sven', 'Erik', 'Olaf', 'Leif', 'Gunnar', 'Harald',
    'Ivar', 'Ulf', 'Sigurd', 'Halfdan', 'Roald', 'Knut', 'Vidar', 'Bragi',
    'Hakon', 'Magnus', 'Rune', 'Torsten', 'Eirik', 'Arvid', 'Dag', 'Einar',
    'Finn', 'Gorm', 'Hagen', 'Ingvar', 'Kjell', 'Lars', 'Nils', 'Rolf',
    'Sten', 'Torvald', 'Viggo', 'Axel', 'Birger', 'Dreng', 'Geir', 'Halvar',
    'Inge', 'Jorund', 'Ketil', 'Magni', 'Odd', 'Sigmund', 'Thorbjorn',
    'Ulfrik', 'Yngvar', 'Bard', 'Frey', 'Grim', 'Hroald', 'Jarl', 'Kolbein',
  ],
  female: [
    'Astrid', 'Freya', 'Ingrid', 'Helga', 'Sigrid', 'Gudrun', 'Brynhild',
    'Solveig', 'Hilda', 'Ragnhild', 'Thyra', 'Inga', 'Gerd', 'Liv', 'Asa',
    'Runa', 'Thora', 'Sif', 'Dagny', 'Embla', 'Frida', 'Gunnhild', 'Herja',
    'Idun', 'Jorun', 'Kari', 'Lagertha', 'Maren', 'Nanna', 'Oydis',
    'Ragnfrid', 'Svanhild', 'Tove', 'Ulfhild', 'Vigdis', 'Alva', 'Bodil',
    'Dagmar', 'Edda', 'Grima', 'Haldis', 'Ingeborg', 'Katla', 'Magnhild',
    'Norna', 'Saga', 'Torhild', 'Yrsa', 'Bera', 'Dalla', 'Eydis', 'Freja',
  ],
  family: [
    'Ironhand', 'Stormborn', 'Frostbeard', 'Wolfbane', 'Ravenclaw',
    'Shieldwall', 'Oakenshield', 'Bloodaxe', 'Thunderson', 'Bearclaw',
    'Starfall', 'Winterhold', 'Fireheart', 'Grimward', 'Ashborn',
    'Whitefall', 'Stonehelm', 'Icevein', 'Warborn', 'Steelgaze',
    'Drakeson', 'Hailstone', 'Longstride', 'Battleborn', 'Goldmane',
    'Hawkeye', 'Ironfist', 'Mistwalker', 'Nordskov', 'Oakheart',
    'Runecaster', 'Silverthorn', 'Thorsson', 'Ulfson', 'Wavecrest',
    'Wyrmslayer', 'Fjordborn', 'Snowdrift', 'Rimefrost', 'Crowsong',
    'Boarhelm', 'Swordbreaker', 'Stormsson', 'Blackthorn', 'Deepwood',
    'Eaglewing', 'Flameforge', 'Greystone', 'Highcliff', 'Keenedge',
  ],
  placePrefixes: [
    'Frost', 'Storm', 'Iron', 'Wolf', 'Raven', 'Shield', 'Oak', 'Blood',
    'Thunder', 'Bear', 'Star', 'Winter', 'Night', 'Fire', 'Grim', 'Ash',
    'White', 'Bone', 'Stone', 'Ice', 'War', 'Steel', 'Drake', 'Hail',
    'Long', 'Battle', 'Gold', 'Hawk', 'Mist', 'Nord', 'Rune', 'Silver',
    'Thorn', 'Vind', 'Wave', 'Wyrm', 'Fjord', 'Snow', 'Boar', 'Crow',
    'Helm', 'Sword', 'Axe', 'Spear', 'Shield', 'Elk', 'Eagle', 'Deep',
    'High', 'Dark', 'Grey', 'Black',
  ],
  placeSuffixes: [
    'heim', 'hold', 'fell', 'garde', 'borg', 'stad', 'fjord', 'mark',
    'dale', 'vik', 'hall', 'keep', 'haven', 'watch', 'gate', 'bridge',
    'stead', 'moor', 'glen', 'peak', 'crest', 'ford', 'vale', 'cliff',
    'shore', 'rock', 'mount', 'ridge', 'wood', 'heath', 'land', 'ness',
    'bay', 'lake', 'deep', 'hollow', 'end', 'field', 'barrow', 'stone',
    'guard', 'spire', 'reach', 'pass', 'drift', 'horn', 'forge', 'vang',
    'tun', 'by',
  ],
};

// ---------------------------------------------------------------------------
// Elvish — flowing vowels, soft consonants (l, n, r, th)
// ---------------------------------------------------------------------------
export const ELVISH_NAMES: CultureNameData = {
  male: [
    'Aelindor', 'Thalion', 'Caelorn', 'Elorian', 'Faelar', 'Galadir',
    'Ithilorn', 'Lirandel', 'Nimrodel', 'Orelion', 'Silvain', 'Thandril',
    'Vaelorn', 'Anarion', 'Celebrin', 'Daelorin', 'Elendir', 'Fenharion',
    'Glorindel', 'Haldarion', 'Ilmarin', 'Kelindor', 'Lorenthal', 'Maelorn',
    'Naelindor', 'Othirion', 'Phaelorn', 'Quelindor', 'Raelorin', 'Saelthor',
    'Thaelindor', 'Uthirion', 'Vaelindor', 'Weldarin', 'Xalindor',
    'Yaelorin', 'Zephirion', 'Alathar', 'Belindor', 'Caelandir', 'Daelorin',
    'Elindor', 'Findarion', 'Galadorn', 'Helarion', 'Isilindor', 'Jaelorin',
    'Kaelorin', 'Laelindor', 'Maelorin', 'Naelorin',
  ],
  female: [
    'Aelindra', 'Elowen', 'Thalindra', 'Caelanthe', 'Faeloria', 'Galadwen',
    'Ithilwen', 'Liranel', 'Nimrodel', 'Orelwen', 'Silivren', 'Thandara',
    'Vaelora', 'Anariel', 'Celebriel', 'Daelindra', 'Eleniel', 'Fenaria',
    'Gloriel', 'Halindra', 'Ilmariel', 'Kelindra', 'Loriel', 'Maelindra',
    'Naelindra', 'Othiriel', 'Phaelindra', 'Quelindra', 'Raelindra',
    'Saelindra', 'Thaelindra', 'Uthiriel', 'Vaelindra', 'Weldariel',
    'Xalindra', 'Yaelindra', 'Zephira', 'Alathariel', 'Belindriel',
    'Caelariel', 'Daelariel', 'Elariel', 'Findariel', 'Galadiel',
    'Helariel', 'Isilariel', 'Jaelariel', 'Kaelariel', 'Laelariel',
    'Maelariel', 'Naelariel',
  ],
  family: [
    'Starweaver', 'Moonwhisper', 'Silverbough', 'Dawnstrider', 'Leafsinger',
    'Sunshadow', 'Windwalker', 'Dewdancer', 'Nightbloom', 'Starlight',
    'Rivergleam', 'Thornrose', 'Oakenshade', 'Willowmere', 'Crystalbrook',
    'Dreamweaver', 'Lightstep', 'Shadeleaf', 'Brightwater', 'Evenstar',
    'Moonsong', 'Silverleaf', 'Starborn', 'Sunweaver', 'Twilightbough',
    'Autumnwhisper', 'Bloomfield', 'Cloudstrider', 'Dewfall', 'Eternalmist',
    'Featherwind', 'Gladewalker', 'Horizongaze', 'Ivoryspire', 'Jadeleaf',
    'Kindlelight', 'Lotusbloom', 'Mirthglade', 'Northwind', 'Opalsheen',
    'Pearlmist', 'Quillsong', 'Rosedawn', 'Skyweaver', 'Thistlebrook',
    'Umbershade', 'Vinesinger', 'Waterlight', 'Xenithbrow', 'Yarrowfield',
  ],
  placePrefixes: [
    'Ael', 'Cel', 'Elen', 'Gal', 'Ith', 'Lir', 'Nim', 'Sil', 'Thal',
    'Vael', 'Star', 'Moon', 'Sun', 'Dawn', 'Dusk', 'Silver', 'Gold',
    'Crystal', 'Dream', 'Light', 'Shadow', 'Mist', 'Cloud', 'Bloom',
    'Leaf', 'Wind', 'Rain', 'Dew', 'Frost', 'Glade', 'Glen', 'Vale',
    'River', 'Lake', 'Stream', 'Spring', 'Pearl', 'Opal', 'Jade',
    'Ivory', 'Lotus', 'Rose', 'Lily', 'Fern', 'Willow', 'Birch',
    'Cedar', 'Ash', 'Elm', 'Hazel',
  ],
  placeSuffixes: [
    'anor', 'ithil', 'odel', 'arin', 'indel', 'alas', 'ondor', 'elar',
    'ilien', 'alor', 'wen', 'lor', 'dor', 'mir', 'thir', 'ion', 'iel',
    'dale', 'vale', 'mere', 'haven', 'glade', 'wood', 'deep', 'height',
    'spire', 'keep', 'hold', 'grove', 'dell', 'bower', 'hall', 'court',
    'garden', 'reach', 'gate', 'bridge', 'fountain', 'pool', 'falls',
    'hollow', 'meadow', 'field', 'crest', 'crown', 'song', 'light',
    'bloom', 'shade', 'rest', 'heart',
  ],
};

// ---------------------------------------------------------------------------
// Dwarven — guttural, heavy consonants (k, g, d, th, r)
// ---------------------------------------------------------------------------
export const DWARVEN_NAMES: CultureNameData = {
  male: [
    'Durak', 'Grimjaw', 'Thorin', 'Balin', 'Dwarik', 'Gimrik', 'Glodin',
    'Norik', 'Dorik', 'Borik', 'Brundak', 'Kragdin', 'Thorgrim', 'Baldur',
    'Durgon', 'Forndir', 'Grundak', 'Haldor', 'Jordak', 'Keldur',
    'Mordak', 'Nurdak', 'Orgrim', 'Ragnak', 'Skaldur', 'Thordak',
    'Uldrak', 'Vondak', 'Wargrim', 'Zordak', 'Anvilmar', 'Borgrim',
    'Cragdar', 'Delgrim', 'Embrak', 'Forgrim', 'Galdrak', 'Helmdar',
    'Irondak', 'Jarvik', 'Kelgrim', 'Longrim', 'Malgrim', 'Nordin',
    'Okgrim', 'Peldak', 'Quartzin', 'Rungrim', 'Steelgrim', 'Tungrim',
  ],
  female: [
    'Dorna', 'Helka', 'Thordis', 'Brynja', 'Grunda', 'Keldra', 'Morgna',
    'Nurdra', 'Ragna', 'Skaldra', 'Thordra', 'Uldra', 'Vondra', 'Borgna',
    'Cragda', 'Delgra', 'Embra', 'Forgra', 'Galdra', 'Helmra', 'Ironda',
    'Jarva', 'Kelgra', 'Longra', 'Malgra', 'Nordra', 'Okgra', 'Pelda',
    'Quarta', 'Rungra', 'Steela', 'Tungra', 'Anvilra', 'Boldra', 'Cogra',
    'Durgna', 'Edgra', 'Flintda', 'Gorma', 'Halda', 'Ingra', 'Jorna',
    'Krigda', 'Lodra', 'Morda', 'Nugra', 'Oradra', 'Prygda', 'Rugna',
    'Stona', 'Thudra',
  ],
  family: [
    'Ironforge', 'Stonefist', 'Deepdelve', 'Hammerfall', 'Anvilstrike',
    'Copperbeard', 'Goldvein', 'Blackhammer', 'Stonemaul', 'Greybeard',
    'Steelpick', 'Ironbrow', 'Bronzehelm', 'Mithrilshield', 'Gemcutter',
    'Tunnelborn', 'Darkmine', 'Stoutaxe', 'Hardrock', 'Delvecrest',
    'Forgeheart', 'Anviltop', 'Boulderback', 'Coalbeard', 'Deepforge',
    'Earthgrip', 'Flintstone', 'Granitehold', 'Heavyhand', 'Ironroot',
    'Jademine', 'Keenaxe', 'Leadfoot', 'Moltenvein', 'Nickelpick',
    'Oreseeker', 'Pickaxe', 'Quartzhand', 'Rubyeye', 'Slagborn',
    'Tinkerbeard', 'Underdelve', 'Vaultkeeper', 'Whetstone', 'Yornbeard',
    'Zinctooth', 'Adamantbrow', 'Brassbolt', 'Chiselfist', 'Drossheart',
  ],
  placePrefixes: [
    'Iron', 'Stone', 'Deep', 'Hammer', 'Anvil', 'Copper', 'Gold', 'Black',
    'Grey', 'Steel', 'Bronze', 'Mithril', 'Gem', 'Tunnel', 'Dark', 'Stout',
    'Hard', 'Forge', 'Boulder', 'Coal', 'Earth', 'Flint', 'Granite',
    'Heavy', 'Jade', 'Keen', 'Lead', 'Molten', 'Ore', 'Pick', 'Quartz',
    'Ruby', 'Slag', 'Tin', 'Under', 'Vault', 'Whet', 'Zinc', 'Adamant',
    'Brass', 'Chisel', 'Dross', 'Ember', 'Fire', 'Grim', 'Helm', 'Ingot',
    'Krag', 'Lode', 'Mine',
  ],
  placeSuffixes: [
    'hold', 'delve', 'forge', 'mine', 'hall', 'deep', 'guard', 'gate',
    'helm', 'keep', 'heim', 'barr', 'brek', 'dun', 'gard', 'grund',
    'krag', 'mond', 'rak', 'thar', 'vorn', 'zan', 'arag', 'bund',
    'dak', 'fang', 'grim', 'holt', 'iron', 'jord', 'krund', 'lok',
    'mak', 'nor', 'olk', 'pik', 'rund', 'stok', 'thund', 'urk',
    'vik', 'wark', 'yak', 'zund', 'brok', 'durn', 'grok', 'kund',
    'murk', 'shard',
  ],
};

// ---------------------------------------------------------------------------
// Desert — Arabic-inspired phonemes
// ---------------------------------------------------------------------------
export const DESERT_NAMES: CultureNameData = {
  male: [
    'Khalid', 'Rashid', 'Tariq', 'Farid', 'Samir', 'Jamal', 'Nabil',
    'Zafir', 'Hakim', 'Idris', 'Kadir', 'Latif', 'Mansur', 'Nasir',
    'Omar', 'Qadir', 'Rafiq', 'Salim', 'Tahir', 'Umar', 'Wahid', 'Yasir',
    'Zahid', 'Amir', 'Basir', 'Dalil', 'Fadil', 'Ghazi', 'Hamid', 'Ismail',
    'Jabir', 'Kamil', 'Luqman', 'Majid', 'Nadir', 'Othman', 'Qasim',
    'Ridwan', 'Sadiq', 'Tawfiq', 'Uzair', 'Waqar', 'Yasin', 'Ziyad',
    'Ashraf', 'Bashir', 'Daud', 'Faisal', 'Habib', 'Jalil',
  ],
  female: [
    'Zahra', 'Layla', 'Amira', 'Fatima', 'Samira', 'Naima', 'Yasmin',
    'Safiya', 'Halima', 'Jamila', 'Karima', 'Latifa', 'Mariam', 'Nadia',
    'Qamar', 'Rahima', 'Soraya', 'Tahira', 'Warda', 'Zainab', 'Aaliya',
    'Basima', 'Dalila', 'Farah', 'Ghalia', 'Haniya', 'Inaya', 'Jihan',
    'Khadija', 'Lubna', 'Malika', 'Nura', 'Omara', 'Qadira', 'Rasha',
    'Suhair', 'Tamara', 'Umayma', 'Wahiba', 'Yusra', 'Zubaida', 'Abir',
    'Badriya', 'Dima', 'Fadila', 'Ghazala', 'Habiba', 'Ihsan', 'Jalila',
    'Kamila', 'Lamya',
  ],
  family: [
    'al-Rashid', 'al-Hakim', 'al-Nur', 'al-Safi', 'al-Zahir', 'al-Qadir',
    'al-Malik', 'al-Amin', 'al-Basir', 'al-Fadil', 'al-Ghani', 'al-Hamid',
    'al-Jabir', 'al-Kamil', 'al-Latif', 'al-Majid', 'al-Nasir', 'al-Omar',
    'al-Rafiq', 'al-Salim', 'al-Wahid', 'al-Yasir', 'al-Zafir', 'ibn-Tariq',
    'ibn-Khalid', 'ibn-Farid', 'ibn-Samir', 'ibn-Jamal', 'ibn-Nabil',
    'ibn-Hakim', 'ibn-Idris', 'ibn-Kadir', 'ibn-Mansur', 'ibn-Omar',
    'ibn-Qadir', 'ibn-Rashid', 'ibn-Salim', 'ibn-Tahir', 'ibn-Umar',
    'ibn-Wahid', 'ibn-Zahid', 'al-Dinar', 'al-Hayat', 'al-Jawhar',
    'al-Misk', 'al-Shamal', 'al-Waha', 'al-Sahra', 'al-Buraq', 'al-Qamar',
  ],
  placePrefixes: [
    'Al', 'El', 'Dar', 'Bab', 'Wadi', 'Qasr', 'Ras', 'Tel', 'Jebel',
    'Ain', 'Bir', 'Khor', 'Marj', 'Nahr', 'Sahel', 'Shatt', 'Umm',
    'Zahr', 'Khalij', 'Madinat', 'Bayt', 'Jazirat', 'Rijal', 'Suq',
    'Thahr', 'Wahdat', 'Yathrib', 'Zawiyet', 'Burj', 'Hisn', 'Qubbat',
    'Ribat', 'Saray', 'Khirbat', 'Maqam', 'Qal', 'Sahra', 'Turba',
    'Zahrat', 'Jami', 'Kasr', 'Manzil', 'Nur', 'Qantara', 'Riad',
    'Sultan', 'Tariq', 'Wazir', 'Sham', 'Mashr',
  ],
  placeSuffixes: [
    'abad', 'iyya', 'stan', 'pur', 'istan', 'abad', 'gah', 'kand',
    'sara', 'shah', 'dar', 'mahr', 'bahr', 'qasr', 'burj', 'mahal',
    'minar', 'wadi', 'oasis', 'haven', 'gate', 'pass', 'reach', 'wells',
    'spring', 'dune', 'mesa', 'ridge', 'bluff', 'canyon', 'gorge',
    'basin', 'plain', 'steppe', 'trail', 'path', 'road', 'market',
    'fort', 'tower', 'palace', 'garden', 'court', 'circle', 'square',
    'bridge', 'port', 'harbor', 'point',
  ],
};

// ---------------------------------------------------------------------------
// Eastern — East Asian-inspired syllable patterns
// ---------------------------------------------------------------------------
export const EASTERN_NAMES: CultureNameData = {
  male: [
    'Liang', 'Haru', 'Kenji', 'Ryu', 'Shin', 'Taro', 'Wei', 'Xian',
    'Yuki', 'Zen', 'Akira', 'Bao', 'Chen', 'Daichi', 'Eiji', 'Feng',
    'Gao', 'Hiro', 'Ichiro', 'Jin', 'Kai', 'Lei', 'Ming', 'Nobu',
    'Oren', 'Ping', 'Qiang', 'Ren', 'Sho', 'Takeshi', 'Udo', 'Wen',
    'Xu', 'Yao', 'Zhou', 'Arata', 'Bai', 'Chang', 'Dae', 'Etsuo',
    'Fudo', 'Gan', 'Hayato', 'Isao', 'Jiro', 'Kenta', 'Long', 'Mao',
    'Nao', 'Ota',
  ],
  female: [
    'Yuki', 'Mei', 'Hana', 'Sakura', 'Lin', 'Xia', 'Aiko', 'Rei',
    'Suki', 'Tao', 'Uma', 'Wei', 'Yue', 'Zhi', 'Akemi', 'Bai', 'Chi',
    'Dai', 'Emi', 'Fumi', 'Gin', 'Haruka', 'Izumi', 'Jun', 'Kasumi',
    'Lan', 'Miko', 'Nami', 'Ori', 'Ping', 'Qin', 'Rin', 'Suzu',
    'Tomoe', 'Ume', 'Vu', 'Wan', 'Xiao', 'Yuri', 'Zhen', 'Amaya',
    'Chun', 'Daiyu', 'Etsuko', 'Fang', 'Hoshi', 'Iku', 'Jia', 'Kohana',
    'Lian', 'Miki',
  ],
  family: [
    'Tanaka', 'Yamamoto', 'Suzuki', 'Watanabe', 'Takahashi', 'Chen',
    'Wang', 'Zhang', 'Liu', 'Zhao', 'Nakamura', 'Kobayashi', 'Saito',
    'Kimura', 'Hayashi', 'Li', 'Huang', 'Wu', 'Yang', 'Zhou',
    'Matsumoto', 'Inoue', 'Shimizu', 'Ogawa', 'Fujita', 'Gao', 'Lin',
    'He', 'Luo', 'Sun', 'Mori', 'Abe', 'Ikeda', 'Hashimoto', 'Ishikawa',
    'Ma', 'Xu', 'Hu', 'Zhu', 'Guo', 'Sasaki', 'Yamaguchi', 'Kato',
    'Okada', 'Sakamoto', 'Deng', 'Feng', 'Jiang', 'Xie', 'Han',
  ],
  placePrefixes: [
    'Jade', 'Dragon', 'Lotus', 'Bamboo', 'Silk', 'Pearl', 'Cloud',
    'Moon', 'Tiger', 'Crane', 'Phoenix', 'Willow', 'Plum', 'Cherry',
    'Pine', 'Iron', 'Golden', 'Silver', 'Red', 'White', 'Black', 'Green',
    'Blue', 'Dawn', 'Dusk', 'Star', 'Sun', 'Snow', 'Rain', 'Wind',
    'Thunder', 'River', 'Mountain', 'Lake', 'Sea', 'Forest', 'Temple',
    'Autumn', 'Spring', 'Summer', 'Winter', 'Sacred', 'Ancient', 'Hidden',
    'Eternal', 'Celestial', 'Imperial', 'Royal', 'Grand', 'Great',
  ],
  placeSuffixes: [
    'shan', 'jiang', 'cheng', 'jing', 'yuan', 'tang', 'ling', 'gong',
    'men', 'hu', 'hai', 'chi', 'zhou', 'fu', 'he', 'dao', 'gu', 'feng',
    'wan', 'gang', 'pass', 'peak', 'vale', 'garden', 'palace', 'gate',
    'bridge', 'tower', 'temple', 'shrine', 'haven', 'port', 'market',
    'hall', 'court', 'spring', 'falls', 'rapids', 'hollow', 'field',
    'meadow', 'grove', 'glade', 'harbor', 'point', 'cliff', 'ridge',
    'summit', 'basin', 'delta',
  ],
};

// ---------------------------------------------------------------------------
// Fey — whimsical, nature-derived
// ---------------------------------------------------------------------------
export const FEY_NAMES: CultureNameData = {
  male: [
    'Bramblewood', 'Thornwhisper', 'Dewdrop', 'Foxglove', 'Nettlesting',
    'Mosswick', 'Cobweb', 'Thistledown', 'Willowbark', 'Fernshade',
    'Puckberry', 'Starling', 'Dandelion', 'Birchcall', 'Acorntop',
    'Bluebell', 'Cloverknot', 'Dewshine', 'Elderwick', 'Frostberry',
    'Glowworm', 'Hawthorn', 'Ivytwist', 'Juniper', 'Knotgrass',
    'Lichenmoss', 'Mistletoe', 'Nightshade', 'Oakwhisper', 'Pinecone',
    'Quicksilver', 'Rosewood', 'Snapdragon', 'Tangleroot', 'Umberleaf',
    'Vinetwist', 'Wildrose', 'Yarrow', 'Zinnia', 'Aspenleaf',
    'Briarcurl', 'Cattail', 'Duskwing', 'Elmfire', 'Fernstep',
    'Greenbark', 'Hollywick', 'Inkberry', 'Jasperleaf', 'Kernwood',
  ],
  female: [
    'Petalshine', 'Dewberry', 'Moonpetal', 'Willowsong', 'Fernbloom',
    'Stardust', 'Lavender', 'Honeydew', 'Rosedawn', 'Briarbell',
    'Blossomwing', 'Cloverleaf', 'Daisymist', 'Emberleaf', 'Flutterglow',
    'Gentlebreeze', 'Hazelbloom', 'Iristhorn', 'Jasminedew', 'Lilygrace',
    'Marigold', 'Nightingale', 'Orchidmist', 'Primrose', 'Quillberry',
    'Rainpetal', 'Sunbeam', 'Thistlebloom', 'Violetmist', 'Windflower',
    'Amberglow', 'Buttercup', 'Crystaldew', 'Dawnpetal', 'Echobell',
    'Fairydust', 'Glimmerleaf', 'Heatherbell', 'Ivybloom', 'Joybell',
    'Kindlewick', 'Larkspear', 'Meadowlight', 'Nutmegdust', 'Peachbloom',
    'Quillshade', 'Rosewick', 'Starbloom', 'Thistledew', 'Willowdusk',
  ],
  family: [
    'Thornmantle', 'Dewcatcher', 'Moonweaver', 'Starwhisper', 'Windbraider',
    'Leafturner', 'Rootdelver', 'Bloomtender', 'Mistwalker', 'Gladekeeper',
    'Sunweaver', 'Nightwhisper', 'Rainbringer', 'Frostbloom', 'Seedsower',
    'Honeygatherer', 'Silkspinner', 'Petalfall', 'Barkshaper', 'Mossgatherer',
    'Vineweaver', 'Dewsinger', 'Thornbraider', 'Leafwhisper', 'Brooktender',
    'Mushroomer', 'Cobwebber', 'Sparklegatherer', 'Pollenbearer', 'Nectarseeker',
    'Ripplecaller', 'Shimmerweaver', 'Twigbraider', 'Fireflydancer',
    'Fernweaver', 'Echolistener', 'Dewbrewer', 'Glowkeeper', 'Mistshaper',
    'Pebbleturner', 'Rootsinger', 'Shadeleaf', 'Tidewatcher', 'Webspinner',
    'Willowbender', 'Breezecatcher', 'Cloudherder', 'Daydreamer',
    'Echosinger', 'Fragrancer',
  ],
  placePrefixes: [
    'Bramble', 'Thorn', 'Dew', 'Fox', 'Nettle', 'Moss', 'Cobweb',
    'Thistle', 'Willow', 'Fern', 'Star', 'Dandy', 'Birch', 'Acorn',
    'Clover', 'Elder', 'Glow', 'Ivy', 'Hazel', 'Mist', 'Night',
    'Oak', 'Pine', 'Rose', 'Snap', 'Tangle', 'Vine', 'Wild', 'Honey',
    'Moon', 'Sun', 'Rain', 'Wind', 'Cloud', 'Dream', 'Fairy', 'Pixie',
    'Sprite', 'Flutter', 'Shimmer', 'Sparkle', 'Twinkle', 'Whisper',
    'Giggle', 'Tumble', 'Riddle', 'Wobble', 'Jingle', 'Bubble',
  ],
  placeSuffixes: [
    'wood', 'glen', 'dell', 'hollow', 'grove', 'glade', 'meadow',
    'thicket', 'bower', 'bramble', 'bush', 'copse', 'garden', 'hedge',
    'knoll', 'marsh', 'nook', 'patch', 'ring', 'shade', 'spring',
    'tangle', 'weald', 'wick', 'bend', 'brook', 'creek', 'dale',
    'falls', 'ford', 'lake', 'pond', 'pool', 'run', 'well', 'burrow',
    'den', 'lair', 'nest', 'roost', 'bloom', 'blossom', 'leaf',
    'petal', 'root', 'seed', 'stem', 'twig', 'cap', 'cup',
  ],
};

// ---------------------------------------------------------------------------
// Infernal — harsh, sibilant (x, z, th, sh)
// ---------------------------------------------------------------------------
export const INFERNAL_NAMES: CultureNameData = {
  male: [
    'Azrathis', 'Morkoth', 'Xyvex', 'Zarthul', 'Vexnar', 'Thazgul',
    'Skarthex', 'Naxiron', 'Drazkhel', 'Gormath', 'Hexvor', 'Krazul',
    'Malthex', 'Nexurath', 'Orzathul', 'Pyrzex', 'Razkhiel', 'Szarvex',
    'Thoxnar', 'Vorzath', 'Warzghul', 'Xarzhiel', 'Yzathex', 'Zarkhul',
    'Azghoth', 'Balzexar', 'Crozthul', 'Drazmathor', 'Exzarion', 'Fazghul',
    'Gorzathex', 'Hazkhiel', 'Ixzaroth', 'Jazghul', 'Korzathex',
    'Lazkhiel', 'Mozgrathul', 'Nazghoth', 'Orzexvar', 'Pazgrathul',
    'Razmathor', 'Sazghoth', 'Torzexvar', 'Urzathex', 'Vazgrathul',
    'Wazmathor', 'Xorzexvar', 'Yazgrathul', 'Zorzathex', 'Azvorion',
  ],
  female: [
    'Xythera', 'Zarvexia', 'Szariel', 'Thazara', 'Vexara', 'Morzhiel',
    'Nazghara', 'Draziel', 'Krazara', 'Hexiel', 'Azriel', 'Balzara',
    'Croziel', 'Drazara', 'Exziel', 'Fazara', 'Gorziel', 'Hazara',
    'Ixziel', 'Jazara', 'Korziel', 'Lazara', 'Moziel', 'Norzara',
    'Orziel', 'Pazara', 'Raziel', 'Sazara', 'Torziel', 'Urzara',
    'Vaziel', 'Wazara', 'Xorziel', 'Yazara', 'Zorziel', 'Ashariel',
    'Bethzara', 'Cyrziel', 'Darkzara', 'Ethziel', 'Firzara', 'Ghaziel',
    'Harzara', 'Ishziel', 'Jethzara', 'Kithziel', 'Lithzara', 'Methziel',
    'Nithzara', 'Othziel',
  ],
  family: [
    'Shadowbane', 'Hellforge', 'Doomhammer', 'Voidwalker', 'Ashreaper',
    'Soulrender', 'Darkbinder', 'Flamecurse', 'Ironblight', 'Bonechill',
    'Deathwhisper', 'Bloodthorn', 'Nightclaw', 'Venomstrike', 'Plaguebrow',
    'Chaosspawn', 'Dreadfang', 'Embercurse', 'Fiendmark', 'Grimspell',
    'Hatecrown', 'Infernalis', 'Jadeblight', 'Kilnborn', 'Lurkshadow',
    'Malicefang', 'Netherbane', 'Oathbreaker', 'Painweaver', 'Rotspawn',
    'Sinfire', 'Thornbleed', 'Underblight', 'Vileclaw', 'Warpmark',
    'Xenoburn', 'Yieldbane', 'Zealotblight', 'Ashenmaw', 'Blightcrown',
    'Corpsegrip', 'Duskfang', 'Essencebane', 'Felreaver', 'Goremaw',
    'Hexbane', 'Ironcurse', 'Jadebane', 'Kincurse', 'Lifebane',
  ],
  placePrefixes: [
    'Shadow', 'Hell', 'Doom', 'Void', 'Ash', 'Soul', 'Dark', 'Flame',
    'Iron', 'Bone', 'Death', 'Blood', 'Night', 'Venom', 'Plague',
    'Chaos', 'Dread', 'Ember', 'Fiend', 'Grim', 'Hate', 'Infernal',
    'Blight', 'Lurk', 'Malice', 'Nether', 'Pain', 'Rot', 'Sin',
    'Thorn', 'Vile', 'Warp', 'Xeno', 'Zeal', 'Ashen', 'Corpse',
    'Dusk', 'Fel', 'Gore', 'Hex', 'Obsidian', 'Onyx', 'Pyre',
    'Ruin', 'Scar', 'Terror', 'Umbra', 'Wraith', 'Cinder',
  ],
  placeSuffixes: [
    'maw', 'pit', 'forge', 'hold', 'gate', 'abyss', 'throne', 'keep',
    'spire', 'vault', 'crypt', 'tomb', 'lair', 'den', 'burrow', 'chasm',
    'gorge', 'rift', 'scar', 'wound', 'blight', 'curse', 'mark', 'brand',
    'fire', 'flame', 'burn', 'char', 'ash', 'cinder', 'waste', 'ruin',
    'wreck', 'fall', 'end', 'doom', 'reach', 'grasp', 'grip', 'mire',
    'marsh', 'bog', 'swamp', 'sink', 'depth', 'deep', 'dark', 'shade',
    'shadow', 'gloom',
  ],
};

/**
 * All cultures keyed by convention name.
 */
export const ALL_CULTURE_DATA: Readonly<Record<string, CultureNameData>> = {
  nordic: NORDIC_NAMES,
  elvish: ELVISH_NAMES,
  dwarven: DWARVEN_NAMES,
  desert: DESERT_NAMES,
  eastern: EASTERN_NAMES,
  fey: FEY_NAMES,
  infernal: INFERNAL_NAMES,
};
