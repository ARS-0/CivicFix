module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { paper: '#F4F5F0', ink: '#17212A', mute: '#5B6770', line: '#D8DDD2', road: '#14503C', roadDark: '#0E3B2C', signal: '#F2B705', brick: '#B83A26', sky: '#1F5FA8' },
      fontFamily: { display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'], sans: ['"Public Sans Variable"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
