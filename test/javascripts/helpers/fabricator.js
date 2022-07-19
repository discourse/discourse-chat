// heavily inspired from https://github.com/travelperk/fabricator

function Fabricator(Model, attributes = {}) {
  const fabricate = (opts) => Fabricate(Model, attributes, opts);
  fabricate.extend = (opts = {}) => Fabricator({ ...attributes, ...opts });
  return fabricate;
}

function Fabricate(Model, attributes, opts = {}) {
  if (typeof attributes === "function") {
    return attributes();
  }

  const extendedModel = { ...attributes, ...opts };

  const object = Object.keys(extendedModel).reduce((o, key) => {
    const value = extendedModel[key];
    o[key] = typeof value === "function" ? value.apply() : value;
    return o;
  }, {});

  return Model.create(object);
}

export { Fabricator };
