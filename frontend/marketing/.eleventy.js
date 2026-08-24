module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('public');
  eleventyConfig.addWatchTarget('./src/styles/');
  eleventyConfig.addWatchTarget('./src/scripts/');
  eleventyConfig.addWatchTarget('./tailwind.config.js');
  eleventyConfig.addWatchTarget('./postcss.config.js');

  return {
    dir: {
      input: 'src',
      includes: '../_includes',
      output: '_site',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
};
