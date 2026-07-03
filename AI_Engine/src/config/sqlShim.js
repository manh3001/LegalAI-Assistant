const { convertNamedParams } = require('./sqlParams');
const { autoTranslateDialect } = require('./sqlDialect');
const { shapeRow } = require('./sqlRows');
const { mapPgError } = require('./sqlError');

const DEBUG = process.env.DB_DEBUG === '1' || process.env.DB_DEBUG === 'true';

// `execute(text, values)` must return a promise of { rows, rowCount } (pg shape).
function createRequest(execute) {
  const inputs = {};
  const request = {
    input(name, typeOrValue, maybeValue) {
      const value = arguments.length >= 3 ? maybeValue : typeOrValue;
      // MSSQL `bit` columns are `smallint` in Postgres, and pg rejects a JS
      // boolean parameter for a smallint column. Coerce booleans to 0/1 so
      // callers passing true/false (e.g. crawler settings) keep working.
      inputs[name] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
      return request;
    },
    async query(text) {
      const translated = autoTranslateDialect(text);
      const { text: pgText, values } = convertNamedParams(translated, inputs);
      if (DEBUG) console.log('[DB]', pgText, JSON.stringify(values));
      try {
        const res = await execute(pgText, values);
        const recordset = (res.rows || []).map(shapeRow);
        return {
          recordset,
          recordsets: [recordset],
          rowsAffected: [res.rowCount || 0],
          output: {},
        };
      } catch (err) {
        throw mapPgError(err);
      }
    },
    // No stored procedures are used in this codebase; execute() aliases query().
    execute(text) {
      return request.query(text);
    },
  };
  return request;
}

function createPool(execute) {
  return { request: () => createRequest(execute) };
}

// Self-returning callable so sql.X and sql.X(args) both work and are ignored.
function makeSql() {
  const marker = function () {
    return marker;
  };
  return new Proxy(
    {},
    {
      get() {
        return marker;
      },
    }
  );
}

module.exports = { createPool, makeSql };
