module.exports = {
  plugins: ["ember-template-lint-plugin-discourse"],
  extends: "discourse:recommended",

  rules: {
    "no-capital-arguments": false, // TODO: we extensively use `args` argument name
  }
};
