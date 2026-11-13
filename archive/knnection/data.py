"""K-nnection tagged dataset (prototype).

Entered from memory for playtesting. Debut years, labels and release years are
widely documented, but verify everything before launch. Purple categories
marked UNVERIFIED came from Jason's notes and haven't been checked.
"""

# ---------- Groups: id -> (display name, label, debut year) ----------
GROUPS = {
    "bts": ("BTS", "HYBE", 2013), "txt": ("TXT", "HYBE", 2019), "enhypen": ("ENHYPEN", "HYBE", 2020),
    "lsf": ("LE SSERAFIM", "HYBE", 2022), "svt": ("SEVENTEEN", "HYBE", 2015), "bnd": ("BOYNEXTDOOR", "HYBE", 2023),
    "illit": ("ILLIT", "HYBE", 2024),
    "nj": ("NewJeans", None, 2022),  # label left blank on purpose (ongoing ADOR/HYBE dispute)
    "twice": ("TWICE", "JYP", 2015), "skz": ("Stray Kids", "JYP", 2018), "itzy": ("ITZY", "JYP", 2019),
    "nmixx": ("NMIXX", "JYP", 2022), "2pm": ("2PM", "JYP", 2008), "day6": ("DAY6", "JYP", 2015),
    "exo": ("EXO", "SM", 2012), "rv": ("Red Velvet", "SM", 2014), "n127": ("NCT 127", "SM", 2016),
    "ndream": ("NCT DREAM", "SM", 2016), "aespa": ("aespa", "SM", 2020), "shinee": ("SHINee", "SM", 2008),
    "snsd": ("Girls' Generation", "SM", 2007), "riize": ("RIIZE", "SM", 2023), "fx": ("f(x)", "SM", 2009),
    "tvxq": ("TVXQ", "SM", 2003),
    "bp": ("BLACKPINK", "YG", 2016), "bigbang": ("BIGBANG", "YG", 2006), "2ne1": ("2NE1", "YG", 2009),
    "ikon": ("iKON", "YG", 2015), "treasure": ("TREASURE", "YG", 2020), "bm": ("BABYMONSTER", "YG", 2023),
    "gidle": ("(G)I-DLE", "Cube", 2018), "ive": ("IVE", "Starship", 2021), "ateez": ("ATEEZ", "KQ", 2018),
    "mmm": ("MAMAMOO", "RBW", 2014), "kiof": ("KISS OF LIFE", "S2", 2023), "xg": ("XG", "XGALX", 2022),
    "kep1er": ("Kep1er", "WAKEONE", 2022), "zb1": ("ZEROBASEONE", "WAKEONE", 2023),
    "izone": ("IZ*ONE", None, 2018), "wannaone": ("Wanna One", None, 2017), "ioi": ("I.O.I", None, 2016),
    "ff": ("FIFTY FIFTY", "ATTRAKT", 2022),
}

# ---------- Idols: id -> (display name, group id) ----------
IDOLS = {"rose": ("Rosé", "bp"), "seulgi": ("Seulgi", "rv")}

