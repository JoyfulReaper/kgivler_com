/**
 * Parses a command line string into an array of tokens.
 * Handles quoted strings (single and double) and basic whitespace splitting.
 */
export function parseCommandLine(input) {
  if (!input) return [];

  const tokens = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = null;

  for (const char of input) {
    // Check for quote toggle
    if ((char === '"' || char === "'") && (!quoteChar || char === quoteChar)) {
      inQuotes = !inQuotes;
      quoteChar = inQuotes ? char : null;
    } 
    // Check for delimiter
    else if (char === ' ' && !inQuotes) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } 
    // Build token
    else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
}