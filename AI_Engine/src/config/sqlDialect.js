// Safe, unambiguous T-SQL -> Postgres substitutions (Bucket A).
// GETUTCDATE is handled before GETDATE for clarity; the \b anchors already
// keep them distinct.
function autoTranslateDialect(text) {
  return text
    .replace(/\bdbo\./gi, '')
    .replace(/\bGETUTCDATE\s*\(\s*\)/gi, "(NOW() AT TIME ZONE 'utc')")
    .replace(/\bGETDATE\s*\(\s*\)/gi, 'NOW()')
    .replace(/\bISNULL\s*\(/gi, 'COALESCE(')
    .replace(/\bLEN\s*\(/gi, 'LENGTH(')
    .replace(/ORDER\s+BY\s+NEWID\s*\(\s*\)/gi, 'ORDER BY RANDOM()');
}

module.exports = { autoTranslateDialect };