# ---------- Songs: (title, artist id or None for collabs, year) ----------
SONGS = [
    ("Dynamite", "bts", 2020), ("Butter", "bts", 2021), ("Boy With Luv", "bts", 2019), ("Spring Day", "bts", 2017),
    ("Black Swan", "bts", 2020), ("Pied Piper", "bts", 2017), ("My Universe", None, 2021),
    ("DDU-DU DDU-DU", "bp", 2018), ("Kill This Love", "bp", 2019), ("How You Like That", "bp", 2020),
    ("Pink Venom", "bp", 2022), ("Typa Girl", "bp", 2022), ("Ice Cream", "bp", 2020),
    ("Hype Boy", "nj", 2022), ("Ditto", "nj", 2022), ("Super Shy", "nj", 2023), ("Cookie", "nj", 2022),
    ("Bubble Gum", "nj", 2024),
    ("TT", "twice", 2016), ("FANCY", "twice", 2019), ("Feel Special", "twice", 2019),
    ("What is Love?", "twice", 2018), ("Cheer Up", "twice", 2016),
    ("God's Menu", "skz", 2020), ("S-Class", "skz", 2023), ("Thunderous", "skz", 2021), ("MANIAC", "skz", 2022),
    ("Psycho", "rv", 2019), ("Bad Boy", "rv", 2018), ("Ice Cream Cake", "rv", 2015), ("Red Flavor", "rv", 2017),
    ("DALLA DALLA", "itzy", 2019), ("ICY", "itzy", 2019), ("WANNABE", "itzy", 2020), ("GOLD", "itzy", 2024),
    ("Growl", "exo", 2013), ("Call Me Baby", "exo", 2015), ("Monster", "exo", 2016), ("LOVE SHOT", "exo", 2018),
    ("Cherry Bomb", "n127", 2017), ("Kick It", "n127", 2020), ("2 Baddies", "n127", 2022), ("Fact Check", "n127", 2023),
    ("Next Level", "aespa", 2021), ("Savage", "aespa", 2021), ("Black Mamba", "aespa", 2020), ("Supernova", "aespa", 2024),
    ("Hot Sauce", "ndream", 2021), ("Candy", "ndream", 2022),
    ("Sugar Rush Ride", "txt", 2023), ("Seven", None, 2023), ("Eleven", "ive", 2021), ("LOVE DIVE", "ive", 2022),
    ("4 Walls", "fx", 2015), ("1 of 1", "shinee", 2016), ("Blue", "bigbang", 2012), ("Lollipop", None, 2009),
    ("Lilac", None, 2021), ("Sour Grapes", "lsf", 2022), ("ANTIFRAGILE", "lsf", 2022),
    ("Queencard", "gidle", 2023), ("TOMBOY", "gidle", 2022), ("Nxde", "gidle", 2022),
    ("Gee", "snsd", 2009), ("Cupid", "ff", 2023), ("Gangnam Style", None, 2012),
    # Debut songs
    ("BOOMBAYAH", "bp", 2016), ("WHISTLE", "bp", 2016), ("Like OOH-AHH", "twice", 2015),
    ("District 9", "skz", 2018), ("Attention", "nj", 2022), ("FEARLESS", "lsf", 2022),
    ("Given-Taken", "enhypen", 2020), ("CROWN", "txt", 2019), ("LATATA", "gidle", 2018),
    ("O.O", "nmixx", 2022), ("No More Dream", "bts", 2013), ("MAMA", "exo", 2012),
    ("Happiness", "rv", 2014), ("Adore U", "svt", 2015), ("Shhh", "kiof", 2023),
    ("BATTER UP", "bm", 2023), ("Magnetic", "illit", 2024), ("One and Only", "bnd", 2023),
    ("In Bloom", "zb1", 2023),
]

# Each group's debut song(s). Titles must match SONGS exactly.
DEBUT_SONGS = {
    "BOOMBAYAH", "WHISTLE", "Like OOH-AHH", "District 9", "DALLA DALLA", "Attention", "Eleven",
    "Black Mamba", "FEARLESS", "Given-Taken", "CROWN", "LATATA", "Get A Guitar", "O.O",
    "No More Dream", "MAMA", "Happiness", "Adore U", "Shhh", "BATTER UP", "Magnetic",
    "One and Only", "In Bloom",
}

# Near-miss words: titles/names that LOOK like they fit a word category but don't.
NEAR_MISS = {
    "food": {"flavor", "menu", "venom", "hot", "sour", "spice"},
    "color": {"rosé", "swan", "lights"},
    "number": {"tt", "seventeen", "twice", "2ne1", "2pm", "kep1er", "zerobaseone", "127"},
}

# Word lists for title categories (matched against whole words in the title)
WORDS = {
    "food": {"butter", "candy", "cookie", "gum", "grapes", "cream", "lollipop", "sauce", "cake", "cherry", "sugar"},
    "color": {"pink", "red", "blue", "black", "lilac", "gold", "purple", "white", "yellow", "green"},
    "number": {"1", "2", "3", "4", "5", "one", "two", "three", "four", "seven", "eleven", "9"},
}
WORD_CAT_NAMES = {
    "food": "Song titles you could eat",
    "color": "Colors in the song title",
    "number": "Numbers in the song title",
}

# ---------- Hand-written purple categories ----------
# items: (display name, type)  — type matters only for the ambiguity check.
PURPLE = [
    {"name": "Groups formed through survival shows",
     "items": ["TWICE", "Stray Kids", "IZ*ONE", "Wanna One", "I.O.I", "Kep1er", "ZEROBASEONE"]},
    {"name": "Worked with Riot Games on music", "unverified": True,
     "items": ["(G)I-DLE", "XG", "KISS OF LIFE", "NewJeans"]},
    {"name": "Group names that are abbreviations",
     "items": ["BTS", "TXT", "TVXQ", "NCT 127", "NCT DREAM"]},
    {"name": "Associated with yellow / blonde", "unverified": True,
     "items": ["Nxde", "Rosé", "Seulgi", "Hyphen"]},
    {"name": "Songs featuring a Western artist",
     "items": ["Boy With Luv", "Ice Cream", "Seven", "My Universe"]},
]
