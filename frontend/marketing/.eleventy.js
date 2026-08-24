module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('public');

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
