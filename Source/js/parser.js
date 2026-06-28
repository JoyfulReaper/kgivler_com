/**
 * Parses a command line string into an array of tokens.
 * Handles quoted strings (single and double) and basic whitespace splitting.
 */
export function parseCommandLine(input) {
  const tokens = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && (!quoteChar || char === quoteChar)) {
      // Toggle quote state
      inQuotes = !inQuotes;
      quoteChar = inQuotes ? char : null;
    } else if (char === ' ' && !inQuotes) {
      // Split on space only if not inside quotes
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }

  // Push the final token
  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  return tokens;
}