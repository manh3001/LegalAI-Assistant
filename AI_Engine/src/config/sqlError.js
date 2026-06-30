// Map pg SQLSTATE codes onto the mssql error "number" values the code checks.
const PG_TO_MSSQL = {
  '23505': 2627, // unique_violation -> mssql duplicate key
};

function mapPgError(err) {
  if (err && err.code && PG_TO_MSSQL[err.code] !== undefined) {
    err.number = PG_TO_MSSQL[err.code];
  }
  return err;
}

module.exports = { mapPgError };
