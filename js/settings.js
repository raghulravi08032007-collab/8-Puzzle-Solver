const SETTINGS_KEY = '8puzzle_settings';

const DEFAULT_SETTINGS = {
    theme: 'dark',
    glow: true,
    color: 'purple',
    speed: 200,
    showHeuristics: true,
    highlightMoves: true,
    sound: false
};

const COLOR_MAP = {
    purple: {
        '--accent': '#7c3aed',
        '--accent-hover': '#6d28d9',
        '--tile-grad': 'linear-gradient(145deg, #7c3aed, #5b21b6)'
    },
    blue: {
        '--accent': '#38bdf8',
        '--accent-hover': '#0284c7',
        '--tile-grad': 'linear-gradient(145deg, #38bdf8, #0284c7)'
    },
    orange: {
        '--accent': '#f97316',
        '--accent-hover': '#ea580c',
        '--tile-grad': 'linear-gradient(145deg, #f97316, #ea580c)'
    }
};

const Settings = {
    get: function() {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (!saved) return { ...DEFAULT_SETTINGS };
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch(e) {
            return { ...DEFAULT_SETTINGS };
        }
    },

    save: function(settingsObj) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsObj));
        this.apply();
    },

    apply: function() {
        const s = this.get();
        const root = document.documentElement;

        // Apply colors
        const colors = COLOR_MAP[s.color] || COLOR_MAP.purple;
        for (let key in colors) {
            root.style.setProperty(key, colors[key]);
        }
        
        // Apply Glow
        if (s.glow) {
            root.classList.add('glow-enabled');
        } else {
            root.classList.remove('glow-enabled');
        }

        // Apply Theme
        if (s.theme === 'light') {
            root.classList.add('light-theme');
        } else {
            root.classList.remove('light-theme');
        }
    }
};

// Auto-apply settings script load
Settings.apply();
