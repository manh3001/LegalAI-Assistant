// Converts node-mssql style @named params into pg positional $1..$n.
// Repeated @name reuses the same placeholder. Full-token (\w+) match makes
// prefix names (@user vs @userId) safe in a single pass.
function convertNamedParams(text, valuesByName) {
  const indexByName = new Map();
  const order = [];
  const pgText = text.replace(/@(\w+)/g, (_match, name) => {
    if (!indexByName.has(name)) {
      order.push(name);
      indexByName.set(name, order.length); // 1-based
    }
    return '$' + indexByName.get(name);
  });
  const values = order.map((name) => valuesByName[name]);
  return { text: pgText, values };
}

module.exports = { convertNamedParams };
