/**
 * Complex Issue Detector
 * Detects if a support query requires human attention
 */

/**
 * Analyzes response and source documents to detect complex issues
 * 
 * @param {string} responseText - The text response from AutoRAG
 * @param {Array} sources - Array of source documents with scores
 * @param {Object} options - Configuration options
 * @returns {Object} Result with isComplex flag and reason
 */
function detectComplexIssue(responseText, sources, options = {}) {
  // Default settings
  const settings = {
    lowConfidenceThreshold: options.lowConfidenceThreshold || 0.7,
    minSourcesRequired: options.minSourcesRequired || 2,
    uncertaintyPhrases: options.uncertaintyPhrases || [
      "I'm not sure", 
      "I don't know", 
      "cannot determine",
      "insufficient information",
      "please contact support",
      "contact customer service",
      "reach out to our team",
      "not enough context",
      "unable to assist"
    ]
  };

  // Initialize result
  const result = {
    isComplex: false,
    reasons: []
  };

  // Check if we have enough sources
  if (!sources || sources.length < settings.minSourcesRequired) {
    result.isComplex = true;
    result.reasons.push("Insufficient knowledge sources");
  }

  // Check confidence scores
  const hasLowConfidence = sources && sources.length > 0 && 
    sources.every(doc => !doc.score || doc.score < settings.lowConfidenceThreshold);
  
  if (hasLowConfidence) {
    result.isComplex = true;
    result.reasons.push("Low confidence scores in knowledge sources");
  }

  // Check for uncertainty phrases
  if (responseText) {
    const lowerResponse = responseText.toLowerCase();
    const foundPhrases = settings.uncertaintyPhrases.filter(phrase => 
      lowerResponse.includes(phrase.toLowerCase())
    );
    
    if (foundPhrases.length > 0) {
      result.isComplex = true;
      result.reasons.push(`Contains uncertainty phrases: ${foundPhrases.join(', ')}`);
    }
  }

  // Check response length
  if (responseText && responseText.length < 50) {
    result.isComplex = true;
    result.reasons.push("Response too short");
  }

  return result;
}

module.exports = { detectComplexIssue };
