'use strict';

/* ══════════════════════════════════════════════════════
   DATA MAPS & SAMPLE FALLBACKS
══════════════════════════════════════════════════════ */
const BIBLE_NUM_MAP = {
  'genesis':1,'exodus':2,'leviticus':3,'numbers':4,'deuteronomy':5,
  'joshua':6,'judges':7,'ruth':8,'1 samuel':9,'2 samuel':10,
  '1 kings':11,'2 kings':12,'1 chronicles':13,'2 chronicles':14,
  'ezra':15,'nehemiah':16,'esther':17,'job':18,'psalms':19,
  'proverbs':20,'ecclesiastes':21,'song of solomon':22,
  'songs of solomon':22,'song of songs':22,'canticle of canticles':22,
  'isaiah':23,'jeremiah':24,'lamentations':25,'ezekiel':26,'daniel':27,
  'hosea':28,'joel':29,'amos':30,'obadiah':31,'jonah':32,
  'micah':33,'nahum':34,'habakkuk':35,'zephaniah':36,'haggai':37,
  'zechariah':38,'malachi':39,
  'matthew':40,'mark':41,'luke':42,'john':43,'acts':44,
  'romans':45,'1 corinthians':46,'2 corinthians':47,'galatians':48,
  'ephesians':49,'philippians':50,'colossians':51,
  '1 thessalonians':52,'2 thessalonians':53,
  '1 timothy':54,'2 timothy':55,'titus':56,'philemon':57,
  'hebrews':58,'james':59,'1 peter':60,'2 peter':61,
  '1 john':62,'2 john':63,'3 john':64,'jude':65,'revelation':66
};

const EN_TO_FR_BOOK = {
  'Genesis':'Genèse','Exodus':'Exode','Leviticus':'Lévitique','Numbers':'Nombres','Deuteronomy':'Deutéronome',
  'Joshua':'Josué','Judges':'Juges','Ruth':'Ruth','1 Samuel':'1 Samuel','2 Samuel':'2 Samuel',
  '1 Kings':'1 Rois','2 Kings':'2 Rois','1 Chronicles':'1 Chroniques','2 Chronicles':'2 Chroniques',
  'Ezra':'Esdras','Nehemiah':'Néhémie','Esther':'Esther','Job':'Job','Psalms':'Psaumes',
  'Proverbs':'Proverbes','Ecclesiastes':'Ecclésiaste','Song of Solomon':'Cantique des cantiques',
  'Songs of Solomon':'Cantique des cantiques','Song of Songs':'Cantique des cantiques',
  'Isaiah':'Ésaïe','Jeremiah':'Jérémie','Lamentations':'Lamentations','Ezekiel':'Ézéchiel','Daniel':'Daniel',
  'Hosea':'Osée','Joel':'Joël','Amos':'Amos','Obadiah':'Abdias','Jonah':'Jonas','Micah':'Michée',
  'Nahum':'Nahum','Habakkuk':'Habacuc','Zephaniah':'Sophonie','Haggai':'Aggée','Zechariah':'Zacharie','Malachi':'Malachie',
  'Matthew':'Matthieu','Mark':'Marc','Luke':'Luc','John':'Jean','Acts':'Actes','Romans':'Romains',
  '1 Corinthians':'1 Corinthiens','2 Corinthians':'2 Corinthiens','Galatians':'Galates','Ephesians':'Éphésiens',
  'Philippians':'Philippiens','Colossians':'Colossiens','1 Thessalonians':'1 Thessaloniciens','2 Thessalonians':'2 Thessaloniciens',
  '1 Timothy':'1 Timothée','2 Timothy':'2 Timothée','Titus':'Tite','Philemon':'Philémon','Hebrews':'Hébreux',
  'James':'Jacques','1 Peter':'1 Pierre','2 Peter':'2 Pierre','1 John':'1 Jean','2 John':'2 Jean','3 John':'3 Jean',
  'Jude':'Jude','Revelation':'Apocalypse'
};
const FR_TO_EN_BOOK = Object.keys(EN_TO_FR_BOOK).reduce((map, en) => {
  map[normalizeStr(EN_TO_FR_BOOK[en])] = en;
  return map;
}, {});
Object.entries(EN_TO_FR_BOOK).forEach(([en, fr]) => {
  BIBLE_NUM_MAP[normalizeStr(fr)] = BIBLE_NUM_MAP[normalizeStr(en)];
});

const SAMPLE_BIBLE = {
  "kjv": {
    "metadata": { "name": "Authorized King James Version", "shortname": "KJV" },
    "verses": [
      {"book_name":"Genesis","chapter":1,"verse":1,"text":"In the beginning God created the heaven and the earth."},
      {"book_name":"Genesis","chapter":1,"verse":3,"text":"And God said, Let there be light: and there was light."},
      {"book_name":"John","chapter":3,"verse":16,"text":"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."},
      {"book_name":"Psalms","chapter":23,"verse":1,"text":"The LORD is my shepherd; I shall not want."},
      {"book_name":"Psalms","chapter":23,"verse":2,"text":"He maketh me to lie down in green pastures: he leadeth me beside the still waters."},
      {"book_name":"Psalms","chapter":23,"verse":3,"text":"He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake."},
      {"book_name":"Romans","chapter":8,"verse":28,"text":"And we know that all things work together for good to them that love God."}
    ]
  }
};