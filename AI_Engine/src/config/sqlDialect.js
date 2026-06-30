// Safe, unambiguous T-SQL -> Postgres substitutions (Bucket A).
function autoTranslateDialect(text) {
  return text
    // Strip T-SQL national-string prefix: N'text' -> 'text'
    .replace(/\bN'/g, "'")
    // Strip T-SQL square-bracket identifier quoting: [Name] -> Name
    .replace(/\[(\w+)\]/g, '$1')
    // Strip database qualifier then dbo schema prefix
    .replace(/\bLegalBotDB\./gi, '')
    .replace(/\bdbo\./gi, '')
    // DATEADD(unit, n, GETDATE()) -> (NOW() + INTERVAL 'n unit')  [before GETDATE rule]
    .replace(/\bDATEADD\s*\(\s*(\w+)\s*,\s*(-?\d+)\s*,\s*GETDATE\s*\(\s*\)\s*\)/gi, "(NOW() + INTERVAL '$2 $1')")
    // Date/time functions
    .replace(/\bSYSUTCDATETIME\s*\(\s*\)/gi, "(NOW() AT TIME ZONE 'utc')")
    .replace(/\bGETUTCDATE\s*\(\s*\)/gi, "(NOW() AT TIME ZONE 'utc')")
    .replace(/\bGETDATE\s*\(\s*\)/gi, 'NOW()')
    .replace(/\bISNULL\s*\(/gi, 'COALESCE(')
    .replace(/\bLEN\s*\(/gi, 'LENGTH(')
    .replace(/ORDER\s+BY\s+NEWID\s*\(\s*\)/gi, 'ORDER BY RANDOM()');
}

module.exports = { autoTranslateDialect };
